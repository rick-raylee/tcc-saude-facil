import sqlite3
import os

# Baseado no app.py, as rotas usam o banco em backend/db.sqlite3
db_path = os.path.join('backend', 'db.sqlite3')

def migrate():
    if not os.path.exists(db_path):
        print(f"Erro: Banco de dados não encontrado em {db_path}")
        return

    print(f"Iniciando migração no banco: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 1. medico_info additions
    print("Atualizando medico_info...")
    try:
        cur.execute("ALTER TABLE medico_info ADD COLUMN unidade_vinculada TEXT")
        print("  - Coluna unidade_vinculada adicionada.")
    except sqlite3.OperationalError as e:
        print(f"  - unidade_vinculada: {e}")

    try:
        cur.execute("ALTER TABLE medico_info ADD COLUMN horarios_tele_json TEXT")
        print("  - Coluna horarios_tele_json adicionada.")
    except sqlite3.OperationalError as e:
        print(f"  - horarios_tele_json: {e}")

    # 2. Add signature fields to docs
    print("Atualizando atestados e receitas...")
    try:
        cur.execute("ALTER TABLE atestados ADD COLUMN assinatura_digital TEXT")
        print("  - Coluna assinatura_digital adicionada em atestados.")
    except sqlite3.OperationalError as e:
        print(f"  - assinatura_digital (atestados): {e}")

    try:
        cur.execute("ALTER TABLE receitas ADD COLUMN assinatura_digital TEXT")
        print("  - Coluna assinatura_digital adicionada em receitas.")
    except sqlite3.OperationalError as e:
        print(f"  - assinatura_digital (receitas): {e}")

    # 3. Create Declaracoes table
    print("Criando tabela declaracoes...")
    cur.execute('''
    CREATE TABLE IF NOT EXISTS declaracoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consulta_id INTEGER,
      medico_id INTEGER,
      paciente_id INTEGER,
      data TEXT,
      horario TEXT,
      assinatura_digital TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (consulta_id) REFERENCES consultas(id),
      FOREIGN KEY (medico_id) REFERENCES usuarios(id),
      FOREIGN KEY (paciente_id) REFERENCES usuarios(id)
    );
    ''')
    print("  - Tabela declaracoes verificada/criada.")

    conn.commit()
    conn.close()
    print("Migração concluída com sucesso!")

if __name__ == '__main__':
    migrate()
