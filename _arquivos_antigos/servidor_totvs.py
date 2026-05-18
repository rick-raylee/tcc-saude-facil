from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Habilita o CORS para todas as rotas
CORS(app)

@app.route('/api/framework/v1/users/<identifier>/recoveryPassword', methods=['POST'])
def recovery_password(identifier):
    print(f"[TOTVS MOCK] Recebida solicitação de recuperação para: {identifier}")
    # Simula sucesso - o email existe e o token foi enviado
    return jsonify({
        "message": "Token enviado com sucesso via e-mail.",
        "simulated_token": "778899"
    }), 200

@app.route('/api/framework/v1/users/<identifier>/changePasswordWithToken', methods=['POST'])
def change_password_with_token(identifier):
    data = request.get_json()
    token = data.get('lastPassword')
    new_password = data.get('newPassword')
    
    print(f"[TOTVS MOCK] Recebida solicitação de alteração com token para: {identifier}")
    print(f"[TOTVS MOCK] Token: {token} | Nova Senha: {new_password}")
    
    # Simula sucesso - a senha foi alterada
    return jsonify({
        "message": "Senha alterada com sucesso."
    }), 200

@app.route('/api/framework/v1/users/<identifier>/changePassword', methods=['POST'])
def change_password(identifier):
    data = request.get_json()
    last_password = data.get('lastPassword')
    new_password = data.get('newPassword')
    
    print(f"[TOTVS MOCK] Recebida solicitação de alteração direta de senha para: {identifier}")
    
    # Simula sucesso - a senha foi alterada
    return jsonify({
        "message": "Senha alterada com sucesso."
    }), 200

if __name__ == '__main__':
    print("=========================================================")
    print("Servidor TOTVS Mock iniciado na porta 8051")
    print("CORS habilitado para testes locais")
    print("=========================================================")
    app.run(port=8051, debug=True)
