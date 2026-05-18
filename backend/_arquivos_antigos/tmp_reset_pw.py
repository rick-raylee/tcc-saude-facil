import sqlite3
from werkzeug.security import generate_password_hash
import os

db_path = 'database.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    updates = [
        ('55555555555', 'medico123'),
        ('66666666666', 'enfermeiro123'),
        ('32323254353', 'admin123'),
        ('12345678910', 'enfermeiro123')
    ]
    
    for cpf, pwd in updates:
        h = generate_password_hash(pwd)
        cur.execute("UPDATE usuarios SET senha = ? WHERE cpf = ?", (h, cpf))
        if cur.rowcount > 0:
            print(f"Senha resetada para CPF {cpf}")
        else:
            print(f"CPF {cpf} não encontrado no banco.")
            
    conn.commit()
    conn.close()
else:
    print("Banco de dados não encontrado.")
