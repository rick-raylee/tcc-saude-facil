import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')
SQL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sql sus.sql')

def init_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print(f"Lendo o script SQL de: {SQL_PATH}")
        with open(SQL_PATH, 'r', encoding='utf-8') as f:
            sql_script = f.read()
            
        print("Executando o script no banco database.db...")
        cursor.executescript(sql_script)
        
        conn.commit()
        conn.close()
        print("Banco de dados inicializado/atualizado com sucesso.")
    except Exception as e:
        print(f"Erro ao inicializar banco: {e}")

if __name__ == '__main__':
    init_db()
