
import sqlite3
import os

db_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\database.db'

def test_query(cpf_to_test):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    CPF_SQL_NORMALIZADO = "REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '')"
    
    print(f"Testing CPF: '{cpf_to_test}'")
    
    # Try exact match
    cur.execute("SELECT id, nome, cpf FROM usuarios WHERE cpf = ?", (cpf_to_test,))
    res1 = cur.fetchone()
    print(f"Exact match result: {dict(res1) if res1 else 'None'}")
    
    # Try normalized match
    cur.execute(f"SELECT id, nome, cpf FROM usuarios WHERE {CPF_SQL_NORMALIZADO} = ?", (cpf_to_test,))
    res2 = cur.fetchone()
    print(f"Normalized match result: {dict(res2) if res2 else 'None'}")
    
    conn.close()

if __name__ == "__main__":
    test_query('32323254353')
