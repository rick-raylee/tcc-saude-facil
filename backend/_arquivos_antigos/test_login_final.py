import requests

url = "http://127.0.0.1:5001/api/login"
payload = {
    "cpf": "55555555555",
    "senha": "medico123"
}

try:
    resp = requests.post(url, json=payload)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")
except Exception as e:
    print(f"Error: {e}")
