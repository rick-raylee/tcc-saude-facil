
import requests

url = "http://127.0.0.1:5001/api/login"
data = {
    "cpf": "32323254353",
    "senha": "123456"
}

try:
    print(f"Tentando login com CPF: {data['cpf']}")
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Erro: {e}")
