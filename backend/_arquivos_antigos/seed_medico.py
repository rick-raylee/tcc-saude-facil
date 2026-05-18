import sqlite3
import os
from werkzeug.security import generate_password_hash

# Caminho para o banco de dados oficial (database.db)
DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def seed_medico_fixed():
    if not os.path.exists(DB_PATH):
        print(f"Erro: Banco de dados não encontrado em {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Dados do Médico (CPF apenas números como o sistema espera)
    medico_nome = 'DR. MARCOS TESTE'
    medico_cpf_raw = '555.555.555-55'
    medico_cpf = "".join(filter(str.isdigit, medico_cpf_raw)) # '55555555555'
    medico_senha = generate_password_hash('medico123')
    
    # Remover versões antigas com formatação (se existirem) para evitar conflitos
    cur.execute("DELETE FROM usuarios WHERE cpf = '555.555.555-55'")
    
    # Verificar se já existe (versão numérica)
    cur.execute("SELECT id FROM usuarios WHERE cpf = ?", (medico_cpf,))
    user_medico = cur.fetchone()
    
    if not user_medico:
        cur.execute("""
            INSERT INTO usuarios (nome, cpf, senha, tipo, email, telefone, cidade, bairro, sus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (medico_nome, medico_cpf, medico_senha, 'medico', 'marcos@teste.com', '45999991111', 'Cascavel', 'Centro', '1234567890123456'))
        medico_id = cur.lastrowid
        print(f"Usuário Médico '{medico_nome}' criado com CPF {medico_cpf} (ID {medico_id})")
    else:
        medico_id = user_medico[0]
        # Atualizar senha para garantir que seja medico123
        cur.execute("UPDATE usuarios SET senha = ? WHERE id = ?", (medico_senha, medico_id))
        print(f"Usuário Médico '{medico_nome}' atualizado com CPF {medico_cpf} (ID {medico_id})")

    # 2. Inserir na tabela medico_info
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='medico_info'")
    if cur.fetchone():
        cur.execute("SELECT id FROM medico_info WHERE usuario_id = ?", (medico_id,))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO medico_info (usuario_id, crm, especialidade, atende_telemedicina, tipo_atendimento)
                VALUES (?, ?, ?, ?, ?)
            """, (medico_id, '12345/PR', 'Clínica Geral', 1, 'presencial'))
            print("Informações extras do médico criadas.")
        else:
            print("Informações extras do médico já existem.")

    conn.commit()
    conn.close()
    print("Operação concluída com sucesso.")

if __name__ == '__main__':
    seed_medico_fixed()
