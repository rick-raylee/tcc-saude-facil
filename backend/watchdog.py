import socket
import subprocess
import time
import os
import sys

PORT = 5000
HOST = '127.0.0.1'
APP_PATH = 'app.py'  # Executado do diretório 'backend/'

def is_running():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.connect((HOST, PORT))
            return True
        except:
            return False

def start_server():
    print(f"[{time.strftime('%H:%M:%S')}] Servidor offline. Tentando ligar...")
    try:
        # Usa o mesmo interpretador do watchdog para evitar falhas de launcher no Windows.
        subprocess.Popen([sys.executable, APP_PATH])
        print(f"[{time.strftime('%H:%M:%S')}] Comando de inicialização enviado.")
    except Exception as e:
        print(f"Erro ao ligar servidor: {e}")

def monitor():
    print("=" * 50)
    print(" MONITOR SAUDE FACIL (WATCHDOG)")
    print(f" Monitorando porta {PORT} em tempo real...")
    print("=" * 50)
    
    while True:
        if not is_running():
            start_server()
        time.sleep(10) # Verifica a cada 10 segundos

if __name__ == "__main__":
    # Garantir que estamos no diretório correto
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    monitor()
