import requests

url = "http://127.0.0.1:5000/api/cadastro"

payload = {
    "nome": "TESTE IMAGEM ARQUIVO",
    "cpf": "111.999.333-44",
    "senha": "password",
    "tipo": "paciente",
    "sus": "1234.5678.9012.3456",
    "email": "teste22@example.com"
}

# Criar um arquivo de texto dummy e enviar como imagem
with open('test_image.jpg', 'wb') as f:
    f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')

with open('test_image.jpg', 'rb') as f:
    files = {
        'imagem_arquivo': ('test_image.jpg', f, 'image/jpeg')
    }
    response = requests.post(url, data=payload, files=files)

print(response.json())
