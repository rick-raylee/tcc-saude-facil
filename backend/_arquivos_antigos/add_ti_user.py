import sqlite3
from werkzeug.security import generate_password_hash
import os

def add_ti_user():
    db_path = os.path.join('backend', 'db.sqlite3')
    print(f"Connecting to: {os.path.abspath(db_path)}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    nome = "TI Admin"
    cpf = "111.111.111-11"
    senha = generate_password_hash("ti2026")
    tipo = "ti"
    
    try:
        # Check if exists first
        cur.execute("SELECT id FROM usuarios WHERE cpf=?", (cpf,))
        if cur.fetchone():
            print(f"Usuário com CPF {cpf} já existe.")
            # Update it just in case
            cur.execute("UPDATE usuarios SET tipo=?, nome=? WHERE cpf=?", (tipo, nome, cpf))
            print("Tipo atualizado para 'ti'.")
        else:
            cur.execute("INSERT INTO usuarios (nome, cpf, senha, tipo) VALUES (?, ?, ?, ?)", (nome, cpf, senha, tipo))
            print(f"Usuário TI criado com sucesso: {nome}")
        conn.commit()
    except Exception as e:
        print(f"Erro detalhado: {type(e).__name__}: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_ti_user()
