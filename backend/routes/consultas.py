"""
Rotas de Consultas — Agendamento, Chat
"""

from flask import Blueprint, request, jsonify, session

consultas_bp = Blueprint('consultas', __name__)


# ── AGENDAR CONSULTA ─────────────────────────────────────────────
@consultas_bp.route('/api/consultas/agendar', methods=['POST'])
def agendar():
    from app import get_db_connection
    data = request.get_json()

    # Tenta sessão, depois tenta Header de fallback (para ambientes locais com restrição de cookies)
    paciente_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not paciente_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    medico_id = data.get('medico_id')
    especialidade = data.get('especialidade', '')
    data_consulta = data.get('data', '')
    hora = data.get('hora', '')
    tipo = data.get('tipo', 'presencial')

    queixa = data.get('queixa', '')

    if not medico_id or not data_consulta or not hora:
        return jsonify({'erro': 'Dados incompletos'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()
        
        if tipo == 'telemedicina':
            # Validação do Paciente
            cur.execute("SELECT status FROM telemedicina_usuarios WHERE paciente_id = ?", (paciente_id,))
            pac_tele = cur.fetchone()
            if not pac_tele or pac_tele['status'] != 'ativo':
                db.close()
                return jsonify({'erro': 'Você precisa solicitar acesso à Telemedicina no seu painel para agendar essa modalidade.'}), 403
                
            # Validação do Médico
            cur.execute("SELECT atende_telemedicina FROM usuarios WHERE id = ?", (medico_id,))
            med_tele = cur.fetchone()
            if not med_tele or not med_tele['atende_telemedicina']:
                db.close()
                return jsonify({'erro': 'Este médico não realiza atendimentos por Telemedicina no momento.'}), 403
        cur.execute("""
            INSERT INTO consultas (paciente_id, medico_id, especialidade, data, hora, tipo, status, queixa)
            VALUES (?, ?, ?, ?, ?, ?, 'confirmada', ?)
        """, (paciente_id, medico_id, especialidade, data_consulta, hora, tipo, queixa))
        db.commit()
        consulta_id = cur.lastrowid

        # Buscar nome do médico
        cur.execute("SELECT nome FROM usuarios WHERE id = ?", (medico_id,))
        med = cur.fetchone()
        medico_nome = med['nome'] if med else 'Médico'

        # Criar notificação
        cur.execute("""
            INSERT INTO notificacoes (usuario_id, mensagem)
            VALUES (?, ?)
        """, (paciente_id, f'Consulta agendada com Dr(a). {medico_nome} em {data_consulta} às {hora}'))
        db.commit()

        db.close()
        return jsonify({
            'sucesso': True,
            'id': consulta_id,
            'medico': medico_nome,
            'data': data_consulta,
            'hora': hora,
            'tipo': tipo,
            'especialidade': especialidade
        }), 201

    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── MINHAS CONSULTAS ─────────────────────────────────────────────
@consultas_bp.route('/api/consultas/minhas', methods=['GET'])
def minhas_consultas():
    from app import get_db_connection
    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            SELECT c.id, c.data, c.hora, c.especialidade, c.tipo, c.status, c.link_video,
                   med.nome AS medico_nome,
                   pac.nome AS paciente_nome
            FROM consultas c
            LEFT JOIN usuarios med ON c.medico_id = med.id
            LEFT JOIN usuarios pac ON c.paciente_id = pac.id
            WHERE c.paciente_id = ? OR c.medico_id = ?
            ORDER BY c.data DESC, c.hora DESC
        """, (usuario_id, usuario_id))
        rows = cur.fetchall()
        db.close()

        lista_consultas = []
        for r in rows:
            lista_consultas.append({
                'id': r['id'],
                'data': str(r['data']) if r['data'] else None,
                'hora': str(r['hora']) if r['hora'] else None,
                'especialidade': r['especialidade'],
                'tipo': r['tipo'],
                'status': r['status'],
                'link_video': r['link_video'],
                'medico': r['medico_nome'],
                'paciente': r['paciente_nome']
            })
        return jsonify(lista_consultas)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── CANCELAR CONSULTA ────────────────────────────────────────────
@consultas_bp.route('/api/consultas/<int:consulta_id>/cancelar', methods=['PUT'])
def cancelar(consulta_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("UPDATE consultas SET status = 'cancelada' WHERE id = ?", (consulta_id,))
        db.commit()
        db.close()
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ══════════════════════════════════════════════════════════════════
#  CHAT
# ══════════════════════════════════════════════════════════════════

@consultas_bp.route('/api/chat/enviar', methods=['POST'])
def enviar_msg():
    from app import get_db_connection
    data = request.get_json()

    remetente_id = session.get('usuario_id')
    consulta_id = data.get('consulta_id')
    mensagem = data.get('mensagem', '').strip()

    if not consulta_id or not mensagem:
        return jsonify({'erro': 'Dados incompletos'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            INSERT INTO chat (consulta_id, remetente_id, mensagem)
            VALUES (?, ?, ?)
        """, (consulta_id, remetente_id, mensagem))
        db.commit()
        msg_id = cur.lastrowid
        db.close()
        return jsonify({'sucesso': True, 'id': msg_id}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@consultas_bp.route('/api/chat/<int:consulta_id>', methods=['GET'])
def listar_msgs(consulta_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            SELECT c.id, c.mensagem, c.enviada_em, u.nome, u.tipo
            FROM chat c
            JOIN usuarios u ON c.remetente_id = u.id
            WHERE c.consulta_id = ?
            ORDER BY c.enviada_em ASC
        """, (consulta_id,))
        rows = cur.fetchall()
        db.close()
        return jsonify([{
            'id': r['id'], 'mensagem': r['mensagem'],
            'data': str(r['enviada_em']) if r['enviada_em'] else None,
            'remetente': r['nome'], 'tipo': r['tipo']
        } for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ══════════════════════════════════════════════════════════════════
#  NOTIFICAÇÕES
# ══════════════════════════════════════════════════════════════════

@consultas_bp.route('/api/notificacoes', methods=['GET'])
def listar_notificacoes():
    from app import get_db_connection
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify([])

    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            SELECT id, mensagem, lida, criada_em
            FROM notificacoes
            WHERE usuario_id = ?
            ORDER BY criada_em DESC
            LIMIT 20
        """, (usuario_id,))
        rows = cur.fetchall()
        db.close()
        return jsonify([{
            'id': r['id'], 'mensagem': r['mensagem'],
            'lida': bool(r['lida']), 'data': str(r['criada_em']) if r['criada_em'] else None
        } for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@consultas_bp.route('/api/notificacoes/<int:notif_id>/ler', methods=['PUT'])
def marcar_lida(notif_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("UPDATE notificacoes SET lida = 1 WHERE id = ?", (notif_id,))
        db.commit()
        db.close()
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500
