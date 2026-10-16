"""Verify exchange checkout on disposable MySQL, then run real two-account browser checks."""
from pathlib import Path
import argparse
import os
import socket
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--mysql-bin', type=Path, default=Path(r'C:\Program Files\MySQL\MySQL Server 9.0\bin'))
parser.add_argument('--java-home', type=Path, default=Path(r'C:\Users\PC\.jdks\ms-21.0.11'))
parser.add_argument('--skip-browser', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
work = Path(tempfile.mkdtemp(prefix='comicworm-exchange-mysql-'))
data = work / 'data'
reports = root / 'build/reports/exchange-room'
reports.mkdir(parents=True, exist_ok=True)
hidden = subprocess.CREATE_NO_WINDOW

def run(command, **kwargs):
    return subprocess.run(command, capture_output=True, creationflags=hidden, **kwargs)

def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]

initialized = run([str(args.mysql_bin / 'mysqld.exe'), '--no-defaults', '--initialize-insecure',
    f'--basedir={args.mysql_bin.parent}', f'--datadir={data}', f'--log-error={work / "mysql.log"}'], timeout=90)
if initialized.returncode:
    raise RuntimeError((work / 'mysql.log').read_text(errors='replace'))
port, http_port = free_port(), free_port()
server = subprocess.Popen([str(args.mysql_bin / 'mysqld.exe'), '--no-defaults', f'--basedir={args.mysql_bin.parent}',
    f'--datadir={data}', f'--port={port}', '--bind-address=127.0.0.1', '--mysqlx=0',
    f'--log-error={work / "mysql.log"}'], creationflags=hidden)
mysql = [str(args.mysql_bin / 'mysql.exe'), '--no-defaults', '--protocol=TCP', '-h127.0.0.1', f'-P{port}', '-uroot', '--default-character-set=utf8mb4', '--batch', '--skip-column-names']
app = None
try:
    for _ in range(180):
        probe = run(mysql, input=b'SELECT @@datadir;', timeout=3)
        if probe.returncode == 0:
            assert Path(probe.stdout.decode().strip()).resolve() == data.resolve()
            break
        if server.poll() is not None: raise RuntimeError((work / 'mysql.log').read_text(errors='replace'))
        time.sleep(.3)
    else: raise TimeoutError('MySQL did not start')
    for name in ['schema.sql', 'seed.sql']:
        result = run(mysql, input=(root / 'database' / name).read_bytes(), timeout=30)
        if result.returncode: raise RuntimeError(result.stderr.decode(errors='replace'))
    result = run(mysql, input=b'USE bookmooch_db_v3; ALTER TABLE users ADD COLUMN verification_token VARCHAR(255) NULL; DROP TABLE exchange_order_links; DROP TABLE user_addresses;', timeout=15)
    if result.returncode: raise RuntimeError(result.stderr.decode(errors='replace'))
    # Align the disposable database with the existing authentication entity, which predates this migration.
    auth_schema = b'''USE bookmooch_db_v3;
        CREATE TABLE verification_tokens (
            id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, token VARCHAR(100) NOT NULL UNIQUE,
            token_type VARCHAR(30) NOT NULL, user_id BIGINT NOT NULL, expiry_date DATETIME(6) NOT NULL,
            resend_available_at DATETIME(6) NOT NULL, is_used BOOLEAN NOT NULL, created_at DATETIME(6),
            FOREIGN KEY (user_id) REFERENCES users(id));'''
    result = run(mysql, input=auth_schema, timeout=15)
    if result.returncode: raise RuntimeError(result.stderr.decode(errors='replace'))
    for _ in range(2):
        result = run(mysql, input=b'USE bookmooch_db_v3;\n' + (root / 'database/migrations/20261016_exchange_orders.sql').read_bytes(), timeout=15)
        if result.returncode: raise RuntimeError(result.stderr.decode(errors='replace'))
    print('PASS: additive exchange migration runs twice on disposable MySQL.', flush=True)
    env = os.environ.copy()
    env.update(JAVA_HOME=str(args.java_home), EXCHANGE_MYSQL_TEST='true', JPA_INTEGRATION_TEST='true',
        EXCHANGE_MYSQL_DATADIR=str(data.resolve()), SPRING_CONFIG_IMPORT='',
        SPRING_DATASOURCE_URL=f'jdbc:mysql://127.0.0.1:{port}/bookmooch_db_v3?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true',
        SPRING_DATASOURCE_USERNAME='root', SPRING_DATASOURCE_PASSWORD='', SPRING_JPA_HIBERNATE_DDL_AUTO='validate',
        SPRING_AI_GOOGLE_GENAI_API_KEY='test-key', SPRING_MAIL_USERNAME='', SPRING_MAIL_PASSWORD='')
    command = ['cmd.exe', '/d', '/c', 'gradlew.bat', 'test', '--tests', '*ExchangeRoom*', '--tests', '*ExchangeOrderMySqlTests',
        '--tests', '*JpaMappingIntegrationTests', 'bootWar', '--offline', '--console=plain', '--no-daemon', '--max-workers=1']
    log = reports / 'mysql-build.log'
    with log.open('wb') as output:
        result = subprocess.run(command, cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT, creationflags=hidden, timeout=360)
    summaries = []
    for report in (root / 'build/test-results/test').glob('TEST-*.xml'):
        suite = ET.parse(report).getroot()
        summaries.append(f"{suite.get('name')}: {suite.get('tests')} tests, {suite.get('failures')} failures, {suite.get('errors')} errors, {suite.get('skipped')} skipped")
    print('\n'.join(summaries), flush=True)
    (reports / 'mysql-results.txt').write_text('\n'.join(summaries), encoding='utf-8')
    if result.returncode:
        print(log.read_text(errors='replace')[-14000:], flush=True)
        raise RuntimeError('Exchange integration checks failed')
    if not args.skip_browser:
        log = reports / 'live-server.log'
        with log.open('wb') as output:
            app = subprocess.Popen([str(args.java_home / 'bin/java.exe'), '-jar', str(root / 'build/libs/comicworm-0.0.1-SNAPSHOT.war'), f'--server.port={http_port}'], cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT, creationflags=hidden)
            for _ in range(180):
                if app.poll() is not None: raise RuntimeError(log.read_text(errors='replace')[-5000:])
                try:
                    with urllib.request.urlopen(f'http://localhost:{http_port}/auth/login', timeout=2) as response:
                        if response.status == 200: break
                except Exception: time.sleep(.5)
            else: raise TimeoutError('Application did not start')
            env['EXCHANGE_BASE_URL'] = f'http://localhost:{http_port}'
            env['NODE_PATH'] = str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
            browser = run(['node', 'tools/verify_exchange_live_browser.cjs'], cwd=root, env=env, timeout=180)
            print(browser.stdout.decode(errors='replace'), flush=True)
            if browser.returncode: raise RuntimeError(browser.stderr.decode(errors='replace'))
finally:
    if app is not None and app.poll() is None:
        app.terminate()
        app.wait(timeout=20)
    if server.poll() is None:
        run([str(args.mysql_bin / 'mysqladmin.exe'), '--no-defaults', '--protocol=TCP', '-h127.0.0.1', f'-P{port}', '-uroot', 'shutdown'], timeout=15)
        try: server.wait(timeout=20)
        except subprocess.TimeoutExpired: server.terminate(); server.wait(timeout=5)
    print('Stopped disposable MySQL and application. Configured database was not modified.', flush=True)
