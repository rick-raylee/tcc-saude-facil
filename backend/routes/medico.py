"""
Rotas do Médico — Atendimento, Prontuário, Receita, Atestado
"""

from flask import Blueprint, request, jsonify, session
from datetime import datetime

medico_bp = Blueprint('medico', __name__)


# ── AGENDA DO MÉDICO ─────────────────────────────────────────────
@medico_bp.route('/api/medico/agenda', methods=['GET'])
def agenda():
    from app import get_db_connection
    # Tenta sessão, depois tenta Header de fallback (para ambientes locais com restrição de cookies)
    medico_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not medico_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            SELECT c.id, c.data, c.hora, c.especialidade, c.tipo, c.status, c.queixa,
                   u.nome AS paciente_nome, u.cpf AS paciente_cpf
            FROM consultas c
            JOIN usuarios u ON c.paciente_id = u.id
            WHERE c.medico_id = ?
            ORDER BY c.data ASC, c.hora ASC
        """, (medico_id,))
        rows = cur.fetchall()
        db.close()

        agenda_lista = []
        for r in rows:
            agenda_lista.append({
                'id': r['id'],
                'data': str(r['data']) if r['data'] else None,
                'hora': str(r['hora']) if r['hora'] else None,
                'especialidade': r['especialidade'],
                'tipo': r['tipo'],
                'status': r['status'],
                'paciente': r['paciente_nome'],
                'cpf': r['paciente_cpf'],
                'queixa': r['queixa']
            })
        return jsonify(agenda_lista)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── RESUMO DO MÉDICO ─────────────────────────────────────────────
@medico_bp.route('/api/medico/resumo', methods=['GET'])
def resumo():
    from app import get_db_connection
    medico_id = session.get('usuario_id')
    if not medico_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        hoje = datetime.now().strftime('%Y-%m-%d')

        # Tipo de Atendimento do Médico
        cur.execute("SELECT tipo_atendimento, presencial_ativo, atende_amanha FROM medico_info WHERE usuario_id = ?", (medico_id,))
        medInfo = cur.fetchone()
        tipo_atendimento = medInfo['tipo_atendimento'] if medInfo else 'presencial'
        presencial_ativo = False
        atende_amanha = True
        if medInfo:
            try:
                presencial_ativo = bool(medInfo['presencial_ativo'])
            except Exception:
                pass
            try:
                atende_amanha = bool(medInfo['atende_amanha']) if medInfo['atende_amanha'] is not None else True
            except Exception:
                pass

        # Consultas Hoje
        cur.execute("SELECT COUNT(*) FROM consultas WHERE medico_id = ? AND data = ?", (medico_id, hoje))
        hoje_count = cur.fetchone()[0]

        # Confirmadas Hoje
        cur.execute("SELECT COUNT(*) FROM consultas WHERE medico_id = ? AND data = ? AND status IN ('confirmada', 'agendada')", (medico_id, hoje))
        total_confirmadas = cur.fetchone()[0]

        # Aguardando ou Chegou Hoje (Presencial ou Telemedicina Confirmada)
        if tipo_atendimento == 'telemedicina':
            cur.execute("""
                SELECT COUNT(*) FROM consultas 
                WHERE medico_id = ? AND data = ? 
                AND (status = 'aguardando' OR (status = 'confirmada' AND tipo = 'telemedicina'))
            """, (medico_id, hoje))
        else:
            cur.execute("SELECT COUNT(*) FROM consultas WHERE medico_id = ? AND data = ? AND status = 'aguardando'", (medico_id, hoje))
        
        aguardando = cur.fetchone()[0]

        # Faltas Hoje
        cur.execute("SELECT COUNT(*) FROM consultas WHERE medico_id = ? AND data = ? AND status IN ('falta', 'cancelada')", (medico_id, hoje))
        faltas = cur.fetchone()[0]

        # TOTAL DE TRIAGENS HOJE (Geral do sistema para este médico ver o fluxo)
        cur.execute("SELECT COUNT(*) FROM triagens WHERE criado_em LIKE ?", (f"{hoje}%",))
        triagens_hoje = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM prontuarios WHERE medico_id = ?", (medico_id,))
        total_prontuarios = cur.fetchone()[0]
        
        # Mock de Doenças frequentes (pode ser query real depois no prontuario)
        doencas_frequentes = [
            {'nome': 'Hipertensão', 'pct': '45%'},
            {'nome': 'Diabetes', 'pct': '30%'},
            {'nome': 'Asma', 'pct': '15%'}
        ]

        db.close()

        return jsonify({
            'tipo_atendimento': tipo_atendimento,
            'presencial_ativo': presencial_ativo,
            'atende_amanha': atende_amanha,
            'consultasHoje': hoje_count,
            'confirmadas': total_confirmadas,
            'aguardando': aguardando,
            'faltas': faltas,
            'triagens_hoje': triagens_hoje,
            'prontuarios': total_prontuarios,
            'doencas_frequentes': doencas_frequentes,
            'ocupacao_agenda': min(100, int((hoje_count / 15) * 100)) if hoje_count > 0 else 0
        })
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── CHAMAR PRÓXIMO DA FILA ───────────────────────────────────────────────
@medico_bp.route('/api/medico/proximo_fila', methods=['POST'])
def proximo_fila():
    from app import get_db_connection
    from datetime import datetime
    medico_id = session.get('usuario_id')
    if not medico_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        hoje = datetime.now().strftime('%Y-%m-%d')

        cur.execute("""
            SELECT c.id, c.senha_fila, u.nome, u.cpf 
            FROM consultas c
            JOIN usuarios u ON c.paciente_id = u.id
            WHERE c.medico_id = ? AND c.data = ? AND c.status = 'aguardando'
            ORDER BY c.hora ASC
            LIMIT 1
        """, (medico_id, hoje))
        
        proximo = cur.fetchone()
        
        if not proximo:
            db.close()
            return jsonify({'msg': 'Fila vazia'}), 200
            
        cur.execute("UPDATE consultas SET status = 'em_andamento' WHERE id = ?", (proximo['id'],))
        db.commit()
        db.close()

        return jsonify({
            'senha': proximo['senha_fila'],
            'paciente_nome': proximo['nome'],
            'paciente_cpf': proximo['cpf']
        })
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── PRESCREVER MEDICAÇÃO PARA ENFERMAGEM ─────────────────────────
@medico_bp.route('/api/medico/prescrever', methods=['POST'])
def prescrever_enfermagem():
    from app import get_db_connection
    medico_id = session.get('usuario_id')
    if not medico_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    data = request.get_json()
    paciente_cpf = data.get('paciente_cpf', '')
    
    try:
        db = get_db_connection()
        cur = db.cursor()

        # Buscar paciente ID
        cur.execute("SELECT id FROM usuarios WHERE cpf = ?", (paciente_cpf,))
        pac = cur.fetchone()
        if not pac:
            db.close()
            return jsonify({'erro': 'Paciente não encontrado'}), 404
        
        paciente_id = pac['id']

        cur.execute("""
            INSERT INTO prescricoes (paciente_id, medico_id, medicamento, dosagem, frequencia, via_administracao, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            paciente_id, medico_id,
            data.get('medicamento', ''),
            data.get('dosagem', ''),
            data.get('frequencia', ''),
            data.get('via', ''),
            data.get('observacoes', '')
        ))

        db.commit()
        db.close()

        return jsonify({'sucesso': True}), 201

    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── BUSCAR PACIENTE (por CPF) ────────────────────────────────────
@medico_bp.route('/api/medico/buscar-paciente', methods=['GET'])
def buscar_paciente():
    from app import get_db_connection
    cpf = request.args.get('cpf', '').strip()

    if not cpf:
        return jsonify({'erro': 'CPF não informado'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()
        
        # Normalizar CPF de busca (remover pontos, hifens e espaços)
        cpf_limpo = "".join(filter(str.isdigit, cpf))
        
        cur.execute("""
            SELECT id, nome, cpf, sus, email, telefone, cidade, bairro, data_nascimento
            FROM usuarios 
            WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?
        """, (cpf_limpo,))
        u = cur.fetchone()

        if not u:
            db.close()
            return jsonify({'erro': 'Paciente não encontrado'}), 404

        paciente = {
            'id': u['id'], 'nome': u['nome'], 'cpf': u['cpf'], 'sus': u['sus'],
            'email': u['email'], 'telefone': u['telefone'], 'cidade': u['cidade'],
            'bairro': u['bairro'], 'data_nascimento': str(u['data_nascimento']) if u['data_nascimento'] else None
        }

        # Buscar triagem mais recente
        cur.execute("""
            SELECT t.peso, t.altura, t.pressao, t.freq_cardiaca, t.temperatura,
                   t.saturacao, t.queixa, t.prioridade, t.imc, t.criado_em,
                   enf.nome AS enfermeiro
            FROM triagens t
            LEFT JOIN usuarios enf ON t.enfermeiro_id = enf.id
            WHERE t.paciente_id = ?
            ORDER BY t.criado_em DESC LIMIT 1
        """, (u['id'],))
        triagem = cur.fetchone()

        if triagem:
            paciente['triagem'] = {
                'peso': str(triagem['peso']) if triagem['peso'] else None,
                'altura': str(triagem['altura']) if triagem['altura'] else None,
                'pressao': triagem['pressao'],
                'fc': triagem['freq_cardiaca'],
                'temperatura': str(triagem['temperatura']) if triagem['temperatura'] else None,
                'saturacao': triagem['saturacao'],
                'queixa': triagem['queixa'],
                'prioridade': triagem['prioridade'],
                'imc': str(triagem['imc']) if triagem['imc'] else None,
                'data': str(triagem['criado_em']) if triagem['criado_em'] else None,
                'enfermeiro': triagem['enfermeiro']
            }

        # Buscar doenças
        cur.execute("SELECT id, nome FROM paciente_doencas WHERE paciente_id = ?", (u['id'],))
        doencas = cur.fetchall()
        paciente['doencas'] = [{'id': d['id'], 'nome': d['nome']} for d in doencas]

        db.close()
        return jsonify(paciente)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── SALVAR ATENDIMENTO (PRONTUÁRIO) ──────────────────────────────
@medico_bp.route('/api/medico/atendimento', methods=['POST'])
def salvar_atendimento():
    from app import get_db_connection
    data = request.get_json()

    medico_id = session.get('usuario_id')
    paciente_cpf = data.get('paciente_cpf', '')
    queixa = data.get('queixa', '')
    diagnostico = data.get('diagnostico', '')
    conduta = data.get('conduta', data.get('tratamento', '')) # Aceita tratamento do frontend
    observacoes = data.get('observacoes', '')
    consulta_id = data.get('consulta_id')

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Buscar paciente
        cur.execute("SELECT id FROM usuarios WHERE cpf = ?", (paciente_cpf,))
        pac = cur.fetchone()
        paciente_id = pac['id'] if pac else None

        if not paciente_id:
            db.close()
            return jsonify({'erro': 'Paciente não encontrado'}), 404

        # Tentar vincular à consulta da fila ou agendada
        if not consulta_id:
            cur.execute("""
                SELECT id FROM consultas 
                WHERE paciente_id = ? AND medico_id = ? AND status IN ('em_andamento', 'aguardando')
                ORDER BY id DESC LIMIT 1
            """, (paciente_id, medico_id))
            fila_info = cur.fetchone()
            
            if fila_info:
                consulta_id = fila_info['id']
            else:
                cur.execute("""
                    INSERT INTO consultas (paciente_id, medico_id, data, hora, status, tipo)
                    VALUES (?, ?, date('now'), time('now'), 'finalizada', 'presencial')
                """, (paciente_id, medico_id))
                db.commit()
                consulta_id = cur.lastrowid

        # Salvar prontuário
        cur.execute("""
            INSERT INTO prontuarios (consulta_id, paciente_id, medico_id, queixa, diagnostico, conduta, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (consulta_id, paciente_id, medico_id, queixa, diagnostico, conduta, observacoes))
        db.commit()
        prontuario_id = cur.lastrowid

        # Salvar receita (se houver medicamentos)
        medicamentos = data.get('medicamentos', '')
        instrucoes = data.get('instrucoes', '')
        if medicamentos:
            cur.execute("""
                INSERT INTO receitas (prontuario_id, medicamentos, instrucoes)
                VALUES (?, ?, ?)
            """, (prontuario_id, medicamentos, instrucoes))
            db.commit()

        # Atualizar status da consulta, a confirmação do médico e o encaminhamento
        encaminhado_para_medico_id = data.get('encaminhado_para_medico_id')
        if encaminhado_para_medico_id in ('', 'null', 'None', None):
            encaminhado_para_medico_id = None
        else:
            try:
                encaminhado_para_medico_id = int(encaminhado_para_medico_id)
            except ValueError:
                encaminhado_para_medico_id = None

        cur.execute("""
            UPDATE consultas 
            SET status = 'finalizada', confirmacao_medico = 1, encaminhado_para_medico_id = ? 
            WHERE id = ?
        """, (encaminhado_para_medico_id, consulta_id))
        db.commit()

        # Se houver encaminhamento, gera a notificação correspondente
        if encaminhado_para_medico_id:
            cur.execute("SELECT nome FROM usuarios WHERE id = ?", (encaminhado_para_medico_id,))
            ref_med = cur.fetchone()
            ref_medico_nome = ref_med['nome'] if ref_med else 'Especialista'
            
            cur.execute("SELECT nome FROM usuarios WHERE id = ?", (medico_id,))
            med = cur.fetchone()
            medico_nome = med['nome'] if med else 'Médico'
            
            cur.execute("""
                INSERT INTO notificacoes (usuario_id, mensagem)
                VALUES (?, ?)
            """, (paciente_id, f'Você foi encaminhado(a) pelo(a) Dr(a). {medico_nome} para o(a) especialista {ref_medico_nome}. Acesse seu perfil para agendar.'))
            db.commit()

        # Verificar se o paciente já confirmou para gerar a notificação de confirmação conjunta
        cur.execute("SELECT paciente_id, data, confirmacao_paciente FROM consultas WHERE id = ?", (consulta_id,))
        cons = cur.fetchone()
        if cons and cons['confirmacao_paciente'] == 1:
            cur.execute("SELECT nome FROM usuarios WHERE id = ?", (medico_id,))
            med = cur.fetchone()
            medico_nome = med['nome'] if med else 'Médico'
            
            cur.execute("""
                INSERT INTO notificacoes (usuario_id, mensagem)
                VALUES (?, ?)
            """, (cons['paciente_id'], f'Sua consulta presencial com Dr(a). {medico_nome} em {cons["data"]} foi realizada e confirmada por ambas as partes!'))
            db.commit()

        db.close()
        return jsonify({'sucesso': True, 'prontuario_id': prontuario_id, 'consulta_id': consulta_id}), 201

    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── GERAR ATESTADO ───────────────────────────────────────────────
@medico_bp.route('/api/medico/atestado', methods=['POST'])
def gerar_atestado():
    from app import get_db_connection
    data = request.get_json()

    medico_id = session.get('usuario_id')
    paciente_cpf = data.get('paciente_cpf', '')
    dias = data.get('dias', 1)
    motivo = data.get('motivo', '')
    cid = data.get('cid', '')
    consulta_id = data.get('consulta_id')

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Buscar paciente
        cur.execute("SELECT id, nome FROM usuarios WHERE cpf = ?", (paciente_cpf,))
        pac = cur.fetchone()
        if not pac:
            db.close()
            return jsonify({'erro': 'Paciente não encontrado'}), 404

        p_id = pac['id']
        p_nome = pac['nome']

        # Buscar nome do médico e CRM
        cur.execute("""
            SELECT u.nome, m.crm, m.especialidade
            FROM usuarios u
            LEFT JOIN medico_info m ON m.usuario_id = u.id
            WHERE u.id = ?
        """, (medico_id,))
        med = cur.fetchone()
        m_nome = med['nome'] if med else 'Médico'
        m_crm = med['crm'] if med else ''
        m_esp = med['especialidade'] if med else ''

        # Gerar texto do atestado
        hoje = datetime.now().strftime('%d/%m/%Y')
        msg_texto = f"""ATESTADO MÉDICO

Atesto para os devidos fins que o(a) paciente {p_nome}, portador(a) do CPF {paciente_cpf}, esteve sob meus cuidados médicos nesta data, necessitando de {dias} dia(s) de afastamento de suas atividades.

Motivo: {motivo}
{f'CID: {cid}' if cid else ''}

Data: {hoje}

Dr(a). {m_nome}
CRM: {m_crm}
{m_esp}

Portal Saúde Digital — Cascavel/PR"""

        # Salvar no banco
        cur.execute("""
            INSERT INTO atestados (consulta_id, medico_id, paciente_id, dias_afastamento, motivo, cid, texto)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (consulta_id, medico_id, p_id, dias, motivo, cid, msg_texto))
        db.commit()
        atestado_id = cur.lastrowid
        db.close()

        return jsonify({
            'sucesso': True,
            'atestado_id': atestado_id,
            'texto': msg_texto,
            'paciente': p_nome,
            'medico': m_nome,
            'crm': m_crm,
            'dias': dias,
            'data': hoje
        }), 201

    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── LISTAR MÉDICOS (para agendamento) ───────────────────────────
@medico_bp.route('/api/medicos', methods=['GET'])
def listar_medicos():
    from app import get_db_connection
    especialidade = request.args.get('especialidade', '')

    try:
        db = get_db_connection()
        cur = db.cursor()
        if especialidade:
            esp_lower = especialidade.lower()
            if esp_lower in ['cardiologia', 'cardiologista']:
                cur.execute("""
                    SELECT u.id, u.nome, m.crm, m.especialidade, m.atende_telemedicina, m.presencial_ativo, m.atende_amanha
                    FROM usuarios u
                    JOIN medico_info m ON m.usuario_id = u.id
                    WHERE u.tipo = 'medico' AND (m.especialidade = 'Cardiologia' OR m.especialidade = 'Cardiologista')
                """)
            elif esp_lower in ['clínica geral', 'clinico geral', 'clínico geral', 'clinica geral']:
                cur.execute("""
                    SELECT u.id, u.nome, m.crm, m.especialidade, m.atende_telemedicina, m.presencial_ativo, m.atende_amanha
                    FROM usuarios u
                    JOIN medico_info m ON m.usuario_id = u.id
                    WHERE u.tipo = 'medico' AND (m.especialidade = 'Clínica Geral' OR m.especialidade = 'Clínico Geral' OR m.especialidade = 'Clinica Geral')
                """)
            else:
                cur.execute("""
                    SELECT u.id, u.nome, m.crm, m.especialidade, m.atende_telemedicina, m.presencial_ativo, m.atende_amanha
                    FROM usuarios u
                    JOIN medico_info m ON m.usuario_id = u.id
                    WHERE u.tipo = 'medico' AND m.especialidade = ?
                """, (especialidade,))
        else:
            cur.execute("""
                SELECT u.id, u.nome, m.crm, m.especialidade, m.atende_telemedicina, m.presencial_ativo, m.atende_amanha
                FROM usuarios u
                JOIN medico_info m ON m.usuario_id = u.id
                WHERE u.tipo = 'medico'
            """)
        rows = cur.fetchall()
        db.close()

        lista_medicos = []
        for r in rows:
            # Safe column check
            pres_ativo = False
            if 'presencial_ativo' in r.keys():
                pres_ativo = bool(r['presencial_ativo'])
            atende_amanha = True
            if 'atende_amanha' in r.keys() and r['atende_amanha'] is not None:
                atende_amanha = bool(r['atende_amanha'])
            lista_medicos.append({
                'id': r['id'], 'nome': r['nome'], 'crm': r['crm'],
                'especialidade': r['especialidade'], 'telemedicina': bool(r['atende_telemedicina']),
                'presencial_ativo': pres_ativo,
                'atende_amanha': atende_amanha
            })
        return jsonify(lista_medicos)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── LISTAR ESPECIALIDADES ───────────────────────────────────────
@medico_bp.route('/api/especialidades', methods=['GET'])
def listar_especialidades():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT DISTINCT especialidade FROM medico_info WHERE especialidade IS NOT NULL AND especialidade != ''")
        rows = cur.fetchall()
        db.close()
        return jsonify([r['especialidade'] for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── ALTERAR PRESENÇA PRESENCIAL DO MÉDICO (AUTO CHECK-IN) ────────
@medico_bp.route('/api/medico/presenca', methods=['POST'])
def alterar_presenca():
    from app import get_db_connection
    medico_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not medico_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    data = request.get_json() or {}
    presencial_ativo = data.get('presencial_ativo')

    if presencial_ativo is None:
        return jsonify({'erro': 'Status de presença não informado'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Garantir que a linha de medico_info existe
        cur.execute("SELECT id FROM medico_info WHERE usuario_id = ?", (medico_id,))
        row = cur.fetchone()
        
        status_num = 1 if presencial_ativo else 0
        if not row:
            cur.execute("""
                INSERT INTO medico_info (usuario_id, presencial_ativo, tipo_atendimento) 
                VALUES (?, ?, 'presencial')
            """, (medico_id, status_num))
        else:
            cur.execute("""
                UPDATE medico_info 
                SET presencial_ativo = ? 
                WHERE usuario_id = ?
            """, (status_num, medico_id))

        db.commit()
        db.close()
        return jsonify({'sucesso': True, 'presencial_ativo': bool(presencial_ativo)})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── ALTERAR SE ATENDE AMANHÃ ───────────────────────────────────
@medico_bp.route('/api/medico/presenca-amanha', methods=['POST'])
def alterar_presenca_amanha():
    from app import get_db_connection
    medico_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not medico_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    data = request.get_json() or {}
    atende_amanha = data.get('atende_amanha')

    if atende_amanha is None:
        return jsonify({'erro': 'Status de atendimento para amanhã não informado'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Garantir que a linha de medico_info existe
        cur.execute("SELECT id FROM medico_info WHERE usuario_id = ?", (medico_id,))
        row = cur.fetchone()
        
        status_num = 1 if atende_amanha else 0
        if not row:
            cur.execute("""
                INSERT INTO medico_info (usuario_id, atende_amanha, tipo_atendimento) 
                VALUES (?, ?, 'presencial')
            """, (medico_id, status_num))
        else:
            cur.execute("""
                UPDATE medico_info 
                SET atende_amanha = ? 
                WHERE usuario_id = ?
            """, (status_num, medico_id))

        db.commit()
        db.close()
        return jsonify({'sucesso': True, 'atende_amanha': bool(atende_amanha)})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

