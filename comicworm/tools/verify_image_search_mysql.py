"""Verify image search queries on disposable MySQL; never connects to the configured app database."""
from pathlib import Path
import argparse
import os
import socket
import subprocess
import tempfile
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mysql-bin", type=Path, default=Path(r"C:\Program Files\MySQL\MySQL Server 9.0\bin"))
    parser.add_argument("--java-home", type=Path, default=Path(r"C:\Users\PC\.jdks\ms-21.0.11"))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    report = root / "build/reports"
    report.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="image-search-mysql-", dir=root / "build"))
    data, log = work / "data", work / "mysql.log"
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

    def run(command, **kwargs):
        return subprocess.run(command, capture_output=True, creationflags=flags, **kwargs)

    mysql_bin = args.mysql_bin.resolve()
    initialized = run([str(mysql_bin / "mysqld.exe"), "--no-defaults", "--initialize-insecure",
                       f"--basedir={mysql_bin.parent}", f"--datadir={data}", f"--log-error={log}"], timeout=90)
    if initialized.returncode:
        raise RuntimeError(log.read_text(errors="replace"))
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    server = subprocess.Popen([str(mysql_bin / "mysqld.exe"), "--no-defaults",
                              f"--basedir={mysql_bin.parent}", f"--datadir={data}", f"--port={port}",
                              "--bind-address=127.0.0.1", "--mysqlx=OFF", "--skip-log-bin", f"--log-error={log}"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
    connection = [str(mysql_bin / "mysql.exe"), "--no-defaults", "--protocol=TCP", "-h127.0.0.1",
                  f"-P{port}", "-uroot", "--default-character-set=utf8mb4", "--batch", "--skip-column-names"]
    try:
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            ready = run(connection, input=b"SELECT @@datadir;", timeout=3)
            if ready.returncode == 0:
                assert Path(ready.stdout.decode().strip()).resolve() == data.resolve()
                break
            if server.poll() is not None:
                raise RuntimeError(log.read_text(errors="replace"))
            time.sleep(.25)
        else:
            raise TimeoutError("Disposable MySQL did not start")
        for name in ("schema.sql", "seed.sql"):
            result = run(connection, input=(root / "database" / name).read_bytes(), timeout=40)
            if result.returncode:
                raise RuntimeError(result.stderr.decode(errors="replace"))
        environment = os.environ.copy()
        environment.update(JAVA_HOME=str(args.java_home.resolve()), IMAGE_SEARCH_MYSQL_TEST="true",
                           IMAGE_SEARCH_TEST_DB_URL=f"jdbc:mysql://127.0.0.1:{port}/bookmooch_db_v3?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true")
        output = report / "image-search-mysql.log"
        with output.open("wb") as stream:
            result = subprocess.run(["cmd.exe", "/d", "/c", "gradlew.bat", "test", "--tests",
                                     "*ImageSearchRepositoryMySqlTests", "--offline", "--no-daemon", "--console=plain"],
                                    cwd=root, env=environment, stdout=stream, stderr=subprocess.STDOUT,
                                    creationflags=flags, timeout=300)
        print(output.read_text(errors="replace")[-9000:])
        if result.returncode:
            raise RuntimeError(f"Image search MySQL tests failed; see {output}")
        print("PASS: image search model filtering, product visibility, keyset batches and JSON embeddings on MySQL.")
    finally:
        server.terminate()
        try:
            server.wait(timeout=20)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)


if __name__ == "__main__":
    main()
