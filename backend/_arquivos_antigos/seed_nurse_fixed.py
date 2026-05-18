import sqlite3
import os
from werkzeug.security import generate_password_hash

# Caminho para o banco de dados oficial (database.db)
DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def seed_nurse_fixed():
    if not os.path.exists(DB_PATH):
        print(f"Erro: Banco de dados não encontrado em {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Dados do Enfermeiro (666.666.666-66)
    enf_nome = 'ENF. ANA TESTE'
    enf_cpf = '66666666666'
    enf_senha = generate_password_hash('enfermeiro123')
    
    # Remover versões antigas
    cur.execute("DELETE FROM usuarios WHERE cpf = '66666666666'")
    cur.execute("DELETE FROM usuarios WHERE cpf = '666.666.666-66'")
    
    # Inserir usuário
    cur.execute("""
        INSERT INTO usuarios (nome, cpf, senha, tipo, email, telefone, cidade, bairro, sus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (enf_nome, enf_cpf, enf_senha, 'enfermeiro', 'ana@teste.com', '45999992222', 'Cascavel', 'Centro', '6543210987654321'))
    enf_id = cur.lastrowid
    print(f"Usuário Enfermeiro '{enf_nome}' criado com CPF {enf_cpf} (ID {enf_id})")

    # Inserir na tabela enfermeiro_info
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='enfermeiro_info'")
    if cur.fetchone():
        cur.execute("DELETE FROM enfermeiro_info WHERE usuario_id = ?", (enf_id,))
        cur.execute("""
            INSERT INTO enfermeiro_info (usuario_id, coren, funcao)
            VALUES (?, ?, ?)
        """, (enf_id, '67890/PR', 'Enfermeiro'))
        print("Informações extras do enfermeiro criadas.")

    conn.commit()
    conn.close()
    print("Operação concluída com sucesso.")

if __name__ == '__main__':
    seed_nurse_fixed()
