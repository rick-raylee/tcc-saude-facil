import sqlite3
import os

db_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\db.sqlite3'

def inspect_db():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # List tables
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cur.fetchall()
    print("Tables in database:")
    for table in tables:
        print(f"- {table[0]}")
        # Count rows
        cur.execute(f"SELECT COUNT(*) FROM {table[0]}")
        count = cur.fetchone()[0]
        print(f"  Rows: {count}")
    
    # Check users and their types
    if ('usuarios',) in tables:
        print("\nUser counts by type:")
        cur.execute("SELECT tipo, COUNT(*) FROM usuarios GROUP BY tipo")
        for row in cur.fetchall():
            print(f"- {row[0]}: {row[1]}")

    conn.close()

if __name__ == "__main__":
    inspect_db()
