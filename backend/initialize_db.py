import sqlite3
import os
import re
from werkzeug.security import generate_password_hash

# Caminho absoluto para o banco de dados
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def setup_database():
    print(f"--- Iniciando Verificação do Banco de Dados: {DB_PATH} ---")
    
    if not os.path.exists(os.path.dirname(DB_PATH)):
        os.makedirs(os.path.dirname(DB_PATH))
        print("Diretório do banco criado.")

    db = get_db()
    cursor = db.cursor()

    # 1. Criar Tabelas (Baseado no sql sus.sql)
    print("Verificando tabelas...")
    
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT UNIQUE,
      sus TEXT,
      email TEXT UNIQUE,
      senha TEXT NOT NULL,
      imagem TEXT,
      tipo TEXT CHECK(tipo IN ('paciente','medico','enfermeiro','admin')) DEFAULT 'paciente',
      telefone TEXT,
      cidade TEXT,
      bairro TEXT,
      data_nascimento TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medico_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER UNIQUE,
      crm TEXT,
      especialidade TEXT,
      atende_telemedicina INTEGER DEFAULT 0,
      tipo_atendimento TEXT DEFAULT 'presencial',
      bio TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enfermeiro_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER UNIQUE,
      coren TEXT,
      funcao TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
    """)

    # 2. Inserir Usuários de Teste (se não existirem)
    users = [
        # NOME, CPF, EMAIL, SENHA, TIPO
        ("PACIENTE TESTE", "32323254353", "paciente@teste.com", "123456", "paciente"),
        ("DR. RICARDO", "11122233344", "medico@teste.com", "123456", "medico"),
        ("ENF. MARIA", "55566677788", "enfermeiro@teste.com", "123456", "enfermeiro"),
        ("ADMINISTRADOR", "99900011122", "admin@teste.com", "admin123", "admin")
    ]

    for nome, cpf, email, senha, tipo in users:
        cursor.execute("SELECT id FROM usuarios WHERE cpf = ?", (cpf,))
        if not cursor.fetchone():
            hashed_pw = generate_password_hash(senha)
            cursor.execute("""
                INSERT INTO usuarios (nome, cpf, email, senha, tipo)
                VALUES (?, ?, ?, ?, ?)
            """, (nome, cpf, email, hashed_pw, tipo))
            print(f"Usuário criado: {tipo.upper()} - {nome} (CPF: {cpf})")
        else:
            # Garantir que a senha está correta caso tenha mudo o método de hash
            hashed_pw = generate_password_hash(senha)
            cursor.execute("UPDATE usuarios SET senha = ? WHERE cpf = ?", (hashed_pw, cpf))
            print(f"Usuário atualizado: {nome}")

    db.commit()

    # 3. Validar contagem
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    total = cursor.fetchone()[0]
    print(f"--- Sucesso! Total de usuários no banco: {total} ---")
    
    db.close()

if __name__ == "__main__":
    setup_database()
