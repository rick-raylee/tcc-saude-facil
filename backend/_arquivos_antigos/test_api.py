import requests

url = "http://127.0.0.1:5000/api/cadastro"

payload = {
    "nome": "TESTE IMAGEM URL",
    "cpf": "111.222.333-44",
    "senha": "password",
    "tipo": "paciente",
    "sus": "1234.5678.9012.3456",
    "imagem_url": "https://example.com/test.jpg"
}

response = requests.post(url, data=payload)
print(response.json())
