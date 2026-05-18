import sqlite3
import os

DB_PATH = 'backend/db.sqlite3'

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Erro: Banco de dados não encontrado em {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("--- Iniciando Migração de Tabelas de Perfis ---")

    # 1. Garantir que tabelas essenciais existem
    tables_to_create = {
        "paciente_doencas": """
            CREATE TABLE IF NOT EXISTS paciente_doencas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                paciente_id INTEGER,
                nome TEXT,
                FOREIGN KEY (paciente_id) REFERENCES usuarios(id) ON DELETE CASCADE
            )
        """,
        "prescricoes": """
            CREATE TABLE IF NOT EXISTS prescricoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                consulta_id INTEGER,
                paciente_id INTEGER NOT NULL,
                medico_id INTEGER NOT NULL,
                medicamento VARCHAR(150) NOT NULL,
                dosagem VARCHAR(100) NOT NULL,
                frequencia VARCHAR(100) NOT NULL,
                via_administracao VARCHAR(50) NOT NULL,
                duracao VARCHAR(100),
                observacoes TEXT,
                status VARCHAR(50) DEFAULT 'Aguardando Aplicação',
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(consulta_id) REFERENCES consultas(id),
                FOREIGN KEY(paciente_id) REFERENCES usuarios(id),
                FOREIGN KEY(medico_id) REFERENCES usuarios(id)
            )
        """,
        "aplicacoes": """
            CREATE TABLE IF NOT EXISTS aplicacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prescricao_id INTEGER NOT NULL,
                enfermeiro_id INTEGER NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                observacao TEXT,
                lote VARCHAR(100),
                FOREIGN KEY(prescricao_id) REFERENCES prescricoes(id),
                FOREIGN KEY(enfermeiro_id) REFERENCES usuarios(id)
            )
        """
    }

    for table_name, schema in tables_to_create.items():
        print(f"Verificando tabela: {table_name}...")
        cursor.execute(schema)

    # 2. Verificar colunas extras em triagens
    print("Verificando colunas em 'triagens'...")
    cursor.execute("PRAGMA table_info(triagens)")
    cols = [row[1] for row in cursor.fetchall()]
    
    if 'imc' not in cols:
        print("Adicionando coluna 'imc' à tabela 'triagens'...")
        cursor.execute("ALTER TABLE triagens ADD COLUMN imc REAL")

    # 3. Verificar colunas em medico_info
    print("Verificando colunas em 'medico_info'...")
    cursor.execute("PRAGMA table_info(medico_info)")
    cols = [row[1] for row in cursor.fetchall()]
    if 'tipo_atendimento' not in cols:
        print("Adicionando coluna 'tipo_atendimento' à tabela 'medico_info'...")
        cursor.execute("ALTER TABLE medico_info ADD COLUMN tipo_atendimento TEXT DEFAULT 'presencial'")

    conn.commit()
    conn.close()
    print("--- Migração concluída com sucesso! ---")

if __name__ == "__main__":
    migrate()
