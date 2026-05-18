import sqlite3
import os

def check_nurses():
    db_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\database.db'
    if not os.path.exists(db_path):
        print(f"Banco nao encontrado em: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        cur.execute("SELECT id, nome, cpf, tipo FROM usuarios WHERE tipo = 'enfermeiro'")
        rows = cur.fetchall()
        
        if not rows:
            print("Nenhum enfermeiro encontrado no banco de dados.")
        else:
            print(f"Encontrados {len(rows)} enfermeiros:")
            for row in rows:
                print(f"ID: {row[0]}, Nome: {row[1]}, CPF: {row[2]}, Tipo: {row[3]}")
                
    except Exception as e:
        print(f"Erro ao consultar enfermeiros: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    check_nurses()
