import requests

def test_login_api():
    url = "http://127.0.0.1:5001/api/login"
    payload = {
        "cpf": "12345678910",
        "senha": "123456"
    }
    
    try:
        print(f"Enviando POST para {url}...")
        resp = requests.post(url, json=payload, timeout=5)
        print(f"Status Code: {resp.status_code}")
        print(f"Resposta: {resp.text}")
        
    except Exception as e:
        print(f"Erro ao testar API: {e}")

if __name__ == '__main__':
    test_login_api()
