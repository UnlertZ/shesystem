"""
SQLite to Azure SQL Database Exporter
Extracts data from the existing SQLite database (Cloudflare D1 Miniflare / local SQLite)
and generates:
1. azure_data_seed.sql (T-SQL script with N'...' for Thai text, ready to run in Azure Portal Query Editor)
2. sqlite_dump.json (JSON dump ready for automated programmatic migration)
"""

import os
import sys
import json
import sqlite3
from datetime import datetime

# Set UTF-8 encoding for standard output
sys.stdout.reconfigure(encoding='utf-8')

# Target tables in order of foreign key dependency
TABLES = [
    'departments',
    'positions',
    'users',
    'equipment',
    'inspections',
    'tasks',
    'notifications',
    'user_dismissed_notifications',
    'password_resets',
    'safety_patrols',
    'safety_findings'
]

def find_sqlite_file():
    # 1. Check custom path from command line
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        return sys.argv[1]

    # 2. Check environment variable
    if 'SQLITE_DB_PATH' in os.environ and os.path.isfile(os.environ['SQLITE_DB_PATH']):
        return os.environ['SQLITE_DB_PATH']

    # 3. Search default Miniflare D1 location in project root
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    d1_dir = os.path.join(base_dir, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject')
    
    if os.path.isdir(d1_dir):
        for f in os.listdir(d1_dir):
            if f.endswith('.sqlite') and f != 'metadata.sqlite':
                full_path = os.path.join(d1_dir, f)
                return full_path

    # 4. Search any other .sqlite or .db file in the project
    for root, dirs, files in os.walk(base_dir):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')
        for f in files:
            if (f.endswith('.sqlite') or f.endswith('.db')) and 'metadata' not in f and 'cache' not in root:
                return os.path.join(root, f)

    return None

def format_tsql_value(val):
    if val is None:
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bool):
        return "1" if val else "0"
    
    # Text / String: Escape single quotes and prefix with N for Unicode/Thai support
    str_val = str(val).replace("'", "''")
    return f"N'{str_val}'"

def export():
    db_path = find_sqlite_file()
    if not db_path or not os.path.isfile(db_path):
        print(f"❌ ไม่พบไฟล์ SQLite Database กรุณาระบุ Path ผ่าน: python export-to-azure-sql.py <path_to_sqlite>")
        sys.exit(1)

    print(f"🔍 ตรวจพบไฟล์ SQLite Database ที่: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = set(r[0] for r in cur.fetchall())

    all_data = {}
    sql_lines = [
        "-- ===========================================================================",
        "-- Azure SQL Database - Data Migration Seed Script",
        f"-- Generated at: {datetime.now().isoformat()}",
        f"-- Source: {os.path.basename(db_path)}",
        "-- Description: Inserts data extracted from SQLite into Azure SQL Database",
        "-- ===========================================================================\n",
        "SET NOCOUNT ON;\n"
    ]

    total_rows = 0

    for table in TABLES:
        if table not in existing_tables:
            print(f"  ⏭️  ตาราง [{table}] ไม่มีอยู่ใน SQLite (ข้าม)")
            all_data[table] = []
            continue

        cur.execute(f"SELECT * FROM [{table}]")
        rows = [dict(r) for r in cur.fetchall()]
        all_data[table] = rows
        total_rows += len(rows)

        print(f"  📦 ตาราง [{table}]: พบ {len(rows)} แถว")

        if not rows:
            continue

        sql_lines.append(f"-- -------------------------------------------------------------")
        sql_lines.append(f"-- Data for table: {table} ({len(rows)} records)")
        sql_lines.append(f"-- -------------------------------------------------------------")

        columns = list(rows[0].keys())
        col_list = ", ".join(f"[{c}]" for c in columns)

        for row in rows:
            pk_col = 'id' if 'id' in row else columns[0]
            pk_val = format_tsql_value(row[pk_col])

            val_list = ", ".join(format_tsql_value(row[c]) for c in columns)

            # Idempotent insert: only insert if PK doesn't already exist
            sql_lines.append(
                f"IF NOT EXISTS (SELECT 1 FROM dbo.[{table}] WHERE [{pk_col}] = {pk_val})\n"
                f"BEGIN\n"
                f"    INSERT INTO dbo.[{table}] ({col_list})\n"
                f"    VALUES ({val_list});\n"
                f"END;"
            )
        sql_lines.append("")

    conn.close()

    output_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Write T-SQL Script
    sql_path = os.path.join(output_dir, 'azure_data_seed.sql')
    with open(sql_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))

    # 2. Write JSON Dump
    json_path = os.path.join(output_dir, 'sqlite_dump.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print("\n✅ การดึงข้อมูลเสร็จสมบูรณ์!")
    print(f"📊 รวมข้อมูลทั้งหมด {total_rows} แถว")
    print(f"📄 บันทึกไฟล์ T-SQL สำหรับรันบน Azure Query Editor: {sql_path}")
    print(f"📄 บันทึกไฟล์ JSON สำหรับ Migration อัตโนมัติ: {json_path}")

if __name__ == '__main__':
    export()
