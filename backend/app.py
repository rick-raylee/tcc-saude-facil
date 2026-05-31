"""
Portal Saúde Digital — Backend Flask
Servidor principal com todas as rotas integradas ao SQLite.
"""

import sys
from collections import deque
from datetime import datetime

class TerminalBuffer:
    def __init__(self, original_stream):
        self.original_stream = original_stream
        self.log_buffer = deque(maxlen=200)
    
    def write(self, text):
        # Garante que text seja convertido para str para o buffer em memoria
        if isinstance(text, bytes):
            try:
                text_str = text.decode('utf-8', errors='ignore')
            except Exception:
                text_str = text.decode('latin-1', errors='ignore')
        else:
            text_str = str(text)
            
        try:
            if self.original_stream:
                self.original_stream.write(text)
        except Exception:
            # Em caso de falha de console (ex. acentos no Windows CMD/PowerShell),
            # tenta imprimir limpando acentos ou simplesmente ignora para nao travar a aplicacao
            try:
                if self.original_stream:
                    if isinstance(text, bytes):
                        self.original_stream.write(text)
                    else:
                        text_clean = text_str.encode('ascii', errors='replace').decode('ascii')
                        self.original_stream.write(text_clean)
            except Exception:
                pass
                
        txt = text_str.strip()
        if txt:
            # Se for log bruto (werkzeug) não adicionar o timestamp
            if txt.startswith('[') or "HTTP" in txt:
                self.log_buffer.append(txt)
            else:
                ts = datetime.now().strftime('%d/%b/%Y %H:%M:%S')
                self.log_buffer.append(f"[{ts}] {txt}")
            
    def flush(self):
        if hasattr(self.original_stream, 'flush'):
            try:
                self.original_stream.flush()
            except Exception:
                pass

terminal_buffer = TerminalBuffer(sys.stderr)
sys.stderr = terminal_buffer
sys.stdout = terminal_buffer

from flask import Flask, send_from_directory, request, jsonify, session, redirect
from flask_cors import CORS
import sqlite3
import os
import re
from config import Config

# ── Instância Flask ──────────────────────────────────────────────
app = Flask(__name__, static_folder='../') 
app.config.from_object(Config)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = True if os.environ.get('RENDER') or os.environ.get('PORT') else False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_NAME'] = 'sessao_portal_saude'

# Permite CORS para QUALQUER porta no localhost/127.0.0.1 (suporta portas aleatórias do Go Live)
CORS(app, origins=re.compile(r"https?://.*"), supports_credentials=True)

# ── Diagnóstico Global ──────────────────────────────────────────
@app.before_request
def log_request_info():
    # Ignora logs de arquivos estáticos para não poluir o terminal demais
    if not request.path.startswith('/static') and not request.path.endswith(('.js', '.css', '.png', '.jpg')):
        print(f"--> [REQUISICAO] {request.method} {request.path} (Origin: {request.headers.get('Origin')})")

@app.route('/api/ping')
def ping():
    db_status = "Não verificado"
    total_usuarios = 0
    amostra_cpfs = []
    
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT COUNT(*) FROM usuarios")
        total_usuarios = cur.fetchone()[0]
        
        cur.execute("SELECT cpf, nome, tipo FROM usuarios LIMIT 15")
        amostra_cpfs = [f"{row['nome']} ({row['tipo']}) - CPF: {row['cpf']}" for row in cur.fetchall()]
        db.close()
        db_status = "Conectado e Inicializado com Sucesso!"
    except Exception as e:
        db_status = f"Erro ao acessar banco: {str(e)}"

    return jsonify({
        "status": "online",
        "mensagem": "Servidor Flask funcionando com sucesso!",
        "versao_deploy": "Commit: 48be410 (Diagnóstico Ativo)",
        "banco_de_dados": {
            "status": db_status,
            "caminho": os.path.abspath(app.config['DATABASE_PATH']),
            "total_usuarios": total_usuarios,
            "usuarios_carregados": amostra_cpfs
        }
    })

@app.route('/api/public/reseta-banco-secreto', methods=['GET'])
def reseta_banco_secreto():
    try:
        db_path = os.path.abspath(app.config['DATABASE_PATH'])
        print(f"--> [Reset Secreto] Limpando dados do banco em: {db_path}")
        
        tabelas = [
            "medico_info", "enfermeiro_info", "paciente_doencas", "consultas", 
            "triagens", "prontuarios", "receitas", "atestados", "exames", 
            "vacinas_aplicadas", "chat", "prescricoes", "aplicacoes", 
            "notificacoes", "noticias", "comentarios", "carrossel", 
            "estatisticas", "campanhas", "doencas_prevencao", "faq", 
            "settings", "logs", "acessos_diarios", "tickets", "usuarios"
        ]
        
        # Conecta e limpa o banco de forma transacional e segura
        db = get_db_connection()
        cur = db.cursor()
        
        # Desativa chaves estrangeiras temporariamente para evitar conflito no drop
        cur.execute("PRAGMA foreign_keys = OFF;")
        
        for tabela in tabelas:
            try:
                cur.execute(f"DROP TABLE IF EXISTS {tabela};")
            except Exception as drop_err:
                print(f"--> [Reset Secreto] Falha ao deletar {tabela}: {drop_err}")
                
        db.commit()
        db.close()
        
        # 1. Recria as tabelas usando o script init_db
        from init_db import init_db
        init_db(db_path)
        
        # 2. Popula os dados de semente dos usuarios
        from seed_users import seed
        seed()
        
        # 3. Executa as migracoes e recria tabelas extras (logs, settings, etc.)
        migrar_schema_admin()
        normalizar_cpfs_legados()
        
        # 4. Cria a tabela de tickets
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id INTEGER,
                titulo TEXT,
                descricao TEXT,
                prioridade TEXT,
                status TEXT DEFAULT 'Aberto',
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        db.commit()
        db.close()
        
        return jsonify({
            "sucesso": True,
            "mensagem": "Banco de dados e todos os logins do seu TCC foram RECRIADOS e POPULADOS com sucesso em producao no Render!",
            "database_path": db_path
        })
    except Exception as e:
        print(f"--> [Reset Secreto] ERRO CRITICO: {e}")
        return jsonify({
            "sucesso": False,
            "erro": str(e)
        }), 500

# ── SQLite ───────────────────────────────────────────────────────
def get_db_connection():
    """Retorna uma conexão com o SQLite que retorna dicionários."""
    try:
        db_path = os.path.abspath(app.config['DATABASE_PATH'])
        conn = sqlite3.connect(db_path, timeout=10.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        # Otimização para evitar lock de banco
        conn.execute('PRAGMA journal_mode=WAL;')
        return conn
    except Exception as e:
        print(f"CRITICAL ERROR: Could not connect to database at {app.config['DATABASE_PATH']}")
        print(f"Error detail: {str(e)}")
        raise e


def normalizar_cpfs_legados():
    """Garante que CPFs antigos fiquem salvos apenas com dígitos no banco."""
    db = get_db_connection()
    cur = db.cursor()

    cur.execute("SELECT id, cpf FROM usuarios WHERE cpf IS NOT NULL AND cpf <> ''")
    rows = cur.fetchall()

    atualizados = 0
    for row in rows:
        cpf_atual = str(row['cpf'])
        cpf_limpo = "".join(ch for ch in cpf_atual if ch.isdigit())

        if not cpf_limpo or cpf_limpo == cpf_atual:
            continue

        cur.execute("SELECT id FROM usuarios WHERE cpf = ? AND id <> ?", (cpf_limpo, row['id']))
        conflito = cur.fetchone()
        if conflito:
            print(f"AVISO: CPF duplicado ao normalizar {cpf_atual} -> {cpf_limpo}. Registro {row['id']} mantido.")
            continue

        cur.execute("UPDATE usuarios SET cpf = ? WHERE id = ?", (cpf_limpo, row['id']))
        atualizados += 1

    if atualizados:
        db.commit()
        print(f"CPF: {atualizados} registro(s) legado(s) normalizado(s).")

    db.close()


def migrar_schema_admin():
    """Aplica ajustes mínimos no schema usados pelo painel admin."""
    db = get_db_connection()
    cur = db.cursor()

    cur.execute("PRAGMA table_info(noticias)")
    colunas_noticias = {row[1] for row in cur.fetchall()}

    # Migração para a tabela notícias
    if 'acessos' not in colunas_noticias:
        cur.execute("ALTER TABLE noticias ADD COLUMN acessos INTEGER DEFAULT 0")
    if 'prioridade' not in colunas_noticias:
        cur.execute("ALTER TABLE noticias ADD COLUMN prioridade INTEGER DEFAULT 0")
    if 'destaque_carrossel' not in colunas_noticias:
        cur.execute("ALTER TABLE noticias ADD COLUMN destaque_carrossel INTEGER DEFAULT 0")

    # Migração para a tabela medico_info
    cur.execute("PRAGMA table_info(medico_info)")
    colunas_medico = {row[1] for row in cur.fetchall()}
    if 'presencial_ativo' not in colunas_medico:
        cur.execute("ALTER TABLE medico_info ADD COLUMN presencial_ativo INTEGER DEFAULT 0")

    # Migração para a tabela consultas
    cur.execute("PRAGMA table_info(consultas)")
    colunas_consultas = {row[1] for row in cur.fetchall()}
    for col_nome, col_tipo in [('confirmacao_paciente', 'INTEGER DEFAULT 0'), ('confirmacao_medico', 'INTEGER DEFAULT 0'), ('encaminhado_para_medico_id', 'INTEGER')]:
        if col_nome not in colunas_consultas:
            cur.execute(f"ALTER TABLE consultas ADD COLUMN {col_nome} {col_tipo}")

    # Migração para a tabela carrossel
    cur.execute("PRAGMA table_info(carrossel)")
    colunas_carrossel = {row[1] for row in cur.fetchall()}
    for col in [("subtitulo", "TEXT"), ("texto", "TEXT"), ("status", "INTEGER DEFAULT 1")]:
        if col[0] not in colunas_carrossel:
            cur.execute(f"ALTER TABLE carrossel ADD COLUMN {col[0]} {col[1]}")

    # Migração para a tabela doencas_prevencao
    cur.execute("PRAGMA table_info(doencas_prevencao)")
    colunas_doencas = {row[1] for row in cur.fetchall()}
    for col in [("especialista", "TEXT"), ("encaminhamento", "TEXT"), ("gravidade", "TEXT"), ("bg_class", "TEXT"), ("tratamento", "TEXT"), ("prevencao", "TEXT"), ("imagem", "TEXT"), ("cor", "TEXT")]:
        if col[0] not in colunas_doencas:
            cur.execute(f"ALTER TABLE doencas_prevencao ADD COLUMN {col[0]} {col[1]}")

    # Migração para a tabela de logs do sistema
    cur.execute("CREATE TABLE IF NOT EXISTS logs ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "usuario_id INTEGER, "
                "usuario TEXT, "
                "acao TEXT, "
                "ip TEXT, "
                "data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "
                "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)"
                ")")
    cur.execute("PRAGMA table_info(logs)")
    colunas_logs = {row[1] for row in cur.fetchall()}
    if 'data_acao' not in colunas_logs:
        cur.execute("ALTER TABLE logs ADD COLUMN data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

    # Migração para a tabela estatisticas
    cur.execute("PRAGMA table_info(estatisticas)")
    colunas_stats = {row[1] for row in cur.fetchall()}
    for col_nome, col_tipo in [('valor_mapa', 'TEXT'), ('detalhe', 'TEXT'), ('lat', 'TEXT'), ('lon', 'TEXT')]:
        if col_nome not in colunas_stats:
            try:
                cur.execute(f"ALTER TABLE estatisticas ADD COLUMN {col_nome} {col_tipo}")
            except Exception: pass

    # Criação da tabela de acessos_diarios caso não exista
    cur.execute("CREATE TABLE IF NOT EXISTS acessos_diarios ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "data TEXT UNIQUE, "
                "quantidade INTEGER DEFAULT 0"
                ")")

    # Criação da tabela de settings caso não exista
    cur.execute("CREATE TABLE IF NOT EXISTS settings ("
                "chave TEXT PRIMARY KEY, "
                "valor TEXT"
                ")")
    # Valores padrões para settings
    cur.execute("INSERT OR IGNORE INTO settings (chave, valor) VALUES ('portal_titulo', 'Bem-vindo ao Portal Saúde Digital')")
    cur.execute("INSERT OR IGNORE INTO settings (chave, valor) VALUES ('portal_subtitulo', 'A saúde de Cascavel ao alcance de um clique. Agendamentos, telemedicina, campanhas e muito mais.')")
    cur.execute("INSERT OR IGNORE INTO settings (chave, valor) VALUES ('google_analytics_id', '')")

    db.commit()
    db.close()

# ── Registrar Blueprints (rotas) ─────────────────────────────────
from routes.auth import auth_bp
from routes.paciente import paciente_bp
from routes.medico import medico_bp
from routes.enfermeiro import enfermeiro_bp
from routes.admin import admin_bp
from routes.consultas import consultas_bp
from routes.telemedicina import telemedicina_bp
from routes.ti import ti_bp

app.register_blueprint(auth_bp)
app.register_blueprint(paciente_bp)
app.register_blueprint(medico_bp)
app.register_blueprint(enfermeiro_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(consultas_bp)
app.register_blueprint(telemedicina_bp)
app.register_blueprint(ti_bp)

# Executa migrações essenciais na inicialização para garantir integridade do banco
try:
    migrar_schema_admin()
    normalizar_cpfs_legados()
except Exception as e:
    print(f"Erro ao executar migrações na inicialização: {e}")



@app.after_request
def add_no_cache_headers(response):
    """Evita que HTML/CSS/JS antigos fiquem presos no cache do navegador em dev."""
    path = request.path.lower()
    if path.endswith(('.html', '.js', '.css')) or path in {
        '/', '/admin', '/painel-admin', '/painel-enfermeiro', '/painel-telemedicina', '/dashboard'
    }:
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# ── Servir arquivos estáticos do frontend ────────────────────────
@app.route('/uploads/<path:filename>')
def uploaded_files(filename):
    return send_from_directory('uploads', filename)

def registrar_acesso_visita():
    try:
        from datetime import date
        today = date.today().strftime('%Y-%m-%d')
        conn = get_db_connection()
        cur = conn.cursor()
        # Se o dia já existe, incrementa. Senão, cria com valor 1.
        cur.execute("INSERT INTO acessos_diarios (data, quantidade) VALUES (?, 1) "
                    "ON CONFLICT(data) DO UPDATE SET quantidade = quantidade + 1", (today,))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Erro ao registrar visita do dia: {e}")

@app.route('/api/public/settings', methods=['GET'])
def get_public_settings():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT chave, valor FROM settings")
        rows = cur.fetchall()
        conn.close()
        # Retorna dicionário com chave e valor
        settings_dict = {row['chave']: row['valor'] for row in rows}
        return jsonify(settings_dict)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/')
def index():
    registrar_acesso_visita()
    return send_from_directory('../', 'index.html')

from flask import session, redirect, url_for

@app.route('/admin', strict_slashes=False)
@app.route('/admin/<path:subpath>')
@app.route('/painel-admin', strict_slashes=False)
def admin_routes(subpath=None):
    if session.get('usuario_tipo') != 'admin' and session.get('tipo') != 'admin':
        return redirect('/') 
    return send_from_directory('../', 'admin.html')

@app.route('/painel-enfermeiro', strict_slashes=False)
def painel_enf():
    if session.get('usuario_id') and (session.get('usuario_tipo') == 'enfermeiro' or session.get('tipo') == 'enfermeiro'):
        return send_from_directory('../', 'enfermeiro.html')
    return redirect('/')

@app.route('/painel-telemedicina', strict_slashes=False)
def painel_tele():
    if session.get('usuario_id') and session.get('usuario_tipo') == 'medico_tele':
        return send_from_directory('../', 'painel_telemedicina.html')
    return redirect('/')

@app.route('/painel-medico', strict_slashes=False)
def painel_medico():
    user_role = session.get('usuario_tipo') or session.get('tipo')
    if session.get('usuario_id') and (user_role == 'medico' or user_role == 'medico_tele'):
        return send_from_directory('../', 'medico.html')
    return redirect('/')

@app.route('/painel-ti', strict_slashes=False)
def painel_ti():
    user_role = session.get('usuario_tipo') or session.get('tipo')
    if session.get('usuario_id') and (user_role == 'ti' or user_role == 'admin'):
        return send_from_directory('../', 'ti.html')
    return redirect('/')

@app.route('/dashboard', strict_slashes=False)
def dashboard():
    if session.get('usuario_id'):
        return send_from_directory('../', 'perfil.html')
    return redirect('/')

@app.route('/home', strict_slashes=False)
def home_redirect():
    return redirect('/')

@app.route('/<path:filename>')
def static_files(filename):
    try:
        # Pega o diretório onde este app.py está e sobe um nível para a raiz
        base_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.abspath(os.path.join(base_dir, '..'))
        
        # Remove query strings (ex: ?v=1.2) se vierem no path
        clean_filename = filename.split('?')[0]
        
        # SEGURANÇA: Bloqueia arquivos sensíveis
        if any(clean_filename.endswith(ext) for ext in ['.py', '.db', '.sqlite3', '.bat', '.env']):
             return "Acesso proibido", 403

        # SEGURANÇA: Controle de acesso para painéis específicos
        paineis_protegidos = {
            'perfil.html': None,
            'medico.html': 'medico',
            'enfermeiro.html': 'enfermeiro',
            'painel_telemedicina.html': 'medico_tele',
            'admin.html': 'admin',
            'ti.html': 'ti'
        }

        if clean_filename in paineis_protegidos:
            if not session.get('usuario_id'):
                return redirect('/')
            req_role = paineis_protegidos[clean_filename]
            if req_role:
                user_role = session.get('usuario_tipo') or session.get('tipo')
                # Permissões Estendidas / Flexíveis para evitar bloqueio
                if req_role == 'ti' and user_role == 'admin':
                    pass 
                elif req_role == 'medico' and user_role == 'medico_tele':
                    pass
                elif req_role == 'medico_tele' and user_role == 'medico':
                    pass
                elif user_role != req_role:
                    return redirect('/')

        # Verifica se o arquivo existe em diferentes possíveis locais
        # 1. Na raiz do projeto (para .html, .css, .js)
        target_path_root = os.path.join(root_dir, clean_filename)
        # 2. Dentro da pasta backend (para uploads e outros arquivos do servidor)
        target_path_backend = os.path.join(base_dir, clean_filename)

        if os.path.isfile(target_path_root):
            return send_from_directory(root_dir, clean_filename)
        elif os.path.isfile(target_path_backend):
            return send_from_directory(base_dir, clean_filename)
        
        # Caso especial para caminhos que começam com uploads/ mas o arquivo está em backend/uploads
        if clean_filename.startswith('uploads/'):
            upload_file = clean_filename[8:]
            return send_from_directory(os.path.join(base_dir, 'uploads'), upload_file)

        return f"Arquivo {clean_filename} não encontrado no servidor backend", 404
    except Exception as e:
        print(f"ERRO CRÍTICO ao servir {filename}: {str(e)}")
        return f"Erro interno do servidor backend: {str(e)}", 500

from flask import jsonify

def _fallback_public_stats():
    return [
        {"id": 1, "texto": "Hipertensos no Brasil", "valor": "38 milhões", "valor_mapa": "38 milhões", "icone": "<i class='fi fi-rr-heart'></i>", "cor": "verde", "detalhe": "Principal fator de risco para AVC", "lat": -15.7801, "lon": -47.9292},
        {"id": 2, "texto": "Diabéticos no Brasil", "valor": "16,8 milhões", "valor_mapa": "16,8 milhões", "icone": "<i class='fi fi-rr-syringe'></i>", "cor": "azul", "detalhe": "Representa 9% da população adulta", "lat": -23.5505, "lon": -46.6333},
        {"id": 3, "texto": "Casos de Dengue", "valor": "1,6 milhão", "valor_mapa": "1,6 milhão", "icone": "<i class='fi fi-rr-bug'></i>", "cor": "laranja", "detalhe": "Dados acumulados em 2025", "lat": -3.1190, "lon": -60.0217},
        {"id": 4, "texto": "Cobertura Vacinal", "valor": "82%", "valor_mapa": "82%", "icone": "<i class='fi fi-rr-virus'></i>", "cor": "roxo", "detalhe": "Média nacional de imunização", "lat": -8.0476, "lon": -34.8770},
    ]

def _fallback_public_noticias():
    return [
        {"id": 1, "titulo": "Vacinação contra Gripe começa esta semana", "conteudo": "O Ministério da Saúde ampliou a campanha de vacinação para grupos prioritários.", "resumo": "Campanha nacional foi ampliada.", "imagem": "health_campaign_art_branded.png", "categoria": "Campanha Nacional", "status": "publicado", "destaque_carrossel": 1, "criada_em": "2026-04-14"},
        {"id": 2, "titulo": "Novo Centro de Telemedicina inaugurado", "conteudo": "A nova estrutura vai ampliar o atendimento remoto em várias regiões.", "resumo": "Mais acesso e rapidez no atendimento.", "imagem": "health_campaign_art_branded.png", "categoria": "Tecnologia", "status": "publicado", "destaque_carrossel": 1, "criada_em": "2026-04-14"},
        {"id": 3, "titulo": "Campanha de Saúde Mental nas escolas", "conteudo": "Ações educativas serão levadas para unidades de ensino de todo o país.", "resumo": "Atenção à saúde emocional.", "imagem": "health_campaign_art_branded.png", "categoria": "Prevenção", "status": "publicado", "destaque_carrossel": 0, "criada_em": "2026-04-14"},
    ]

def _fallback_public_carrossel():
    return [
        {"id": 1, "titulo": "Saúde Digital 2.0", "subtitulo": "A inovação que cuida de você", "texto": "O SUS agora conectado à palma da sua mão.", "imagem": "health_campaign_art_branded.png", "ativo": 1, "status": 1, "ordem": 1},
        {"id": 2, "titulo": "Campanha Nacional de Vacinação", "subtitulo": "Proteja quem você ama", "texto": "Mais proteção para crianças, idosos e grupos prioritários.", "imagem": "health_campaign_art_branded.png", "ativo": 1, "status": 1, "ordem": 2},
        {"id": 3, "titulo": "Novos Profissionais", "subtitulo": "Mais rapidez no atendimento", "texto": "Novos profissionais reforçando a rede pública.", "imagem": "health_campaign_art_branded.png", "ativo": 1, "status": 1, "ordem": 3},
    ]

def _fallback_public_doencas():
    return [
        {"id": 1, "titulo": "Hipertensão", "icone": "<i class='fi fi-rr-heart'></i>", "o_que_e": "A pressão alta crônica força o coração a trabalhar muito além do normal.", "imagem": "hypertension_3d_card_1772990851793.png", "gravidade": "Alta", "especialista": "Cardiologista", "encaminhamento": "Clínico Geral (UBS)", "bg_class": "bg-hipertensao", "ordem": 1},
        {"id": 2, "titulo": "Diabetes", "icone": "<i class='fi fi-rr-syringe'></i>", "o_que_e": "Doença crônica de uso inadequado da insulina.", "imagem": "diabetes_3d_card_1772990866460.png", "gravidade": "Alta", "especialista": "Endocrinologista", "encaminhamento": "Clínico Geral para exames de rotina", "bg_class": "bg-diabetes", "ordem": 2},
        {"id": 3, "titulo": "Asma", "icone": "<i class='fi fi-rr-lungs'></i>", "o_que_e": "Inflamação crônica das vias respiratórias.", "imagem": "asthma_3d_card_1772990881793.png", "gravidade": "Média", "especialista": "Pneumologista", "encaminhamento": "Clínico Geral", "bg_class": "bg-dengue", "ordem": 3},
    ]

@app.route('/api/public/noticias', methods=['GET'])
def public_noticias():
    db = get_db_connection()
    cur = db.cursor()
    cur.execute("SELECT * FROM noticias WHERE status='publicado' ORDER BY criada_em DESC, id DESC LIMIT 20")
    rows = cur.fetchall()
    db.close()
    data = [dict(r) for r in rows]
    return jsonify(data if data else _fallback_public_noticias())

@app.route('/api/public/carrossel', methods=['GET'])
def public_carrossel():
    db = get_db_connection()
    cur = db.cursor()
    cur.execute("SELECT * FROM carrossel WHERE status=1 OR ativo=1 ORDER BY ordem ASC")
    rows = cur.fetchall()
    db.close()
    data = [dict(r) for r in rows]
    return jsonify(data if data else _fallback_public_carrossel())

@app.route('/api/public/estatisticas', methods=['GET'])
def public_estatisticas():
    db = get_db_connection()
    cur = db.cursor()
    cur.execute("SELECT * FROM estatisticas ORDER BY id ASC")
    rows = cur.fetchall()
    db.close()
    data = [dict(r) for r in rows]
    return jsonify(data if data else _fallback_public_stats())

@app.route('/api/public/campanhas', methods=['GET'])
def public_campanhas():
    db = get_db_connection()
    cur = db.cursor()
    cur.execute("SELECT * FROM campanhas WHERE status=1 OR status='Ativa' ORDER BY id DESC")
    rows = cur.fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/public/doencas', methods=['GET'])
def public_doencas():
    db = get_db_connection()
    cur = db.cursor()
    cur.execute("SELECT * FROM doencas_prevencao ORDER BY ordem ASC, id ASC")
    rows = cur.fetchall()
    db.close()
    data = [dict(r) for r in rows]
    return jsonify(data if data else _fallback_public_doencas())

# ── Iniciar servidor ─────────────────────────────────────────────
if __name__ == '__main__':
    # Em desenvolvimento local, verifica e inicializa se necessario de forma isolada
    try:
        db_path_verif = os.path.abspath(app.config['DATABASE_PATH'])
        if not os.path.exists(db_path_verif) or os.path.getsize(db_path_verif) == 0:
            print("--> [Local] Inicializando banco de dados local...")
            from init_db import init_db
            init_db(db_path_verif)
            from seed_users import seed
            seed()
        
        migrar_schema_admin()
        normalizar_cpfs_legados()
    except Exception as e:
        print(f"--> [Aviso] Falha na inicializacao local: {e}")
    print("=" * 60)
    print("  Portal Saude Digital - Backend Flask (SQLite)")
    print(f"  Diretorio base: {os.path.abspath(os.curdir)}")
    print(f"  Banco de dados: {os.path.abspath(app.config['DATABASE_PATH'])}")
    
    try:
        print("  [1/3] Verificando conexao com o banco...")
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT COUNT(*) FROM usuarios")
        count = cur.fetchone()[0]
        print(f"  [OK] Conectado! Usuarios no sistema: {count}")
        db.close()
    except Exception as e:
        print(f"  [CRITICO] ERRO DE CONEXAO COM O BANCO: {e}")

    print(f"  URL DE ACESSO: http://127.0.0.1:5001")
    print("=" * 60)
    
    app.run(debug=True, host='0.0.0.0', port=5001)

