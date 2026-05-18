import sqlite3
import os

db_path = os.path.join('backend', 'db.sqlite3')
if not os.path.exists(db_path):
    print(f"Erro: Banco não encontrado em {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT nome, cpf, tipo FROM usuarios WHERE tipo='admin'")
users = [dict(r) for r in cur.fetchall()]
print(users)
conn.close()
