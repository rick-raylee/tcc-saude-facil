import sqlite3
import os

db_path = 'database.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found.")
else:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT nome, cpf, tipo FROM usuarios")
    users = [dict(r) for r in cur.fetchall()]
    for u in users:
        print(u)
    conn.close()
