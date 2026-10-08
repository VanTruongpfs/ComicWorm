"""Run seller CRUD HTTP/JPA tests and an optional browser preview on isolated MySQL."""
from pathlib import Path
import argparse
import os
import socket
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('--preview', action='store_true')
parser.add_argument('--resume-preview', type=Path, help='Resume only the browser preview from an already tested disposable workspace')
parser.add_argument('--mysql-bin', type=Path, default=Path(r'C:\Program Files\MySQL\MySQL Server 9.0\bin'))
parser.add_argument('--java-home', type=Path, default=Path(r'C:\Users\PC\.jdks\ms-21.0.11'))
args = parser.parse_args()
backend = Path(__file__).resolve().parents[1]
bin_dir = args.mysql_bin.resolve()
if args.resume_preview:
    if not args.preview:
        parser.error('--resume-preview requires --preview')
    work = args.resume_preview.resolve()
    if work.parent != Path(tempfile.gettempdir()).resolve() or not work.name.startswith('comicworm-products-mysql-'):
        raise ValueError('Only an existing disposable test workspace can be resumed')
    if not (work / 'data/auto.cnf').is_file():
        raise ValueError('Missing disposable MySQL data')
else:
    work = Path(tempfile.mkdtemp(prefix='comicworm-products-mysql-'))
data, log = work / 'data', work / 'mysqld.log'
hidden = subprocess.CREATE_NO_WINDOW

def run(command, **kwargs):
    return subprocess.run(command, capture_output=True, creationflags=hidden, **kwargs)

if not args.resume_preview:
    initialized = run([str(bin_dir / 'mysqld.exe'), '--no-defaults', '--initialize-insecure',
                      f'--basedir={bin_dir.parent}', f'--datadir={data}', f'--log-error={log}'], timeout=90)
    if initialized.returncode:
        raise RuntimeError(log.read_text(errors='replace'))
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
server = subprocess.Popen([str(bin_dir / 'mysqld.exe'), '--no-defaults', f'--basedir={bin_dir.parent}',
    f'--datadir={data}', f'--port={port}', '--bind-address=127.0.0.1', '--mysqlx=OFF', '--skip-log-bin', f'--log-error={log}'],
    creationflags=hidden, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
base = [str(bin_dir / 'mysql.exe'), '--no-defaults', '--protocol=TCP', '-h127.0.0.1', f'-P{port}',
        '-uroot', '--default-character-set=utf8mb4', '--batch', '--skip-column-names']
preview = None
try:
    for attempt in range(180):
        ready = run(base, input=b'SELECT @@datadir;', timeout=3)
        if ready.returncode == 0:
            assert Path(ready.stdout.decode().strip()).resolve() == data.resolve()
            break
        if server.poll() is not None:
            raise RuntimeError(log.read_text(errors='replace'))
        time.sleep(.25)
    else:
        raise RuntimeError('Isolated MySQL was not ready')
    for name in ([] if args.resume_preview else ['schema.sql', 'seed.sql']):
        result = run(base, input=(backend / 'database' / name).read_bytes(), timeout=30)
        if result.returncode:
            raise RuntimeError(result.stderr.decode(errors='replace'))
    # The current login model adds this field after the original generated schema.
    # Align only the disposable instance with the application's existing users table.
    auth_column = run(base, input=(b"USE bookmooch_db_v3; SELECT COUNT(*) FROM users WHERE id IN(92001,92002,92003) AND email LIKE 'products-%@example.invalid';"
            if args.resume_preview else b'USE bookmooch_db_v3; ALTER TABLE users ADD COLUMN verification_token VARCHAR(255) NULL;'), timeout=15)
    if auth_column.returncode:
        raise RuntimeError(auth_column.stderr.decode(errors='replace'))
    if args.resume_preview and auth_column.stdout.strip() != b'3':
        raise ValueError('The resumed workspace does not contain the expected test users')
    if not args.resume_preview:
        # Test migration from the previous schema, including an existing image at a nonzero position.
        # The @@datadir assertion above guarantees that this DDL affects only our disposable database.
        legacy = b"""USE bookmooch_db_v3;
          ALTER TABLE product_images DROP CHECK ck_product_images_image_type;
          ALTER TABLE product_images DROP COLUMN image_type;
          ALTER TABLE products DROP COLUMN cover_image_url;
          INSERT INTO users(id,email,password_hash,full_name,role,is_seller) VALUES(91001,'migration@example.invalid','test','Migration test','USER',true);
          INSERT INTO products(id,seller_id,title,slug,description,category_id,condition_percent,price) SELECT 91001,91001,'Migration test','migration-test','Migration test',MIN(id),100,10 FROM categories;
          INSERT INTO product_images(product_id,image_url,display_order) VALUES(91001,'https://example.invalid/cover.png',2),(91001,'https://example.invalid/detail.png',3);
        """
        result = run(base, input=legacy, timeout=30)
        if result.returncode: raise RuntimeError(result.stderr.decode(errors='replace'))
        for repeat in range(2):
            result = run(base, input=b'USE bookmooch_db_v3;\n' + (backend / 'database/migrations/20261008_product_images.sql').read_bytes(), timeout=30)
            if result.returncode: raise RuntimeError(result.stderr.decode(errors='replace'))
        probe = run(base, input=b"USE bookmooch_db_v3; SELECT cover_image_url FROM products WHERE id=91001; SELECT image_type FROM product_images WHERE product_id=91001 ORDER BY display_order;", timeout=10)
        assert probe.returncode == 0 and probe.stdout.decode().split() == ['https://example.invalid/cover.png','COVER','DETAIL']
        cleanup = run(base, input=b'USE bookmooch_db_v3; DELETE FROM product_images WHERE product_id=91001; DELETE FROM products WHERE id=91001; DELETE FROM users WHERE id=91001;', timeout=10)
        if cleanup.returncode: raise RuntimeError(cleanup.stderr.decode(errors='replace'))
        print('PASS: existing-image migration preserves rows and can run twice.', flush=True)
    print('Running product CRUD, ownership and CSRF tests on disposable MySQL.', flush=True)
    environment = os.environ.copy()
    environment.update(JAVA_HOME=str(args.java_home.resolve()), PRODUCTS_MYSQL_TEST='true',
        PRODUCTS_MYSQL_DATADIR=str(data.resolve()),
        SPRING_DATASOURCE_URL=f'jdbc:mysql://127.0.0.1:{port}/bookmooch_db_v3?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true',
        SPRING_DATASOURCE_USERNAME='root', SPRING_DATASOURCE_PASSWORD='', SPRING_JPA_HIBERNATE_DDL_AUTO='validate')
    output = work / 'gradle.log'
    if args.resume_preview:
        build = subprocess.CompletedProcess([], 0)
        print('Resuming the verified disposable database for browser checks; tests are not repeated.', flush=True)
    else:
        with output.open('wb') as target:
            build = subprocess.run(['cmd.exe', '/d', '/c', 'gradlew.bat', 'test',
                '--tests', 'com.example.comicworm.SellerProductMySqlTests', '--tests', 'com.example.comicworm.SellerAccessTests',
                '--tests', 'com.example.comicworm.AnalyticsTests', '--tests', 'com.example.comicworm.UploadServiceTests',
                '--console=plain', '--no-daemon', '--max-workers=1'],
                cwd=backend, env=environment, creationflags=hidden, stdout=target, stderr=subprocess.STDOUT, timeout=300)
    reports = backend / 'build/reports'
    reports.mkdir(parents=True, exist_ok=True)
    (reports / 'products-mysql-build.log').write_bytes(output.read_bytes())
    summaries = []
    for name in ['SellerProductMySqlTests', 'SellerAccessTests', 'AnalyticsTests', 'UploadServiceTests']:
        result = backend / f'build/test-results/test/TEST-com.example.comicworm.{name}.xml'
        if result.exists():
            suite = ET.parse(result).getroot()
            summaries.append(f"{name}: tests={suite.get('tests')}, failures={suite.get('failures')}, errors={suite.get('errors')}, skipped={suite.get('skipped')}")
    print('\n'.join(summaries), flush=True)
    if build.returncode:
        print(output.read_text(errors='replace')[-9000:], flush=True)
        for result in (backend / 'build/test-results/test').glob('TEST-*SellerProduct*.xml'):
            for failure in ET.parse(result).findall('.//failure'):
                print((failure.text or '')[:3500], flush=True)
        raise RuntimeError('Product integration checks failed')
    (reports / 'products-mysql.txt').write_text('\n'.join(summaries) + '\nPASS: real HTTP login, seller ownership, validation, paging, sorting, CSRF and order-safe deletion.\n', encoding='utf-8')
    if args.preview:
        reset_buyer = run(base, input=b'USE bookmooch_db_v3; UPDATE users SET is_seller=false WHERE id=92003;', timeout=15)
        if reset_buyer.returncode:
            raise RuntimeError(reset_buyer.stderr.decode(errors='replace'))
        stop = reports / 'products-preview-stop.signal'
        if stop.exists(): stop.unlink()
        preview_log = reports / 'products-preview.log'
        with preview_log.open('wb') as target:
            preview = subprocess.Popen(['cmd.exe', '/d', '/c', 'gradlew.bat', 'bootRun',
                '--args=--server.port=18081 --spring.jpa.hibernate.ddl-auto=validate', '--console=plain', '--no-daemon', '--max-workers=1'],
                cwd=backend, env=environment, creationflags=hidden, stdout=target, stderr=subprocess.STDOUT)
            for attempt in range(360):
                if preview.poll() is not None: raise RuntimeError(preview_log.read_text(errors='replace')[-5000:])
                if 'Started ComicwormApplication' in preview_log.read_text(errors='replace'):
                    print('PREVIEW READY: http://localhost:18081/auth/login (disposable test database).', flush=True)
                    break
                time.sleep(.5)
            else: raise TimeoutError('Preview server did not start')
            deadline = time.monotonic() + 900
            while not stop.exists() and preview.poll() is None and time.monotonic() < deadline:
                time.sleep(1)
finally:
    if preview is not None and preview.poll() is None:
        run(['taskkill.exe', '/PID', str(preview.pid), '/T', '/F'], timeout=15)
        preview.wait(timeout=15)
    if server.poll() is None:
        run([str(bin_dir / 'mysqladmin.exe'), '--no-defaults', '--protocol=TCP', '-h127.0.0.1', f'-P{port}', '-uroot', 'shutdown'], timeout=15)
        try: server.wait(timeout=20)
        except subprocess.TimeoutExpired:
            server.terminate(); server.wait(timeout=5)
    print('Stopped the disposable test processes; configured database was not modified.', flush=True)
