import sqlite3
import traceback

DB_PATH = "C:/Users/ricar/Desktop/tcc ceep/backend/database.db"

def test_queries():
    print("Iniciando testes de queries no banco de dados...")
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 1. Testar tabela de usuários
        print("\\n--- Testando tabela 'usuarios' ---")
        cursor.execute("SELECT count(*) FROM usuarios")
        count = cursor.fetchone()[0]
        print(f"Total de usuários cadastrados: {count}")
        
        # 2. Testar tabela de médicos_info e join
        print("\\n--- Testando tabela 'medico_info' e JOIN ---")
        cursor.execute('''
            SELECT u.nome, m.especialidade 
            FROM usuarios u 
            JOIN medico_info m ON u.id = m.usuario_id 
            LIMIT 5
        ''')
        medicos = cursor.fetchall()
        print(f"Médicos encontrados: {len(medicos)}")
        
        # 3. Testar tabela de consultas e joins mais complexos
        print("\\n--- Testando tabela 'consultas' e JOIN múltiplos ---")
        try:
            cursor.execute('''
                SELECT c.id, p.nome as paciente, m.nome as medico, c.data, c.status
                FROM consultas c
                LEFT JOIN usuarios p ON c.paciente_id = p.id
                LEFT JOIN usuarios m ON c.medico_id = m.id
                LIMIT 5
            ''')
            consultas = cursor.fetchall()
            print(f"Consultas (ok): {len(consultas)}")
        except Exception as e:
            print(f"ERRO ao consultar 'consultas': {e}")
            
        # 4. Testar tabela de telemedicina/prontuarios
        print("\\n--- Testando tabelas relacionadas a Prontuários e Telemedicina ---")
        tables_to_check = ['prontuarios', 'receitas', 'atestados', 'exames', 'prescricoes', 'aplicacoes']
        for table in tables_to_check:
            try:
                cursor.execute(f"SELECT count(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"Tabela '{table}' (ok) - {count} registros")
            except Exception as e:
                print(f"ERRO na tabela '{table}': {e}")

        # 5. Listar todas as tabelas para garantir que correspondem ao sql_sus.sql
        print("\\n--- Verificando todas as tabelas no banco ---")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"Tabelas encontradas: {len(tables)}")
        
        conn.close()
        print("\\nTestes de leitura finalizados.")
        
    except Exception as e:
        print(f"ERRO FATAL DE CONEXÃO: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    test_queries()
