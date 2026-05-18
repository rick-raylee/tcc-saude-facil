import sqlite3
import os
from werkzeug.security import generate_password_hash

# Caminho para o banco de dados
DB_PATH = os.path.join(os.path.dirname(__file__), 'db.sqlite3')

def seed_data():
    if not os.path.exists(DB_PATH):
        print(f"Erro: Banco de dados não encontrado em {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Criar Médico de Teste
    medico_cpf = '555.555.555-55'
    medico_senha = generate_password_hash('medico123')
    
    # Verificar se já existe
    cur.execute("SELECT id FROM usuarios WHERE cpf = ?", (medico_cpf,))
    user_medico = cur.fetchone()
    
    if not user_medico:
        cur.execute("""
            INSERT INTO usuarios (nome, cpf, senha, tipo, email, telefone, cidade, bairro, sus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('DR. MARCOS TESTE', medico_cpf, medico_senha, 'medico', 'marcos@teste.com', '45999991111', 'Cascavel', 'Centro', '1234567890123456'))
        medico_id = cur.lastrowid
        print(f"Usuário Médico criado: ID {medico_id}")
    else:
        medico_id = user_medico[0]
        print(f"Usuário Médico já existe: ID {medico_id}")

    # Inserir/Atualizar informações extras do médico
    cur.execute("SELECT id FROM medico_info WHERE usuario_id = ?", (medico_id,))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO medico_info (usuario_id, crm, especialidade, atende_telemedicina, tipo_atendimento)
            VALUES (?, ?, ?, ?, ?)
        """, (medico_id, '12345/PR', 'Clínica Geral', 1, 'presencial'))
        print("medico_info criado.")
    else:
        print("medico_info já existe.")

    # 2. Criar Enfermeiro de Teste
    enf_cpf = '666.666.666-66'
    enf_senha = generate_password_hash('enfermeiro123')
    
    cur.execute("SELECT id FROM usuarios WHERE cpf = ?", (enf_cpf,))
    user_enf = cur.fetchone()
    
    if not user_enf:
        cur.execute("""
            INSERT INTO usuarios (nome, cpf, senha, tipo, email, telefone, cidade, bairro, sus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('ENF. ANA TESTE', enf_cpf, enf_senha, 'enfermeiro', 'ana@teste.com', '45999992222', 'Cascavel', 'Centro', '6543210987654321'))
        enf_id = cur.lastrowid
        print(f"Usuário Enfermeiro criado: ID {enf_id}")
    else:
        enf_id = user_enf[0]
        print(f"Usuário Enfermeiro já existe: ID {enf_id}")

    # Inserir/Atualizar informações extras do enfermeiro
    cur.execute("SELECT id FROM enfermeiro_info WHERE usuario_id = ?", (enf_id,))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO enfermeiro_info (usuario_id, coren, funcao)
            VALUES (?, ?, ?)
        """, (enf_id, '67890/PR', 'Triagem'))
        print("enfermeiro_info criado.")
    else:
        print("enfermeiro_info já existe.")

    conn.commit()
    conn.close()
    print("Semente de dados concluída com sucesso.")

if __name__ == '__main__':
    seed_data()
