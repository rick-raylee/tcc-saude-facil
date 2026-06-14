import os

class Config:
    SECRET_KEY = 'tcc-sus-2026-secret-key'
    
    # SQLite e uploads
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Se estiver rodando no Render (com disco persistente), salvamos no Persistent Disk (/data)
    if os.environ.get('RENDER') or os.path.exists('/data'):
        DATABASE_PATH = '/data/database.db'
        UPLOADS_FOLDER = '/data/uploads'
    else:
        DATABASE_PATH = os.path.join(BASE_DIR, 'database.db')
        UPLOADS_FOLDER = os.path.join(BASE_DIR, 'uploads')
