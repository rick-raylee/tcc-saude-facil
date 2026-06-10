"""
Rotas do Paciente — Perfil, Histórico, Vacinas
"""

from flask import Blueprint, request, jsonify, session

paciente_bp = Blueprint('paciente', __name__)


# ── PERFIL DO PACIENTE ───────────────────────────────────────────
@paciente_bp.route('/api/paciente/perfil', methods=['GET'])
def perfil():
    from app import get_db_connection

    # Tenta sessão, depois tenta Header de fallback (para ambientes locais com restrição de cookies)
    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT id, nome, cpf, sus, email, tipo, telefone, cidade, bairro, data_nascimento, imagem FROM usuarios WHERE id = ?", (usuario_id,))
        u = cur.fetchone()
        db.close()

        if not u:
            return jsonify({'erro': 'Usuário não encontrado'}), 404

        return jsonify({
            'id': u['id'], 'nome': u['nome'], 'cpf': u['cpf'], 'sus': u['sus'],
            'email': u['email'], 'tipo': u['tipo'], 'telefone': u['telefone'],
            'cidade': u['cidade'], 'bairro': u['bairro'], 'imagem': u['imagem'],
            'data_nascimento': str(u['data_nascimento']) if u['data_nascimento'] else None
        })
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── HISTÓRICO DE CONSULTAS ───────────────────────────────────────
@paciente_bp.route('/api/paciente/historico', methods=['GET'])
def historico():
    from app import get_db_connection

    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            SELECT c.id, c.data, c.hora, c.especialidade, c.tipo, c.status,
                   u.nome AS medico_nome,
                   p.diagnostico, p.queixa, p.conduta
            FROM consultas c
            LEFT JOIN usuarios u ON c.medico_id = u.id
            LEFT JOIN prontuarios p ON p.consulta_id = c.id
            WHERE c.paciente_id = ?
            ORDER BY c.data DESC, c.hora DESC
        """, (usuario_id,))
        rows = cur.fetchall()
        db.close()

        historico = []
        for r in rows:
            historico.append({
                'id': r['id'],
                'data': str(r['data']) if r['data'] else None,
                'hora': str(r['hora']) if r['hora'] else None,
                'especialidade': r['especialidade'],
                'tipo': r['tipo'],
                'status': r['status'],
                'medico': r['medico_nome'],
                'diagnostico': r['diagnostico'],
                'queixa': r['queixa'],
                'conduta': r['conduta']
            })

        return jsonify(historico)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── VACINAS DO PACIENTE ──────────────────────────────────────────
@paciente_bp.route('/api/paciente/vacinas', methods=['GET'])
def vacinas():
    from app import get_db_connection

    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    cpf = request.args.get('cpf', '')

    try:
        db = get_db_connection()
        cur = db.cursor()

        if cpf:
            cur.execute("SELECT id FROM usuarios WHERE cpf = ?", (cpf,))
            u = cur.fetchone()
            if u:
                usuario_id = u['id']

        if not usuario_id:
            db.close()
            return jsonify({'erro': 'Paciente não encontrado'}), 404

        cur.execute("""
            SELECT va.id, va.vacina_nome, va.dose, va.lote, va.local_aplicacao,
                   va.criado_em, u.nome AS enfermeiro_nome
            FROM vacinas_aplicadas va
            LEFT JOIN usuarios u ON va.enfermeiro_id = u.id
            WHERE va.paciente_id = ?
            ORDER BY va.criado_em DESC
        """, (usuario_id,))
        rows = cur.fetchall()

        # Se não houver NENHUMA vacina cadastrada no banco para este paciente, semeamos as vacinas do TCC
        if len(rows) == 0:
            vacinas_simuladas = [
                {"nome": "VIP (Poliomielite Inativada)", "dose": "1ª Dose", "data": "1996-07-15", "local": "UBS Centro"},
                {"nome": "Pneumocócica 10 Valente", "dose": "1ª Dose", "data": "1996-07-15", "local": "UBS Centro"},
                {"nome": "Rotavírus Humano", "dose": "1ª Dose", "data": "1996-07-15", "local": "UBS Centro"},
                {"nome": "Febre Amarela", "dose": "Dose Inicial", "data": "1997-02-10", "local": "UBS Periolo"},
                {"nome": "Tríplice Viral", "dose": "1ª Dose", "data": "1997-05-12", "local": "UBS Centro"},
                {"nome": "Dupla Adulto (dT)", "dose": "Reforço a cada 10 anos", "data": "2016-05-20", "local": "UBS Coqueiral"},
                {"nome": "Influenza (Gripe)", "dose": "Anual", "data": "2025-04-15", "local": "Campanha 2025"},
                {"nome": "Covid-19", "dose": "Periódica", "data": "2025-01-20", "local": "Campanha Bivalente"}
            ]
            for v in vacinas_simuladas:
                cur.execute("""
                    INSERT INTO vacinas_aplicadas (paciente_id, enfermeiro_id, vacina_nome, dose, lote, local_aplicacao, criado_em)
                    VALUES (?, NULL, ?, ?, 'SIM-999', ?, ?)
                """, (usuario_id, v["nome"], v["dose"], v["local"], v["data"]))
            db.commit()
            
            # Consultar novamente
            cur.execute("""
                SELECT va.id, va.vacina_nome, va.dose, va.lote, va.local_aplicacao,
                       va.criado_em, u.nome AS enfermeiro_nome
                FROM vacinas_aplicadas va
                LEFT JOIN usuarios u ON va.enfermeiro_id = u.id
                WHERE va.paciente_id = ?
                ORDER BY va.criado_em DESC
            """, (usuario_id,))
            rows = cur.fetchall()

        db.close()

        resultado = []
        for r in rows:
            resultado.append({
                'id': r['id'],
                'vacina_id': r['id'], # Alias para o frontend
                'vacina': r['vacina_nome'],
                'dose': r['dose'],
                'lote': r['lote'],
                'local': r['local_aplicacao'],
                'data': str(r['criado_em']) if r['criado_em'] else None,
                'enfermeiro': r['enfermeiro_nome']
            })

        return jsonify(resultado)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@paciente_bp.route('/api/paciente/vacina', methods=['POST'])
def adicionar_vacina():
    from app import get_db_connection
    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    data = request.get_json()
    vacina_nome = data.get('vacina_nome', '').strip()
    dose = data.get('dose', '').strip()
    lote = data.get('lote', '').strip() or 'N/A'
    local_aplicacao = data.get('local_aplicacao', '').strip() or 'Não informado'
    data_vacina = data.get('data', '').strip() # expected format: YYYY-MM-DD

    if not vacina_nome or not dose:
        return jsonify({'erro': 'Nome da vacina e dose são obrigatórios'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()
        if data_vacina:
            cur.execute("""
                INSERT INTO vacinas_aplicadas (paciente_id, enfermeiro_id, vacina_nome, dose, lote, local_aplicacao, criado_em)
                VALUES (?, NULL, ?, ?, ?, ?, ?)
            """, (usuario_id, vacina_nome, dose, lote, local_aplicacao, data_vacina))
        else:
            cur.execute("""
                INSERT INTO vacinas_aplicadas (paciente_id, enfermeiro_id, vacina_nome, dose, lote, local_aplicacao)
                VALUES (?, NULL, ?, ?, ?, ?)
            """, (usuario_id, vacina_nome, dose, lote, local_aplicacao))
        db.commit()
        vacina_id = cur.lastrowid
        db.close()
        return jsonify({'sucesso': True, 'id': vacina_id}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@paciente_bp.route('/api/paciente/vacina/<int:id>', methods=['PUT'])
def editar_vacina_paciente(id):
    from app import get_db_connection
    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    data = request.get_json()
    vacina_nome = data.get('vacina_nome', '').strip()
    dose = data.get('dose', '').strip()
    lote = data.get('lote', '').strip() or 'N/A'
    local_aplicacao = data.get('local_aplicacao', '').strip() or 'Não informado'
    data_vacina = data.get('data', '').strip() # expected format: YYYY-MM-DD

    if not vacina_nome or not dose:
        return jsonify({'erro': 'Nome da vacina e dose são obrigatórios'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()
        
        # Verify the record exists, belongs to the patient, and is self-reported (enfermeiro_id IS NULL)
        cur.execute("SELECT paciente_id, enfermeiro_id FROM vacinas_aplicadas WHERE id = ?", (id,))
        vac = cur.fetchone()
        if not vac:
            db.close()
            return jsonify({'erro': 'Registro de vacina não encontrado'}), 404
        if int(vac['paciente_id']) != int(usuario_id):
            db.close()
            return jsonify({'erro': 'Permissão negada'}), 403
        if vac['enfermeiro_id'] is not None:
            db.close()
            return jsonify({'erro': 'Não é permitido editar vacinas registradas por profissionais de saúde'}), 403

        if data_vacina:
            cur.execute("""
                UPDATE vacinas_aplicadas
                SET vacina_nome = ?, dose = ?, lote = ?, local_aplicacao = ?, criado_em = ?
                WHERE id = ?
            """, (vacina_nome, dose, lote, local_aplicacao, data_vacina, id))
        else:
            cur.execute("""
                UPDATE vacinas_aplicadas
                SET vacina_nome = ?, dose = ?, lote = ?, local_aplicacao = ?
                WHERE id = ?
            """, (vacina_nome, dose, lote, local_aplicacao, id))
        db.commit()
        db.close()
        return jsonify({'sucesso': True}), 200
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@paciente_bp.route('/api/paciente/vacina/<int:id>', methods=['DELETE'])
def remover_vacina_paciente(id):
    from app import get_db_connection
    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        
        # Verify the record exists, belongs to the patient, and is self-reported (enfermeiro_id IS NULL)
        cur.execute("SELECT paciente_id, enfermeiro_id FROM vacinas_aplicadas WHERE id = ?", (id,))
        vac = cur.fetchone()
        if not vac:
            db.close()
            return jsonify({'erro': 'Registro de vacina não encontrado'}), 404
        if int(vac['paciente_id']) != int(usuario_id):
            db.close()
            return jsonify({'erro': 'Permissão negada'}), 403
        if vac['enfermeiro_id'] is not None:
            db.close()
            return jsonify({'erro': 'Não é permitido excluir vacinas registradas por profissionais de saúde'}), 403

        cur.execute("DELETE FROM vacinas_aplicadas WHERE id = ?", (id,))
        db.commit()
        db.close()
        return jsonify({'sucesso': True}), 200
    except Exception as e:
        return jsonify({'erro': str(e)}), 500



# ── DOENÇAS / CONDIÇÕES DO PACIENTE ──────────────────────────────
@paciente_bp.route('/api/paciente/doencas', methods=['GET'])
def listar_doencas():
    from app import get_db_connection
    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    cpf = request.args.get('cpf', '')

    try:
        db = get_db_connection()
        cur = db.cursor()
        if cpf:
            cur.execute("SELECT id FROM usuarios WHERE cpf = ?", (cpf,))
            u = cur.fetchone()
            if u:
                usuario_id = u['id']

        if not usuario_id:
            db.close()
            return jsonify([])

        cur.execute("SELECT id, nome FROM paciente_doencas WHERE paciente_id = ?", (usuario_id,))
        rows = cur.fetchall()
        db.close()

        return jsonify([{'id': r['id'], 'nome': r['nome']} for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@paciente_bp.route('/api/paciente/doencas', methods=['POST'])
def adicionar_doenca():
    from app import get_db_connection
    data = request.get_json()
    paciente_id = data.get('paciente_id')
    nome = data.get('nome', '').strip()

    if not paciente_id or not nome:
        return jsonify({'erro': 'Dados incompletos'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("INSERT INTO paciente_doencas (paciente_id, nome) VALUES (?, ?)", (paciente_id, nome))
        db.commit()
        new_id = cur.lastrowid
        db.close()
        return jsonify({'sucesso': True, 'id': new_id}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@paciente_bp.route('/api/paciente/doencas/<int:doenca_id>', methods=['DELETE'])
def remover_doenca(doenca_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("DELETE FROM paciente_doencas WHERE id = ?", (doenca_id,))
        db.commit()
        db.close()
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── ATESTADOS DO PACIENTE ────────────────────────────────────────
@paciente_bp.route('/api/paciente/atestados', methods=['GET'])
def atestados():
    from app import get_db_connection
    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            SELECT a.id, a.dias_afastamento, a.motivo, a.cid, a.texto, a.criado_em,
                   u.nome AS medico_nome
            FROM atestados a
            LEFT JOIN usuarios u ON a.medico_id = u.id
            WHERE a.paciente_id = ?
            ORDER BY a.criado_em DESC
        """, (usuario_id,))
        rows = cur.fetchall()
        db.close()

        lista_atestados = []
        for r in rows:
            lista_atestados.append({
                'id': r['id'], 'dias': r['dias_afastamento'], 'motivo': r['motivo'],
                'cid': r['cid'], 'texto': r['texto'],
                'data': str(r['criado_em']) if r['criado_em'] else None,
                'medico': r['medico_nome']
            })
        return jsonify(lista_atestados)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── HISTÓRICO DE MEDICAÇÕES (PRESCRIÇÕES E APLICAÇÕES) ───────────
@paciente_bp.route('/api/paciente/medicacoes', methods=['GET'])
def medicacoes_paciente():
    from app import get_db_connection
    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        
        # Buscar prescrições + dados de quem aplicou (se aplicado)
        cur.execute("""
            SELECT p.id, p.medicamento, p.dosagem, p.via_administracao, p.frequencia, p.status, p.criado_em,
                   m.nome AS medico_nome,
                   a.data_hora AS data_aplicacao,
                   e.nome AS enfermeiro_nome
            FROM prescricoes p
            JOIN usuarios m ON p.medico_id = m.id
            LEFT JOIN aplicacoes a ON p.id = a.prescricao_id
            LEFT JOIN usuarios e ON a.enfermeiro_id = e.id
            WHERE p.paciente_id = ?
            ORDER BY p.criado_em DESC
        """, (usuario_id,))
        
        rows = cur.fetchall()
        db.close()

        lista = []
        for r in rows:
            lista.append({
                'id': r['id'],
                'medicamento': r['medicamento'],
                'dosagem': r['dosagem'],
                'via': r['via_administracao'],
                'frequencia': r['frequencia'],
                'status': r['status'],
                'data_prescricao': str(r['criado_em']) if r['criado_em'] else None,
                'medico': r['medico_nome'],
                'data_aplicacao': str(r['data_aplicacao']) if r['data_aplicacao'] else None,
                'enfermeiro': r['enfermeiro_nome']
            })
            
        return jsonify(lista)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── RESUMO DE SAÚDE (Baseado na Última Triagem) ──────────────────
@paciente_bp.route('/api/paciente/resumo-saude', methods=['GET'])
def resumo_saude():
    from app import get_db_connection
    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        
        # Pega a triagem mais recente
        cur.execute("""
            SELECT pressao, peso, imc, temperatura, criado_em
            FROM triagens
            WHERE paciente_id = ?
            ORDER BY criado_em DESC
            LIMIT 1
        """, (usuario_id,))
        
        r = cur.fetchone()
        db.close()

        if r:
            return jsonify({
                'pressao': r['pressao'],
                'peso': r['peso'],
                'imc': r['imc'],
                'temperatura': r['temperatura'],
                'data_atualizacao': str(r['criado_em']) if r['criado_em'] else None
            })
        else:
            return jsonify({
                'pressao': '--',
                'peso': '--',
                'imc': '--',
                'temperatura': '--',
                'data_atualizacao': None
            })
            
            
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── RECEITAS DO PACIENTE ──────────────────────────────────────────
@paciente_bp.route('/api/paciente/receitas', methods=['GET'])
def paciente_receitas():
    from app import get_db_connection
    usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            SELECT r.id, r.medicamentos, r.instrucoes, r.criado_em,
                   u.nome AS medico_nome,
                   p.diagnostico
            FROM receitas r
            JOIN prontuarios p ON r.prontuario_id = p.id
            LEFT JOIN usuarios u ON p.medico_id = u.id
            WHERE p.paciente_id = ?
            ORDER BY r.criado_em DESC
        """, (usuario_id,))
        rows = cur.fetchall()
        db.close()

        lista_receitas = []
        for r in rows:
            lista_receitas.append({
                'id': r['id'],
                'medicamentos': r['medicamentos'],
                'instrucoes': r['instrucoes'],
                'data': str(r['criado_em']) if r['criado_em'] else None,
                'medico': r['medico_nome'],
                'diagnostico': r['diagnostico']
            })
        return jsonify(lista_receitas)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500



