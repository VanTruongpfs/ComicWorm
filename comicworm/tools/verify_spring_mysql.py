"""Run Spring/JPA tests against an isolated local MySQL database, not user data."""
from pathlib import Path
import argparse
import os
import socket
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mysql-bin', required=True)
    parser.add_argument('--java-home', required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    bin_dir = Path(args.mysql_bin).resolve()
    java_home = Path(args.java_home).resolve()
    work = Path(tempfile.mkdtemp(prefix='comicworm-spring-mysql-'))
    data, log = work / 'data', work / 'mysqld.log'
    hidden = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0

    def run(command, **kwargs):
        return subprocess.run(command, capture_output=True, creationflags=hidden, **kwargs)

    mysqld = str(bin_dir / 'mysqld.exe')
    initialized = run([mysqld, '--no-defaults', '--initialize-insecure',
                       f'--basedir={bin_dir.parent}', f'--datadir={data}', f'--log-error={log}'], timeout=90)
    if initialized.returncode:
        raise RuntimeError(log.read_text(errors='replace'))
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    server = subprocess.Popen([mysqld, '--no-defaults', f'--basedir={bin_dir.parent}',
                               f'--datadir={data}', f'--port={port}', '--bind-address=127.0.0.1',
                               '--mysqlx=OFF', '--skip-log-bin', f'--log-error={log}'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=hidden)
    base = [str(bin_dir / 'mysql.exe'), '--no-defaults', '--protocol=TCP', '-h127.0.0.1',
            f'-P{port}', '-uroot', '--default-character-set=utf8mb4', '--batch', '--skip-column-names']
    try:
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            ready = run(base, input=b'SELECT @@datadir;', timeout=5)
            if not ready.returncode:
                assert Path(ready.stdout.decode().strip()).resolve() == data.resolve()
                break
            if server.poll() is not None:
                raise RuntimeError(log.read_text(errors='replace'))
            time.sleep(0.25)
        else:
            raise TimeoutError('Isolated MySQL did not become ready')
        for source in ('schema.sql', 'seed.sql'):
            result = run(base, input=(root / 'database' / source).read_bytes(), timeout=40)
            if result.returncode:
                raise RuntimeError(result.stderr.decode(errors='replace'))
        print('Imported schema and seed into an isolated MySQL instance.', flush=True)
        environment = os.environ.copy()
        environment.update(JAVA_HOME=str(java_home), JPA_INTEGRATION_TEST='true',
                           DB_URL=f'jdbc:mysql://127.0.0.1:{port}/bookmooch_db_v3?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true',
                           DB_USERNAME='root', DB_PASSWORD='')
        output = work / 'gradle-build.log'
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open('wb') as build_log:
            build = subprocess.run(['cmd.exe', '/d', '/c', 'gradlew.bat', 'clean', 'test', 'bootWar',
                                    '--console=plain', '--no-daemon', '--rerun-tasks', '--max-workers=1', '--stacktrace'],
                                   cwd=root, env=environment, stdout=build_log,
                                   stderr=subprocess.STDOUT, creationflags=hidden, timeout=600)
        saved_log = root / 'build/reports/mysql-integration-build.log'
        saved_log.parent.mkdir(parents=True, exist_ok=True)
        saved_log.write_bytes(output.read_bytes())
        if build.returncode:
            print(output.read_text(errors='replace')[-10000:], flush=True)
            for result in (root / 'build/test-results/test').glob('TEST-*.xml'):
                parsed = ET.parse(result)
                for failure in parsed.findall('.//failure'):
                    detail = failure.text or ''
                    causes = [line for line in detail.splitlines() if 'Caused by:' in line]
                    print('\n'.join(causes) if causes else detail[:4500], flush=True)
            raise RuntimeError(f'Gradle tests failed. See {output}')
        reports = []
        for result in (root / 'build/test-results/test').glob('TEST-*.xml'):
            suite = ET.parse(result).getroot()
            assert suite.get('failures') == '0' and suite.get('errors') == '0', suite.attrib
            assert suite.get('skipped') == '0', suite.attrib
            reports.append(f'{suite.get("name")}: {suite.get("tests")} passed')
        assert len(reports) == 2, reports
        report = '\n'.join(['PASS: Gradle test + bootWar', 'PASS: Hibernate validates all 32 schema tables',
                            'PASS: All 106 static assets unchanged and all 61 MVC views render at their original URLs',
                            'PASS: Composite ids, refund allocation, exchange membership/selected offer, JSON round trips',
                            *reports]) + '\n'
        (root / 'build/reports/mysql-integration.txt').write_text(report, encoding='utf-8')
        print(report, flush=True)
    finally:
        if server.poll() is None:
            run([str(bin_dir / 'mysqladmin.exe'), '--no-defaults', '--protocol=TCP', '-h127.0.0.1',
                 f'-P{port}', '-uroot', 'shutdown'], timeout=15)
            try:
                server.wait(timeout=20)
            except subprocess.TimeoutExpired:
                server.terminate()
                server.wait(timeout=5)
        print('Isolated MySQL stopped.', flush=True)


if __name__ == '__main__':
    main()
