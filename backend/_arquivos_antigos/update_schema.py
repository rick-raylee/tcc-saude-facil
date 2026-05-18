import sqlite3
import os

def update_schema():
    db_path = os.path.join('backend', 'db.sqlite3')
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    try:
        # 1. Obter schema atual
        cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='usuarios'")
        old_sql = cur.fetchone()[0]
        
        # 2. Criar novo SQL com 'ti' incluído no CHECK
        new_sql = old_sql.replace(
            "CHECK(tipo IN ('paciente','medico','enfermeiro','admin'))",
            "CHECK(tipo IN ('paciente','medico','enfermeiro','admin','ti'))"
        )
        
        if old_sql == new_sql:
            print("Schema já parece estar atualizado ou padrão não encontrado.")
            return

        print("Atualizando schema da tabela 'usuarios'...")
        
        cur.execute("PRAGMA foreign_keys=OFF")
        cur.execute("BEGIN TRANSACTION")
        
        cur.execute("ALTER TABLE usuarios RENAME TO usuarios_old")
        cur.execute(new_sql)
        
        # Obter colunas para garantir o insert correto
        cur.execute("PRAGMA table_info(usuarios_old)")
        cols = [col[1] for col in cur.fetchall()]
        col_string = ", ".join(cols)
        
        cur.execute(f"INSERT INTO usuarios ({col_string}) SELECT {col_string} FROM usuarios_old")
        
        cur.execute("DROP TABLE usuarios_old")
        
        conn.commit()
        print("Schema atualizado com sucesso!")
        
    except Exception as e:
        conn.rollback()
        print(f"Erro ao atualizar schema: {e}")
    finally:
        cur.execute("PRAGMA foreign_keys=ON")
        conn.close()

if __name__ == "__main__":
    update_schema()
