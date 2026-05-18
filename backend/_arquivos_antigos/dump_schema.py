import sqlite3

def dump_schema():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    for table_row in tables:
        table_name = table_row['name']
        print(f"--- Table: {table_name} ---")
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  {col['name']} ({col['type']})")
        print()
    
    conn.close()

if __name__ == "__main__":
    dump_schema()
