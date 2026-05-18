from flask import Blueprint, request, jsonify, session
import sqlite3
import os
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
import time
from datetime import datetime
from functools import wraps

ti_bp = Blueprint('ti', __name__)

def ti_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Tenta sessão, depois tenta Header de fallback (para ambientes locais com restrição de cookies)
        user_type = session.get("usuario_tipo") or request.headers.get('X-User-Type')
        if user_type not in ["ti", "admin"]:
            return jsonify({'erro': 'Acesso negado. Apenas usuários de TI ou Admin.'}), 403
        return f(*args, **kwargs)
    return decorated_function

# ── ESTATÍSTICAS E MÉTRICAS ──────────────────────────────────────
@ti_bp.route('/api/ti/stats', methods=['GET'])
@ti_required
def get_stats():
    try:
        # Métricas Reais do Sistema (usando psutil se disponível)
        if PSUTIL_AVAILABLE:
            cpu_usage = psutil.cpu_percent(interval=None)
            memory = psutil.virtual_memory().percent
            disk = psutil.disk_usage('/').percent
        else:
            import random
            cpu_usage = random.uniform(10, 30)
            memory = 45.5
            disk = 60.2
        
        # Simulação de latência e uptime
        stats = {
            'cpu': cpu_usage,
            'memory': memory,
            'disk': disk,
            'uptime': '99.9%',
            'latency': '12ms',
            'active_servers': '4/4',
            'last_backup': 'Hoje, 03:00',
            'security_alerts': 0,
            'firewall': 'Ativo'
        }
        return jsonify(stats)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@ti_bp.route('/api/ti/logs', methods=['GET'])
@ti_required
def get_logs():
    import sys
    # Se o interceptador buffer existir, retorna o histórico
    if hasattr(sys.stderr, 'log_buffer'):
        return jsonify(list(sys.stderr.log_buffer))
    return jsonify(["[Erro] Buffer não inicializado no app.py"])

# ── VISÃO DO BANCO DE DADOS ──────────────────────────────────────
@ti_bp.route('/api/ti/db/tables', methods=['GET'])
@ti_required
def list_tables():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row['name'] for row in cur.fetchall()]
        db.close()
        return jsonify(tables)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@ti_bp.route('/api/ti/db/structure/<table_name>', methods=['GET'])
@ti_required
def table_structure(table_name):
    from app import get_db_connection
    if not table_name.isidentifier(): return jsonify({'erro': 'Tabela inválida'}), 400
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute(f"PRAGMA table_info({table_name})")
        columns = [dict(row) for row in cur.fetchall()]
        db.close()
        return jsonify(columns)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@ti_bp.route('/api/ti/db/data/<table_name>', methods=['GET'])
@ti_required
def table_data(table_name):
    from app import get_db_connection
    limit = request.args.get('limit', 100)
    if not table_name.isidentifier(): return jsonify({'erro': 'Tabela inválida'}), 400
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute(f"SELECT * FROM {table_name} LIMIT ?", (limit,))
        rows = [dict(row) for row in cur.fetchall()]
        db.close()
        return jsonify(rows)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@ti_bp.route('/api/ti/db/data/<table_name>', methods=['POST'])
@ti_required
def add_row(table_name):
    from app import get_db_connection
    data = request.get_json()
    if not data: return jsonify({'erro': 'Dados ausentes'}), 400
    if not table_name.isidentifier(): return jsonify({'erro': 'Tabela inválida'}), 400
    if not all(k.isidentifier() for k in data.keys()): return jsonify({'erro': 'Coluna inválida detectada'}), 400
    
    try:
        db = get_db_connection()
        cur = db.cursor()
        cols = ", ".join(data.keys())
        placeholders = ", ".join(["?" for _ in data])
        cur.execute(f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})", list(data.values()))
        db.commit()
        db.close()
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@ti_bp.route('/api/ti/db/data/<table_name>/<pk_col>/<pk_val>', methods=['PUT'])
@ti_required
def update_row(table_name, pk_col, pk_val):
    from app import get_db_connection
    data = request.get_json()
    if not data: return jsonify({'erro': 'Dados ausentes'}), 400
    if not table_name.isidentifier() or not pk_col.isidentifier(): return jsonify({'erro': 'Estrutura inválida'}), 400
    if not all(k.isidentifier() for k in data.keys()): return jsonify({'erro': 'Coluna inválida detectada'}), 400
    
    try:
        db = get_db_connection()
        cur = db.cursor()
        sets = ", ".join([f"{k} = ?" for k in data.keys()])
        cur.execute(f"UPDATE {table_name} SET {sets} WHERE {pk_col} = ?", list(data.values()) + [pk_val])
        db.commit()
        db.close()
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@ti_bp.route('/api/ti/db/data/<table_name>/<pk_col>/<pk_val>', methods=['DELETE'])
@ti_required
def delete_row(table_name, pk_col, pk_val):
    from app import get_db_connection
    if not table_name.isidentifier() or not pk_col.isidentifier(): return jsonify({'erro': 'Estrutura inválida'}), 400
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute(f"DELETE FROM {table_name} WHERE {pk_col} = ?", (pk_val,))
        db.commit()
        db.close()
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ── CHAMADOS (TICKETS) ──────────────────────────────────────────
@ti_bp.route('/api/ti/tickets', methods=['GET'])
@ti_required
def list_tickets():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        # Verificar se a tabela existe, senão criar (fallback)
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'")
        if not cur.fetchone():
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
            # Inserir alguns mocks
            cur.execute("INSERT INTO tickets (titulo, descricao, prioridade) VALUES (?, ?, ?)", 
                        ('Lentidão no sistema', 'O painel médico está demorando a carregar.', 'Alta'))
            cur.execute("INSERT INTO tickets (titulo, descricao, prioridade) VALUES (?, ?, ?)", 
                        ('Erro ao salvar triagem', 'Erro 500 ao enviar formulário.', 'Crítica'))
            db.commit()

        cur.execute("""
            SELECT t.*, u.nome as usuario_nome 
            FROM tickets t
            LEFT JOIN usuarios u ON t.usuario_id = u.id
            ORDER BY t.criado_em DESC
        """)
        rows = [dict(row) for row in cur.fetchall()]
        db.close()
        return jsonify(rows)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@ti_bp.route('/api/ti/tickets', methods=['POST'])
def create_ticket():
    from app import get_db_connection
    data = request.get_json()
    usuario_id = session.get('usuario_id')
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            INSERT INTO tickets (usuario_id, titulo, descricao, prioridade)
            VALUES (?, ?, ?, ?)
        """, (usuario_id, data.get('titulo'), data.get('descricao'), data.get('prioridade', 'Média')))
        db.commit()
        db.close()
        return jsonify({'sucesso': True}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500
# ── FERRAMENTAS DE SISTEMA (START ALL INTEGRADO) ────────────────
@ti_bp.route('/api/ti/system/init-db', methods=['POST'])
@ti_required
def ti_init_db():
    try:
        from init_db import init_db
        init_db()
        return jsonify({'sucesso': True, 'msg': 'Banco de dados reinicializado com sucesso.'})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@ti_bp.route('/api/ti/system/seed-users', methods=['POST'])
@ti_required
def ti_seed_users():
    try:
        from seed_users import seed
        seed()
        # Resetar senhas para 123 para garantir acesso do TCC
        from app import get_db_connection
        from werkzeug.security import generate_password_hash
        db = get_db_connection()
        cur = db.cursor()
        hash_123 = generate_password_hash('123')
        cur.execute("UPDATE usuarios SET senha = ?", (hash_123,))
        db.commit()
        db.close()
        return jsonify({'sucesso': True, 'msg': 'Usuários de teste criados e senhas resetadas para 123.'})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@ti_bp.route('/api/ti/system/cleanup-cpfs', methods=['POST'])
@ti_required
def ti_cleanup_cpfs():
    try:
        from app import normalizar_cpfs_legados
        normalizar_cpfs_legados()
        return jsonify({'sucesso': True, 'msg': 'CPFs normalizados com sucesso.'})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500
