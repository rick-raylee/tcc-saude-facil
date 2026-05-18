import sqlite3
from werkzeug.security import generate_password_hash

db_path = 'database.db'

users = [
    {"nome": "Admin Teste", "cpf": "11111111111", "tipo": "admin", "senha": "123"},
    {"nome": "Paciente Teste", "cpf": "22222222222", "tipo": "paciente", "senha": "123"},
    {"nome": "Médico Teste", "cpf": "33333333333", "tipo": "medico", "senha": "123", "atende_telemedicina": 0},
    {"nome": "Médico Telemedicina", "cpf": "66666666666", "tipo": "medico", "senha": "123", "atende_telemedicina": 1},
    {"nome": "Enfermeiro Teste", "cpf": "44444444444", "tipo": "enfermeiro", "senha": "123"}
]

def seed():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    for u in users:
        senha_hash = generate_password_hash(u['senha'])
        # Check if exists
        cur.execute("SELECT id FROM usuarios WHERE cpf = ?", (u['cpf'],))
        row = cur.fetchone()
        
        if row:
            atende = u.get('atende_telemedicina', 0)
            cur.execute("UPDATE usuarios SET nome = ?, tipo = ?, senha = ?, atende_telemedicina = ? WHERE cpf = ?", 
                        (u['nome'], u['tipo'], senha_hash, atende, u['cpf']))
            print(f"Atualizado: {u['nome']} ({u['tipo']}) - CPF: {u['cpf']} - Senha: {u['senha']}")
        else:
            atende = u.get('atende_telemedicina', 0)
            cur.execute("INSERT INTO usuarios (nome, cpf, tipo, senha, atende_telemedicina) VALUES (?, ?, ?, ?, ?)",
                        (u['nome'], u['cpf'], u['tipo'], senha_hash, atende))
            print(f"Criado: {u['nome']} ({u['tipo']}) - CPF: {u['cpf']} - Senha: {u['senha']}")
            
    conn.commit()
    conn.close()

if __name__ == '__main__':
    seed()
