import sqlite3
import os
from werkzeug.security import generate_password_hash

def create_nurse():
    db_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\database.db'
    if not os.path.exists(db_path):
        print(f"Banco nao encontrado em: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    nome = "ENFERMEIRO TESTE"
    cpf = "12345678910"
    senha = "123456"
    senha_hash = generate_password_hash(senha)
    coren = "123456/PR"
    tipo = "enfermeiro"

    try:
        # Limpar duplicatas antigas de teste se houver
        cur.execute("DELETE FROM usuarios WHERE cpf = ?", (cpf,))
        
        # Inserir usuario
        cur.execute("""
            INSERT INTO usuarios (nome, cpf, senha, tipo)
            VALUES (?, ?, ?, ?)
        """, (nome, cpf, senha_hash, tipo))
        
        usuario_id = cur.lastrowid
        
        # Inserir enfermeiro_info
        cur.execute("""
            INSERT INTO enfermeiro_info (usuario_id, coren, funcao)
            VALUES (?, ?, ?)
        """, (usuario_id, coren, "Enfermeiro"))
        
        conn.commit()
        print(f"Conta de Teste Criada com Sucesso!")
        print(f"CPF: {cpf}")
        print(f"Senha: {senha}")
        
    except Exception as e:
        print(f"Erro ao criar conta de teste: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    create_nurse()
