import sqlite3
import os
from werkzeug.security import generate_password_hash

def seed():
    # Caminho do banco
    db_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\database.db'
    if not os.path.exists(db_path):
        print(f"Erro: Banco não encontrado em {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    nome = "DRA. TELEMEDICINE TESTE"
    cpf = "33634643636"
    senha = generate_password_hash("123")
    tipo = "medico"

    try:
        # Verificar se já existe
        cur.execute("SELECT id FROM usuarios WHERE cpf = ?", (cpf,))
        if cur.fetchone():
            print("Usuário já existe. Pulando inserção.")
        else:
            cur.execute("""
                INSERT INTO usuarios (nome, cpf, senha, tipo)
                VALUES (?, ?, ?, ?)
            """, (nome, cpf, senha, tipo))
            usuario_id = cur.lastrowid
            
            # Info médica
            cur.execute("""
                INSERT INTO medico_info (usuario_id, crm, especialidade, atende_telemedicina, tipo_atendimento)
                VALUES (?, ?, ?, ?, ?)
            """, (usuario_id, "99999/PR", "Telemedicina", 1, "telemedicina"))
            
            print(f"Usuário {nome} registrado com sucesso!")
        
        conn.commit()
    except Exception as e:
        print(f"Erro ao inserir: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    seed()
