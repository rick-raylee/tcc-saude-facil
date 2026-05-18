from flask import Blueprint, request, jsonify, session
from datetime import datetime
import os
import uuid

telemedicina_bp = Blueprint('telemedicina', __name__)

def get_db():
    from app import get_db_connection
    return get_db_connection()

# ── LISTAR CONSULTAS DE TELEMEDICINA ──────────────────────────────
@telemedicina_bp.route('/api/telemedicina/consultas', methods=['GET'])
def listar_consultas():
    uid = session.get('usuario_id')
    tipo = (session.get('usuario_tipo') or request.headers.get('X-User-Type'))
    if not uid:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db()
        cur = db.cursor()
        
        if tipo in ['medico', 'medico_tele']:
            cur.execute("""
                SELECT c.id, c.data, c.hora, c.especialidade, c.tipo, c.status,
                       u.nome AS paciente_nome, u.cpf AS paciente_cpf, u.imagem AS paciente_foto
                FROM consultas c
                JOIN usuarios u ON c.paciente_id = u.id
                WHERE c.medico_id = ? AND c.tipo = 'telemedicina'
                ORDER BY c.data DESC, c.hora DESC
            """, (uid,))
        else:
            cur.execute("""
                SELECT c.id, c.data, c.hora, c.especialidade, c.tipo, c.status,
                       u.nome AS medico_nome, m.crm, u.imagem AS medico_foto
                FROM consultas c
                JOIN usuarios u ON c.medico_id = u.id
                LEFT JOIN medico_info m ON m.usuario_id = u.id
                WHERE c.paciente_id = ? AND c.tipo = 'telemedicina'
                ORDER BY c.data DESC, c.hora DESC
            """, (uid,))
        
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ── ATUALIZAR STATUS DA CONSULTA (SALA DE ESPERA/ATENDIMENTO) ───────
@telemedicina_bp.route('/api/telemedicina/status', methods=['POST'])
def atualizar_status():
    uid = session.get('usuario_id')
    if (session.get('usuario_tipo') or request.headers.get('X-User-Type')) not in ['medico', 'medico_tele']:
        return jsonify({'erro': 'Não autorizado'}), 403
    
    data = request.get_json()
    cid = data.get('consulta_id')
    novo_status = data.get('status') # 'em_atendimento', 'finalizada', 'agendada'
    
    if not cid or not novo_status:
        return jsonify({'erro': 'Dados incompletos'}), 400

    try:
        db = get_db()
        cur = db.cursor()
        cur.execute("UPDATE consultas SET status = ? WHERE id = ? AND medico_id = ?", (novo_status, cid, uid))
        db.commit()
        db.close()
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ── GRAVAR HISTÓRICO E DOCUMENTOS DIGITAIS ──────────────────────────
@telemedicina_bp.route('/api/telemedicina/gerar-documento', methods=['POST'])
def gerar_documento():
    uid = session.get('usuario_id')
    if (session.get('usuario_tipo') or request.headers.get('X-User-Type')) not in ['medico', 'medico_tele']:
        return jsonify({'erro': 'Não autorizado'}), 403
        
    data = request.get_json()
    tipo_doc = data.get('tipo') # 'atestado', 'declaracao', 'prescricao'
    cid = data.get('consulta_id')
    pid = data.get('paciente_id')
    
    if not tipo_doc or not pid:
        return jsonify({'erro': 'Dados incompletos'}), 400

    token_assinatura = "SIG-" + str(uuid.uuid4())[:8].upper()
    
    try:
        db = get_db()
        cur = db.cursor()
        
        if tipo_doc == 'atestado':
            texto = data.get('texto', f"Atesto que o paciente esteve em teleconsulta no dia {datetime.now().strftime('%d/%m/%Y')}.")
            cur.execute("""
                INSERT INTO atestados (consulta_id, medico_id, paciente_id, dias_afastamento, motivo, cid, texto, assinatura_digital)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (cid, uid, pid, data.get('dias', 1), data.get('motivo', 'Consulta Médica'), data.get('cid_code', ''), texto, token_assinatura))
        
        elif tipo_doc == 'declaracao':
            cur.execute("""
                INSERT INTO declaracoes (consulta_id, medico_id, paciente_id, data, horario, assinatura_digital)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (cid, uid, pid, datetime.now().strftime('%Y-%m-%d'), datetime.now().strftime('%H:%M'), token_assinatura))
            
        elif tipo_doc == 'prescricao':
            cur.execute("""
                INSERT INTO prescricoes (consulta_id, paciente_id, medico_id, medicamento, dosagem, frequencia, via_administracao, duracao, observacoes, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ativa')
            """, (cid, pid, uid, data.get('medicamento'), data.get('dosagem'), data.get('frequencia'), data.get('via', 'Oral'), data.get('duracao'), data.get('obs')))
            
        db.commit()
        db.close()
        
        return jsonify({
            'sucesso': True, 
            'token': token_assinatura,
            'msg': f'{tipo_doc.capitalize()} gerado e assinado com sucesso.'
        })
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ── ATUALIZAR PERFIL DE TELEMEDICINA DO MÉDICO ──────────────────────
@telemedicina_bp.route('/api/telemedicina/config-perfil', methods=['POST'])
def config_perfil():
    uid = session.get('usuario_id')
    if (session.get('usuario_tipo') or request.headers.get('X-User-Type')) not in ['medico', 'medico_tele']:
        return jsonify({'erro': 'Somente médicos'}), 403
    
    data = request.get_json()
    tipo_atendimento = data.get('tipo_atendimento', 'presencial')
    unidade = data.get('unidade_vinculada', '')
    horarios = data.get('horarios_tele_json', '{}')
    atende_tele = 1 if tipo_atendimento in ['telemedicina', 'ambos'] else 0
    link_padrao = data.get('link_sala_padrao', f'https://meet.jit.si/TCC_CEEP_{uid}')

    try:
        db = get_db()
        cur = db.cursor()
        
        # Opcionalmente ignora erro se medico_info não existir dependendo do fluxo
        try:
            cur.execute("""
                UPDATE medico_info 
                SET tipo_atendimento = ?, unidade_vinculada = ?, horarios_tele_json = ?
                WHERE usuario_id = ?
            """, (tipo_atendimento, unidade, horarios, uid))
        except Exception:
            pass # fallback if medico_info missing
            
        # Atualiza a tabela usuarios principal (conforme regras do projeto)
        cur.execute("""
            UPDATE usuarios 
            SET atende_telemedicina = ?, link_sala_padrao = ?
            WHERE id = ?
        """, (atende_tele, link_padrao, uid))

        db.commit()
        db.close()
        return jsonify({'sucesso': True, 'msg': 'Configurações de telemedicina ativadas'})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ── REGISTRO DE PACIENTE PARA TELEMEDICINA ──────────────────────────
@telemedicina_bp.route('/api/telemedicina/paciente/registro', methods=['POST'])
def paciente_registro():
    uid = session.get('usuario_id')
    if (session.get('usuario_tipo') or request.headers.get('X-User-Type')) != 'paciente':
        return jsonify({'erro': 'Somente pacientes podem se inscrever na telemedicina.'}), 403
    
    try:
        db = get_db()
        cur = db.cursor()
        
        # Checa duplicidade
        cur.execute("SELECT id FROM telemedicina_usuarios WHERE paciente_id = ?", (uid,))
        if cur.fetchone():
            db.close()
            return jsonify({'sucesso': False, 'erro': 'Você já possui registro na Telemedicina.'})
            
        cur.execute("SELECT cpf FROM usuarios WHERE id = ?", (uid,))
        cpf = cur.fetchone()['cpf']
        
        cur.execute("""
            INSERT INTO telemedicina_usuarios (paciente_id, cpf, status)
            VALUES (?, ?, 'ativo')
        """, (uid, cpf))
        
        db.commit()
        db.close()
        return jsonify({'sucesso': True, 'msg': 'Registro de Telemedicina habilitado com sucesso.'})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ── LISTAR DOCUMENTOS DO PACIENTE (TELEMEDICINA) ────────────────────
@telemedicina_bp.route('/api/telemedicina/meus-documentos', methods=['GET'])
def meus_documentos():
    uid = session.get('usuario_id')
    if not uid: return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db()
        cur = db.cursor()
        
        # Atestados
        cur.execute("SELECT *, 'atestado' as tipo_doc FROM atestados WHERE paciente_id = ?", (uid,))
        atest = [dict(r) for r in cur.fetchall()]
        
        # Declaracoes
        cur.execute("SELECT *, 'declaracao' as tipo_doc FROM declaracoes WHERE paciente_id = ?", (uid,))
        decl = [dict(r) for r in cur.fetchall()]
        
        # Prescrições
        cur.execute("SELECT *, 'prescricao' as tipo_doc FROM prescricoes WHERE paciente_id = ?", (uid,))
        presc = [dict(r) for r in cur.fetchall()]
        
        db.close()
        return jsonify({'atestados': atest, 'declaracoes': decl, 'prescricoes': presc})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ── ESTATÍSTICAS PARA DASHBOARD (ADMIN) ──────────────────────────
@telemedicina_bp.route('/api/telemedicina/estatisticas', methods=['GET'])
def estatisticas():
    if (session.get('usuario_tipo') or request.headers.get('X-User-Type')) != 'admin':
        return jsonify({'erro': 'Não autorizado'}), 403
    
    try:
        db = get_db()
        cur = db.cursor()
        
        stats = {}
        
        # Total
        cur.execute("SELECT COUNT(*) as total FROM consultas WHERE tipo = 'telemedicina'")
        stats['total'] = cur.fetchone()['total']
        
        # Hoje
        hoje = datetime.now().strftime('%Y-%m-%d')
        cur.execute("SELECT COUNT(*) as hoje FROM consultas WHERE tipo = 'telemedicina' AND data = ?", (hoje,))
        stats['hoje'] = cur.fetchone()['hoje']
        
        # Especialidades mais usadas
        cur.execute("""
            SELECT especialidade, COUNT(*) as qtd 
            FROM consultas 
            WHERE tipo = 'telemedicina' 
            GROUP BY especialidade 
            ORDER BY qtd DESC 
            LIMIT 5
        """)
        stats['especialidades'] = [dict(r) for r in cur.fetchall()]
        
        # Pacientes únicos
        cur.execute("SELECT COUNT(DISTINCT paciente_id) as pacientes FROM consultas WHERE tipo = 'telemedicina'")
        stats['pacientes_unicos'] = cur.fetchone()['pacientes']
        
        db.close()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500
