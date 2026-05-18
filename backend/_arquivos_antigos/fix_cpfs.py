import sqlite3
import os
import re

def fix_cpfs():
    db_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\database.db'
    if not os.path.exists(db_path):
        print(f"Banco não encontrado em: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        cur.execute("SELECT id, cpf FROM usuarios")
        rows = cur.fetchall()
        
        count = 0
        for row in rows:
            user_id = row[0]
            cpf_raw = row[1]
            if cpf_raw:
                cpf_limpo = re.sub(r'\D', '', cpf_raw)
                if cpf_limpo != cpf_raw:
                    cur.execute("UPDATE usuarios SET cpf = ? WHERE id = ?", (cpf_limpo, user_id))
                    count += 1
        
        conn.commit()
        print(f"Sincronizacao concluida! {count} CPFs foram limpos no banco de dados.")
        
    except Exception as e:
        print(f"Erro ao atualizar CPFs: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    fix_cpfs()
