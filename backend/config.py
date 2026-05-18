import os

class Config:
    SECRET_KEY = 'tcc-sus-2026-secret-key'
    
    # SQLite
    # Preferimos o banco legado com dados já populados para a home.
    BASE_DIR = os.path.dirname(__file__)
    DATABASE_PATH = os.path.join(BASE_DIR, 'database.db')
