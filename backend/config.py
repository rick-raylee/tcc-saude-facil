import os

def check_writable(path):
    try:
        os.makedirs(path, exist_ok=True)
        test_file = os.path.join(path, '.write_test')
        with open(test_file, 'w') as f:
            f.write('1')
        os.remove(test_file)
        return True
    except Exception:
        return False

class Config:
    SECRET_KEY = 'tcc-sus-2026-secret-key'
    
    # SQLite e uploads
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Se estiver rodando no Render com Persistent Disk montado em /data
    if os.environ.get('RENDER') and check_writable('/data'):
        DATABASE_PATH = '/data/database.db'
        UPLOADS_FOLDER = '/data/uploads'
        print("--> [Config] Armazenamento persistente detectado em /data")
    else:
        DATABASE_PATH = os.path.join(BASE_DIR, 'database.db')
        UPLOADS_FOLDER = os.path.join(BASE_DIR, 'uploads')
        print(f"--> [Config] Usando armazenamento local em: {DATABASE_PATH}")
