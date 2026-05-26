import sqlite3
from werkzeug.security import generate_password_hash
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

users = [
    # Perfis Genéricos/Originais
    {"nome": "Admin Teste", "cpf": "11111111111", "tipo": "admin", "senha": "123"},
    {"nome": "Paciente Teste", "cpf": "22222222222", "tipo": "paciente", "senha": "123"},
    {"nome": "Médico Teste", "cpf": "33333333333", "tipo": "medico", "senha": "123", "crm": "CRM/SP-12345", "especialidade": "Clínico Geral", "tipo_atendimento": "presencial", "atende_telemedicina": 0},
    {"nome": "Médico Telemedicina", "cpf": "66666666666", "tipo": "medico", "senha": "123", "crm": "CRM/SP-66666", "especialidade": "Cardiologista", "tipo_atendimento": "telemedicina", "atende_telemedicina": 1},
    {"nome": "Enfermeiro Teste", "cpf": "44444444444", "tipo": "enfermeiro", "senha": "123", "coren": "COREN/SP-12345", "funcao": "Enfermeiro"},
    
    # Perfis Específicos do TCC (Senhas Unificadas para '123')
    {"nome": "Ricardo Marchi", "cpf": "32323254353", "tipo": "admin", "senha": "123", "email": "ricardo@teste.com", "sus": "7000045612349988"},
    {"nome": "DR. RICARDO", "cpf": "11122233344", "tipo": "medico", "senha": "123", "email": "medico@teste.com", "crm": "CRM/PR-99999", "especialidade": "Cardiologista", "tipo_atendimento": "ambos", "atende_telemedicina": 1},
    {"nome": "ENF. MARIA", "cpf": "55566677788", "tipo": "enfermeiro", "senha": "123", "email": "enfermeiro@teste.com", "coren": "COREN/PR-88888", "funcao": "Enfermeira Chefe"},
    {"nome": "ADMINISTRADOR", "cpf": "99900011122", "tipo": "admin", "senha": "123", "email": "admin@teste.com"},
    
    # Perfis de Telemedicina Avançada
    {"nome": "Dr. Lucas (Telemedicina)", "cpf": "00000000011", "tipo": "medico", "senha": "123", "crm": "CRM/TELE-001", "especialidade": "Clínico Geral", "tipo_atendimento": "telemedicina", "atende_telemedicina": 1},
    {"nome": "Mariana (Paciente Virtual)", "cpf": "00000000022", "tipo": "paciente", "senha": "123", "sus": "700000000000001"},
    
    # Perfil de TI
    {"nome": "Suporte TI", "cpf": "55555555555", "tipo": "ti", "senha": "123"}
]

def seed():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    print(f"--- Iniciando Seed de Usuários em {db_path} ---")
    
    for u in users:
        senha_hash = generate_password_hash(u['senha'])
        cpf = u['cpf']
        tipo = u['tipo']
        nome = u['nome']
        email = u.get('email')
        sus = u.get('sus')
        atende = u.get('atende_telemedicina', 0)
        
        # Verificar se usuário já existe por CPF
        cur.execute("SELECT id FROM usuarios WHERE cpf = ?", (cpf,))
        row = cur.fetchone()
        
        if row:
            usuario_id = row['id']
            cur.execute("""
                UPDATE usuarios 
                SET nome = ?, tipo = ?, senha = ?, email = ?, sus = ?
                WHERE id = ?
            """, (nome, tipo, senha_hash, email, sus, usuario_id))
            print(f"Atualizado: {nome} ({tipo}) - CPF: {cpf}")
        else:
            cur.execute("""
                INSERT INTO usuarios (nome, cpf, tipo, senha, email, sus)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (nome, cpf, tipo, senha_hash, email, sus))
            usuario_id = cur.lastrowid
            print(f"Criado: {nome} ({tipo}) - CPF: {cpf}")
            
        # Inserir detalhes extras na tabela medico_info se for medico
        if tipo == 'medico':
            crm = u.get('crm', 'CRM/PR-00000')
            especialidade = u.get('especialidade', 'Clínico Geral')
            tipo_atendimento = u.get('tipo_atendimento', 'presencial')
            
            cur.execute("SELECT id FROM medico_info WHERE usuario_id = ?", (usuario_id,))
            med_row = cur.fetchone()
            if med_row:
                cur.execute("""
                    UPDATE medico_info 
                    SET crm = ?, especialidade = ?, atende_telemedicina = ?, tipo_atendimento = ?
                    WHERE usuario_id = ?
                """, (crm, especialidade, atende, tipo_atendimento, usuario_id))
            else:
                cur.execute("""
                    INSERT INTO medico_info (usuario_id, crm, especialidade, atende_telemedicina, tipo_atendimento)
                    VALUES (?, ?, ?, ?, ?)
                """, (usuario_id, crm, especialidade, atende, tipo_atendimento))
            print(f"  -> Detalhes de Médico sincronizados (CRM: {crm})")
            
        # Inserir detalhes extras na tabela enfermeiro_info se for enfermeiro
        elif tipo == 'enfermeiro':
            coren = u.get('coren', 'COREN/PR-00000')
            funcao = u.get('funcao', 'Enfermeiro')
            
            cur.execute("SELECT id FROM enfermeiro_info WHERE usuario_id = ?", (usuario_id,))
            enf_row = cur.fetchone()
            if enf_row:
                cur.execute("""
                    UPDATE enfermeiro_info 
                    SET coren = ?, funcao = ?
                    WHERE usuario_id = ?
                """, (coren, funcao, usuario_id))
            else:
                cur.execute("""
                    INSERT INTO enfermeiro_info (usuario_id, coren, funcao)
                    VALUES (?, ?, ?)
                """, (usuario_id, coren, funcao))
            print(f"  -> Detalhes de Enfermagem sincronizados (COREN: {coren})")
            
    conn.commit()
    conn.close()
    print("--- Seed Concluído com Sucesso! ---")

if __name__ == '__main__':
    seed()
