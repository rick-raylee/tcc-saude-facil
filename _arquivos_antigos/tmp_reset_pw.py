import sqlite3
import os
from werkzeug.security import generate_password_hash

db_path = os.path.join('backend', 'db.sqlite3')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

new_password_hash = generate_password_hash('admin123')
cur.execute("UPDATE usuarios SET senha = ? WHERE cpf = ?", (new_password_hash, '323.232.543-53'))
conn.commit()
print("Senha do Admin atualizada para 'admin123'")
conn.close()
