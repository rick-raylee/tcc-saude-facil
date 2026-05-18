import sqlite3
import os

# Caminho do banco de dados (ajuste se necessário)
DB_PATH = 'backend/db.sqlite3'

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Banco de dados não encontrado em {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    migrations = [
        # Tabelas: (Tabela, Coluna, Tipo)
        ('noticias', 'status', "TEXT DEFAULT 'publicado'"),
        ('noticias', 'destaque_carrossel', "INTEGER DEFAULT 0"),
        ('noticias', 'prioridade', "INTEGER DEFAULT 0"),
        ('comentarios', 'mensagem', "TEXT"),
        ('doencas_prevencao', 'especialista', "TEXT"),
        ('doencas_prevencao', 'encaminhamento', "TEXT"),
        ('doencas_prevencao', 'gravidade', "TEXT"),
        ('doencas_prevencao', 'bg_class', "TEXT"),
        ('logs', 'usuario', "TEXT"),
        ('logs', 'data_acao', "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ]

    for table, column, col_type in migrations:
        try:
            print(f"Tentando adicionar {column} em {table}...")
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
            print(f"  OK: {column} adicionado.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"  Pulo: {column} já existe em {table}.")
            else:
                print(f"  ERRO ao adicionar {column} em {table}: {e}")

    # Renomear data para data_acao se necessário (já lidamos acima, mas por precaução)
    try:
        cur.execute("SELECT data FROM logs LIMIT 1")
        # Se chegamos aqui, a coluna 'data' existe. Vamos tentar migrar os dados se 'data_acao' for nova.
        print("Migrando dados da coluna 'data' para 'data_acao' nos logs...")
        cur.execute("UPDATE logs SET data_acao = data WHERE data_acao IS NULL")
    except Exception:
        pass

    conn.commit()
    conn.close()
    print("Migração concluída.")

if __name__ == '__main__':
    migrate()
