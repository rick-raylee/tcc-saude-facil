"""
Rotas de Autenticação — Login, Cadastro, Sessão
"""

from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import uuid

auth_bp = Blueprint('auth', __name__)
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def validar_cpf(cpf):
    """Validação básica de formato de CPF (apenas digitos e tamanho)"""
    return len(cpf) == 11 and cpf.isdigit()


def normalizar_cpf(cpf):
    """Remove qualquer máscara e mantém apenas os 11 dígitos do CPF."""
    return "".join(filter(str.isdigit, cpf or ""))


CPF_SQL_NORMALIZADO = "REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '')"


# ── CADASTRO ─────────────────────────────────────────────────────
@auth_bp.route('/api/cadastro', methods=['POST'])
def cadastro():
    from app import get_db_connection
    
    # Suportar JSON (antigo) e FormData (novo com upload)
    if request.is_json:
        data = request.get_json()
    else:
        data = request.form

    nome = data.get('nome', '').strip()
    cpf_raw = data.get('cpf', '').strip()
    cpf = normalizar_cpf(cpf_raw)
    sus = data.get('sus', '').strip()
    email = data.get('email', '').strip() or None
    senha = data.get('senha', '')
    tipo = data.get('tipo', 'paciente')
    telefone = data.get('telefone', '').strip()
    cidade = data.get('cidade', '').strip()
    bairro = data.get('bairro', '').strip()
    
    # Processamento da Imagem (Arquivo ou URL)
    imagem_path = None
    imagem_url = data.get('imagem_url', '').strip()
    
    if imagem_url:
        imagem_path = imagem_url
    elif 'imagem_arquivo' in request.files:
        file = request.files['imagem_arquivo']
        if file and file.filename != '':
            ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'png'
            # Gerar nome único
            filename = f"avatar_{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)
            # Salvar o caminho relativo para ser servido pelo Flask
            imagem_path = f"/uploads/{filename}"

    if not nome or not cpf or not senha:
        return jsonify({'erro': 'Nome, CPF e senha são obrigatórios'}), 400

    if not validar_cpf(cpf):
        return jsonify({'erro': 'CPF inválido. Deve conter 11 dígitos numéricos.'}), 400

    senha_hash = generate_password_hash(senha)

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Verificar se CPF já existe
        cur.execute(
            f"SELECT id FROM usuarios WHERE cpf = ? OR {CPF_SQL_NORMALIZADO} = ? LIMIT 1",
            (cpf, cpf)
        )
        if cur.fetchone():
            db.close()
            return jsonify({'erro': 'CPF já cadastrado'}), 409

        # Inserir usuário
        cur.execute("""
            INSERT INTO usuarios (nome, cpf, sus, email, senha, imagem, tipo, telefone, cidade, bairro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (nome, cpf, sus, email, senha_hash, imagem_path, tipo, telefone, cidade, bairro))
        usuario_id = cur.lastrowid

        # Campos extras por tipo
        if tipo == 'medico':
            crm = data.get('crm', '')
            especialidade = data.get('especialidade', '')
            
            tipo_atendimento = data.get('tipo_atendimento', 'presencial')
            telemedicina = 1 if tipo_atendimento in ['telemedicina', 'ambos'] else 0
            
            cur.execute("""
                INSERT INTO medico_info (usuario_id, crm, especialidade, atende_telemedicina, tipo_atendimento)
                VALUES (?, ?, ?, ?, ?)
            """, (usuario_id, crm, especialidade, telemedicina, tipo_atendimento))

        elif tipo == 'enfermeiro':
            coren = data.get('coren', '')
            tipo_profissional = data.get('tipo_profissional', 'Enfermeiro')
            
            cur.execute("""
                INSERT INTO enfermeiro_info (usuario_id, coren, funcao)
                VALUES (?, ?, ?)
            """, (usuario_id, coren, tipo_profissional))

        db.commit()

        # Salvar sessão
        session['usuario_id'] = usuario_id
        session['usuario_nome'] = nome
        session['usuario_tipo'] = tipo
        session['usuario_cpf'] = cpf
        session['usuario_imagem'] = imagem_path

        db.close()

        return jsonify({
            'sucesso': True,
            'usuario': {
                'id': usuario_id,
                'nome': nome,
                'cpf': cpf,
                'tipo': tipo,
                'imagem': imagem_path
            }
        }), 201

    except Exception as e:
        if 'db' in locals():
            db.rollback()
            db.close()
        return jsonify({'erro': str(e)}), 500


# ── LOGIN ────────────────────────────────────────────────────────
@auth_bp.route('/api/login', methods=['POST'])
def login():
    from app import get_db_connection
    data = request.get_json(silent=True) or {}

    cpf_raw = data.get('cpf', '').strip()
    cpf = normalizar_cpf(cpf_raw)
    senha = data.get('senha', '')

    if not cpf or not senha:
        return jsonify({'erro': 'CPF e senha são obrigatórios'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()
        
        print(f"\n--- DEBUG LOGIN ATTEMPT ---")
        print(f"CPF Recebido raw: '{cpf_raw}'")
        print(f"CPF Processado: '{cpf}'")
        
        cur.execute(
            f"SELECT * FROM usuarios WHERE {CPF_SQL_NORMALIZADO} = ? LIMIT 1",
            (cpf,)
        )
        usuario = cur.fetchone()
        
        if not usuario:
            print(f"DEBUG LOGIN: CPF '{cpf}' NÃO LOCALIZADO.")
            # Amostra para ajudar o usuário a ver o que tem no banco
            cur.execute("SELECT cpf FROM usuarios LIMIT 3")
            amostra = [r['cpf'] for r in cur.fetchall()]
            print(f"DEBUG LOGIN: Amostra de CPFs existentes: {amostra}")
            db.close()
            return jsonify({'erro': 'Credenciais Inválidas', 'detalhe': 'Usuário não encontrado.'}), 404

        if not check_password_hash(usuario['senha'], senha):
            print(f"DEBUG LOGIN: Senha incorreta para {usuario['nome']}")
            db.close()
            return jsonify({'erro': 'Credenciais Inválidas', 'detalhe': 'Senha incorreta.'}), 401

        role_original = usuario['tipo']
        print(f"DEBUG LOGIN: Sucesso! Logando {usuario['nome']} ({role_original})")

        session['usuario_id'] = usuario['id']
        session['usuario_nome'] = usuario['nome']
        session['usuario_tipo'] = role_original
        session['usuario_cpf'] = cpf
        session['usuario_imagem'] = usuario['imagem']

        resp = {
            'sucesso': True,
            'usuario': {
                'id': usuario['id'],
                'nome': usuario['nome'],
                'cpf': cpf,
                'sus': usuario['sus'],
                'email': usuario['email'],
                'imagem': usuario['imagem'],
                'tipo': role_original,
                'telefone': usuario['telefone'],
                'cidade': usuario['cidade'],
                'bairro': usuario['bairro']
            }
        }

        # Info extra para médico
        if usuario['tipo'] == 'medico':
            cur.execute("SELECT crm, especialidade, atende_telemedicina, tipo_atendimento FROM medico_info WHERE usuario_id = ?", (usuario['id'],))
            med = cur.fetchone()
            if med:
                resp['usuario']['crm'] = med['crm']
                resp['usuario']['especialidade'] = med['especialidade']
                resp['usuario']['telemedicina'] = bool(med['atende_telemedicina'])
                resp['usuario']['tipo_atendimento'] = med['tipo_atendimento']

        # Info extra para enfermeiro
        if usuario['tipo'] == 'enfermeiro':
            cur.execute("SELECT coren, funcao FROM enfermeiro_info WHERE usuario_id = ?", (usuario['id'],))
            enf = cur.fetchone()
            if enf:
                resp['usuario']['coren'] = enf['coren']
                resp['usuario']['funcao'] = enf['funcao']

        print(f"--- FIM DEBUG LOGIN ---\n")
        db.close()
        return jsonify(resp), 200

    except Exception as e:
        print(f"DEBUG LOGIN ERRO CRITICO: {str(e)}")
        return jsonify({'erro': 'Erro interno no servidor', 'detalhe': str(e)}), 500


# ── SESSÃO ───────────────────────────────────────────────────────
@auth_bp.route('/api/sessao', methods=['GET'])
def sessao():
    if 'usuario_id' in session:
        return jsonify({
            'logado': True,
            'usuario': {
                'id': session['usuario_id'],
                'nome': session['usuario_nome'],
                'tipo': session['usuario_tipo'],
                'cpf': session.get('usuario_cpf', ''),
                'imagem': session.get('usuario_imagem', '')
            }
        })
    return jsonify({'logado': False}), 200


# ── LOGOUT ───────────────────────────────────────────────────────
@auth_bp.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'sucesso': True}), 200
