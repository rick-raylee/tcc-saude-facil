import requests
from datetime import datetime

# Paciente CPF: 000.000.000-00 (O que tem lá mockado ou tenta 11122233344)
url = 'http://127.0.0.1:5001/api/enfermeiro/triagem'
headers = {
    'X-User-Id': '3' # Supondo que 3 é um enfermeiro ou usar credenciais reais
}

# Criar sessão
session = requests.Session()
login_res = session.post('http://127.0.0.1:5001/api/login', json={'cpf': '66666666666', 'senha': 'enfermeiro123'})
print("Login Enf:", login_res.json())

# Triar
payload = {
    'paciente_cpf': '11122233344', # TESTE IMAGEM URL
    'peso': 80,
    'altura': 180,
    'pressao': '120x80',
    'fc': 70,
    'temperatura': 36.5,
    'saturacao': 98,
    'queixa': 'Dor de cabeça teste Triage',
    'prioridade': 'amarelo',
    'medico_destino': 'DR. MARCOS TESTE'
}

triage_res = session.post(url, json=payload)
print("Triage Post:", triage_res.json())

# Verificar Dashboard do Médico
medico_sess = requests.Session()
login_med = medico_sess.post('http://127.0.0.1:5001/api/login', json={'cpf': '55555555555', 'senha': 'medico123'})
print("Login Med:", login_med.json())

resumo = medico_sess.get('http://127.0.0.1:5001/api/medico/resumo')
print("Resumo Med:", resumo.json())

# Chamar Próximo
chamar = medico_sess.post('http://127.0.0.1:5001/api/medico/proximo_fila')
print("Chamar Próx:", chamar.json())
