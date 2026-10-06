"""Generate the database limited to Nhom8_ChucNang.docx.

Run: python database/build_schema.py
Edit schema_model.py, then regenerate SQL and both DBML files.
Previous broad schema is retained only in archive/v2.
"""
import schema_model
from schema_tools import emit

if __name__ == '__main__':
    emit()
