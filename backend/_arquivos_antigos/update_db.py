import sqlite3
import os

def update_db():
    db_path = os.path.join(os.path.dirname(__file__), 'db.sqlite3')
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 1. NOTICIAS
    columns_noticias = [
        ("resumo", "TEXT"), ("cliques", "INTEGER DEFAULT 0"),
        ("status", "TEXT DEFAULT 'publicado'"), ("data_publicacao", "TEXT"),
        ("destaque_carrossel", "INTEGER DEFAULT 0"), ("prioridade", "INTEGER DEFAULT 0"),
        ("categoria", "TEXT")
    ]
    for col, dtype in columns_noticias:
        try: cur.execute(f"ALTER TABLE noticias ADD COLUMN {col} {dtype};")
        except sqlite3.OperationalError: pass

    # 2. CARROSSEL
    columns_carrossel = [
        ("link", "TEXT"), ("ativo", "INTEGER DEFAULT 1"),
        ("subtitulo", "TEXT"), ("texto", "TEXT"), ("ordem", "INTEGER DEFAULT 0"),
        ("status", "INTEGER DEFAULT 1")
    ]
    for col, dtype in columns_carrossel:
        try: cur.execute(f"ALTER TABLE carrossel ADD COLUMN {col} {dtype};")
        except sqlite3.OperationalError: pass

    # 3. ESTATÍSTICAS
    cur.execute('''
    CREATE TABLE IF NOT EXISTS estatisticas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT,
        descricao TEXT,
        texto TEXT,
        valor TEXT,
        detalhe TEXT,
        icone TEXT,
        cor TEXT,
        status INTEGER DEFAULT 1
    );
    ''')
    try: cur.execute("ALTER TABLE estatisticas ADD COLUMN detalhe TEXT;")
    except sqlite3.OperationalError: pass
    try: cur.execute("ALTER TABLE estatisticas ADD COLUMN texto TEXT;")
    except sqlite3.OperationalError: pass
    try: cur.execute("ALTER TABLE estatisticas ADD COLUMN valor TEXT;")
    except sqlite3.OperationalError: pass
    try: cur.execute("ALTER TABLE estatisticas ADD COLUMN valor_mapa TEXT;")
    except sqlite3.OperationalError: pass

    # 4. CAMPANHAS
    try: cur.execute("ALTER TABLE campanhas ADD COLUMN imagem TEXT;")
    except sqlite3.OperationalError: pass
    try: cur.execute("ALTER TABLE campanhas ADD COLUMN data_inicio TEXT;")
    except sqlite3.OperationalError: pass
    try: cur.execute("ALTER TABLE campanhas ADD COLUMN data_fim TEXT;")
    except sqlite3.OperationalError: pass
    try: cur.execute("ALTER TABLE campanhas ADD COLUMN status INTEGER DEFAULT 1;")
    except sqlite3.OperationalError: pass

    # 5. LOGS
    cur.execute('''
    CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT,
        acao TEXT,
        data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ''')
    
    # 6. COMENTARIOS
    try: cur.execute("ALTER TABLE comentarios ADD COLUMN mensagem TEXT;")
    except sqlite3.OperationalError: pass
    try: cur.execute("ALTER TABLE comentarios ADD COLUMN data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    except sqlite3.OperationalError: pass

    # Ensure other tables are updated just in case
    try: cur.execute("ALTER TABLE medico_info ADD COLUMN tipo_atendimento TEXT DEFAULT 'presencial';")
    except sqlite3.OperationalError: pass
    try: cur.execute("ALTER TABLE consultas ADD COLUMN senha_fila TEXT;")
    except sqlite3.OperationalError: pass

    conn.commit()
    conn.close()
    print("Database updated completely.")

if __name__ == '__main__':
    update_db()
