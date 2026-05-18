import requests
import json

def test_login_medico():
    url = "http://localhost:5000/api/login"
    payload = {
        "cpf": "55555555555",
        "senha": "123" # Marcos senha original? Let's check init_db
    }
    headers = {'Content-Type': 'application/json'}
    
    try:
        response = requests.post(url, data=json.dumps(payload), headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        user_tipo = response.json().get('usuario', {}).get('tipo')
        if user_tipo == 'medico':
            print("SUCCESS: Doctor role authenticated as 'medico'.")
        else:
            print(f"FAILURE: User role is '{user_tipo}'.")
            
    except Exception as e:
        print(f"Error connecting to backend: {e}")

if __name__ == "__main__":
    test_login_medico()
