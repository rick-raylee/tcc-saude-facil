import sqlite3
import os
from werkzeug.security import check_password_hash

def debug_login(cpf, senha):
    db_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\database.db'
    if not os.path.exists(db_path):
        print(f"Banco nao encontrado em: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    try:
        print(f"Buscando CPF: {cpf}")
        cur.execute("SELECT * FROM usuarios WHERE cpf = ?", (cpf,))
        user = cur.fetchone()
        
        if not user:
            print("ERR: CPF nao encontrado no banco.")
            return

        print(f"OK: Usuario encontrado: {user['nome']}")
        print(f"Tipo: {user['tipo']}")
        
        if check_password_hash(user['senha'], senha):
            print("OK: Senha CORRETA!")
        else:
            print("ERR: Senha INCORRETA!")
            print(f"Hash no banco: {user['senha']}")
            
    except Exception as e:
        print(f"Erro no debug: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    debug_login("12345678910", "123456")
