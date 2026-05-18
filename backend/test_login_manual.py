import sqlite3
from werkzeug.security import check_password_hash

DB_PATH = r"c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\database.db"

def test_login(cpf_to_test, senha_to_test):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    print(f"Testando login para CPF: {cpf_to_test}")
    
    # Simula a normalização que o Flask faz
    cpf_limpo = "".join(filter(str.isdigit, cpf_to_test))
    
    cur.execute("SELECT * FROM usuarios WHERE cpf = ? OR REPLACE(REPLACE(cpf, '.', ''), '-', '') = ?", (cpf_limpo, cpf_limpo))
    user = cur.fetchone()
    
    if not user:
        print("[-] Erro: Usuário não encontrado no banco.")
        # Mostra o que tem lá
        cur.execute("SELECT cpf FROM usuarios LIMIT 5")
        print("CPFs no banco:", [r[0] for r in cur.fetchall()])
    else:
        print(f"[+] Usuário encontrado: {user['nome']}")
        if check_password_hash(user['senha'], senha_to_test):
            print("[+] Senha CORRETA!")
        else:
            print("[-] Erro: Senha INCORRETA.")
            print(f"Hash no banco: {user['senha'][:20]}...")

    conn.close()

if __name__ == "__main__":
    test_login("32323254353", "123456")
