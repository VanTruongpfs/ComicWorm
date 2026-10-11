"""Add the cover/detail image columns to the configured database without dropping data."""
from pathlib import Path
import os
import re
import subprocess
import urllib.parse

root = Path(__file__).resolve().parents[1]
content = (root / 'src/main/resources/application.properties').read_bytes().decode('latin1')
properties = dict(re.findall(r'^([^#\s][^=\r\n]*)=(.*)$', content, re.M))

def setting(key):
    environment_name = key.upper().replace('.', '_').replace('-', '_')
    if environment_name in os.environ:
        return os.environ[environment_name]
    item = properties.get(key, '').strip()
    match = re.fullmatch(r'\$\{([^:}]+):?(.*?)\}', item)
    return os.environ.get(match[1], match[2]) if match else item

url = urllib.parse.urlparse(setting('spring.datasource.url').removeprefix('jdbc:'))
database = url.path.strip('/')
if database != 'bookmooch_db_v3' or not url.hostname:
    raise ValueError('Expected the configured ComicWorm database bookmooch_db_v3')
environment = os.environ.copy()
environment['MYSQL_PWD'] = setting('spring.datasource.password')
command = [r'C:\Program Files\MySQL\MySQL Server 9.0\bin\mysql.exe', '--no-defaults', '--protocol=TCP',
    '-h' + url.hostname, '-P' + str(url.port or 3306), '-u' + setting('spring.datasource.username'),
    '--default-character-set=utf8mb4', '--batch', '--skip-column-names', database]

def execute(sql):
    result = subprocess.run(command, input=sql, capture_output=True, env=environment,
        creationflags=subprocess.CREATE_NO_WINDOW, timeout=45)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))
    return result.stdout.decode('utf-8', errors='replace').strip()

before = execute(b'SELECT (SELECT COUNT(*) FROM products), (SELECT COUNT(*) FROM product_images);')
execute((root / 'database/migrations/20261008_product_images.sql').read_bytes())
after = execute(b'SELECT (SELECT COUNT(*) FROM products), (SELECT COUNT(*) FROM product_images);')
assert before == after, 'Product and image row counts must be preserved'
print('Product image migration applied; product and image rows preserved.')
print(execute(b"SELECT table_name,column_name,column_type FROM information_schema.columns WHERE table_schema=DATABASE() AND ((table_name='products' AND column_name='cover_image_url') OR (table_name='product_images' AND column_name='image_type')) ORDER BY table_name;"))
