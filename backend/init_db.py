import sqlite3
import os

def init_db():
    from app import app
    # Caminho do banco (via config) e do script SQL
    db_path = app.config['DATABASE_PATH']
    sql_path = os.path.join(os.path.dirname(__file__), '..', 'sql sus.sql')

    print(f"Iniciando criação do banco SQLite em: {db_path}")

    # Conectar (cria o arquivo se não existir)
    conn = sqlite3.connect(db_path)
    
    try:
        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # Executar script
        conn.executescript(sql_script)
        conn.commit()
        print("Banco de dados SQLite criado com sucesso!")
        
    except Exception as e:
        print(f"Erro ao criar banco: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    init_db()
