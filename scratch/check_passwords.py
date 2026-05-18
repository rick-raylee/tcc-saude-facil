
import sqlite3
import os
from werkzeug.security import check_password_hash, generate_password_hash

db_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\database.db'

def check():
    if not os.path.exists(db_path):
        print("Database not found")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT cpf, nome, senha FROM usuarios")
    rows = cur.fetchall()
    
    print(f"{'CPF':<15} | {'Nome':<20} | {'Password Matches 123456?'}")
    print("-" * 60)
    
    for row in rows:
        cpf, nome, hashed_pw = row
        matches = check_password_hash(hashed_pw, '123456')
        print(f"{cpf:<15} | {nome:<20} | {matches}")
    
    conn.close()

if __name__ == "__main__":
    check()
