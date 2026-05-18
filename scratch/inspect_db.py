
import sqlite3
import os

db_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\database.db'

def inspect():
    if not os.path.exists(db_path):
        print(f"ERRO: Banco de dados não encontrado em {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # Listar tabelas
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row['name'] for row in cur.fetchall()]
    print(f"Tabelas encontradas: {', '.join(tables)}")
    
    if 'usuarios' in tables:
        cur.execute("SELECT id, nome, cpf, tipo, senha FROM usuarios")
        users = cur.fetchall()
        print(f"\nUsuários na tabela 'usuarios' ({len(users)}):")
        print(f"{'ID':<3} | {'Nome':<20} | {'CPF':<15} | {'Tipo':<10} | {'Senha Hash'}")
        print("-" * 80)
        for u in users:
            print(f"{u['id']:<3} | {u['nome']:<20} | {u['cpf']:<15} | {u['tipo']:<10} | {u['senha'][:20]}...")
    else:
        print("\nERRO: Tabela 'usuarios' não encontrada!")

    conn.close()

if __name__ == "__main__":
    inspect()
