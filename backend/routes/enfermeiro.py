"""
Rotas do Enfermeiro — Triagem, Vacinas, Busca de Paciente
"""

from flask import Blueprint, request, jsonify, session

enfermeiro_bp = Blueprint('enfermeiro', __name__)


# ── BUSCAR PACIENTE ──────────────────────────────────────────────
@enfermeiro_bp.route('/api/enfermeiro/buscar-paciente', methods=['GET'])
def buscar_paciente():
    from app import get_db_connection
    cpf = request.args.get('cpf', '').strip()

    if not cpf:
        return jsonify({'erro': 'CPF não informado'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()
        
        # Normalizar CPF de busca
        cpf_limpo = "".join(filter(str.isdigit, cpf))
        
        cur.execute("""
            SELECT id, nome, cpf, sus, email, telefone, cidade, bairro, data_nascimento
            FROM usuarios 
            WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?
        """, (cpf_limpo,))
        u = cur.fetchone()
        db.close()

        if not u:
            return jsonify({'erro': 'Paciente não encontrado'}), 404

        return jsonify({
            'id': u['id'], 'nome': u['nome'], 'cpf': u['cpf'], 'sus': u['sus'],
            'email': u['email'], 'telefone': u['telefone'], 'cidade': u['cidade'],
            'bairro': u['bairro'], 'data_nascimento': str(u['data_nascimento']) if u['data_nascimento'] else None
        })
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── SALVAR TRIAGEM ───────────────────────────────────────────────
@enfermeiro_bp.route('/api/enfermeiro/triagem', methods=['POST'])
def salvar_triagem():
    from app import get_db_connection
    data = request.get_json()

    enfermeiro_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    paciente_cpf = data.get('paciente_cpf', '')

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Buscar paciente
        paciente_cpf_limpo = "".join(filter(str.isdigit, paciente_cpf or ""))
        cur.execute("SELECT id FROM usuarios WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?", (paciente_cpf_limpo,))
        pac = cur.fetchone()
        if not pac:
            # Tentar Cadastro Rápido se dados forem fornecidos
            nome = data.get('nome_novo', '').strip()
            if not nome:
                db.close()
                return jsonify({'erro': 'Paciente não encontrado e dados para cadastro rápido não fornecidos'}), 404

            sus = data.get('sus_novo', '').strip()
            nasc = data.get('nasc_novo', '').strip()

            # Criar senha padrão
            from werkzeug.security import generate_password_hash
            hash_senha = generate_password_hash('paciente123')

            cur.execute("""
                INSERT INTO usuarios (nome, cpf, sus, data_nascimento, tipo, senha)
                VALUES (?, ?, ?, ?, 'paciente', ?)
            """, (nome, paciente_cpf, sus, nasc, hash_senha))
            db.commit()
            paciente_id = cur.lastrowid
        else:
            paciente_id = pac['id']
        peso = data.get('peso')
        altura = data.get('altura')

        # Calcular IMC
        imc = None
        if peso and altura:
            try:
                p = float(peso)
                a = float(altura)
                if a > 0:
                    imc = round(p / (a * a), 2)
            except:
                pass

        # Tentar achar o ID do médico destino
        medico_nome = data.get('medico_destino', '')
        cur.execute("SELECT id FROM usuarios WHERE nome = ? AND tipo = 'medico'", (medico_nome,))
        medInfo = cur.fetchone()
        medico_id = medInfo['id'] if medInfo else None
        
        senha_fila = None
        
        # Gerar Senha e Inserir na Fila do Médico
        if medico_id:
            from datetime import datetime
            hoje = datetime.now().strftime('%Y-%m-%d')
            hora = datetime.now().strftime('%H:%M:%S')
            
            # Contar senhas de hoje para esse médico
            cur.execute("SELECT COUNT(*) FROM consultas WHERE medico_id = ? AND data = ?", (medico_id, hoje))
            count_hoje = cur.fetchone()[0] + 1
            senha_fila = f"P-{count_hoje:03d}"
            
            cur.execute("""
                INSERT INTO consultas (paciente_id, medico_id, especialidade, data, hora, tipo, status, senha_fila)
                VALUES (?, ?, 'Triagem Enfermagem', ?, ?, 'presencial', 'aguardando', ?)
            """, (paciente_id, medico_id, hoje, hora, senha_fila))

        cur.execute("""
            INSERT INTO triagens (paciente_id, enfermeiro_id, peso, altura, pressao,
                freq_cardiaca, temperatura, saturacao, queixa, prioridade, medico_destino, imc)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            paciente_id, enfermeiro_id,
            peso, altura,
            data.get('pressao', ''),
            data.get('fc', ''),
            data.get('temperatura'),
            data.get('saturacao', ''),
            data.get('queixa', ''),
            data.get('prioridade', ''),
            medico_nome,
            imc
        ))
        db.commit()
        triagem_id = cur.lastrowid
        db.close()

        return jsonify({'sucesso': True, 'id': triagem_id, 'imc': imc, 'senha': senha_fila}), 201

    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── REGISTRAR VACINA ─────────────────────────────────────────────
@enfermeiro_bp.route('/api/enfermeiro/vacina', methods=['POST'])
def registrar_vacina():
    from app import get_db_connection
    data = request.get_json()

    enfermeiro_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    paciente_cpf = data.get('paciente_cpf', '')

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Buscar paciente
        paciente_cpf_limpo = "".join(filter(str.isdigit, paciente_cpf or ""))
        cur.execute("SELECT id FROM usuarios WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?", (paciente_cpf_limpo,))
        pac = cur.fetchone()
        if not pac:
            db.close()
            return jsonify({'erro': 'Paciente não encontrado'}), 404

        paciente_id = pac['id']

        cur.execute("""
            INSERT INTO vacinas_aplicadas (paciente_id, enfermeiro_id, vacina_nome, dose, lote, local_aplicacao)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            paciente_id, enfermeiro_id,
            data.get('vacina_nome', ''),
            data.get('dose', ''),
            data.get('lote', ''),
            data.get('local_aplicacao', '')
        ))
        db.commit()
        vacina_id = cur.lastrowid
        db.close()

        return jsonify({'sucesso': True, 'id': vacina_id}), 201

    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── RESUMO DO DASHBOARD (ENFERMAGEM) ─────────────────────────────
@enfermeiro_bp.route('/api/enfermeiro/resumo', methods=['GET'])
def dashboard_resumo():
    from app import get_db_connection
    from datetime import datetime

    enfermeiro_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not enfermeiro_id:
        return jsonify({'erro': 'Não autenticado'}), 401
    
    hoje = datetime.now().strftime('%Y-%m-%d')

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Pacientes aguardando triagem (consultas de hoje status aguardando sem triagem)
        cur.execute("""
            SELECT COUNT(*) FROM consultas 
            WHERE data = ? AND status = 'aguardando' AND tipo = 'presencial'
        """, (hoje,))
        aguardando_triagem = cur.fetchone()[0]

        # Prescrições aguardando aplicação
        cur.execute("SELECT COUNT(*) FROM prescricoes WHERE status = 'Aguardando Aplicação'")
        prescricoes_pendentes = cur.fetchone()[0]

        # Vacinas aplicadas hoje (todas)
        cur.execute("SELECT COUNT(*) FROM vacinas_aplicadas WHERE date(criado_em) = ?", (hoje,))
        vacinas_hoje = cur.fetchone()[0]

        db.close()

        return jsonify({
            'aguardando_triagem': aguardando_triagem,
            'prescricoes_pendentes': prescricoes_pendentes,
            'vacinas_hoje': vacinas_hoje
        })
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── PRESCRIÇÕES PENDENTES ────────────────────────────────────────
@enfermeiro_bp.route('/api/enfermeiro/prescricoes-pendentes', methods=['GET'])
def prescricoes_pendentes():
    from app import get_db_connection
    
    enfermeiro_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not enfermeiro_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            SELECT p.id, p.medicamento, p.dosagem, p.via_administracao, p.frequencia, p.observacoes, p.criado_em,
                   pac.nome AS paciente_nome, pac.cpf AS paciente_cpf,
                   med.nome AS medico_nome
            FROM prescricoes p
            JOIN usuarios pac ON p.paciente_id = pac.id
            JOIN usuarios med ON p.medico_id = med.id
            WHERE p.status = 'Aguardando Aplicação'
            ORDER BY p.criado_em ASC
        """)
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
                'observacoes': r['observacoes'],
                'data_prescricao': str(r['criado_em']),
                'paciente': r['paciente_nome'],
                'cpf': r['paciente_cpf'],
                'medico': r['medico_nome']
            })

        return jsonify(lista)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── REGISTRAR APLICAÇÃO DE MEDICAMENTO ───────────────────────────
@enfermeiro_bp.route('/api/enfermeiro/aplicar-prescricao', methods=['POST'])
def aplicar_prescricao():
    from app import get_db_connection
    
    enfermeiro_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not enfermeiro_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    data = request.get_json()
    prescricao_id = data.get('prescricao_id')
    observacao = data.get('observacao', '')
    lote = data.get('lote', '')

    if not prescricao_id:
        return jsonify({'erro': 'ID da prescrição é obrigatório'}), 400

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Inserir na tabela de aplicações
        cur.execute("""
            INSERT INTO aplicacoes (prescricao_id, enfermeiro_id, observacao, lote)
            VALUES (?, ?, ?, ?)
        """, (prescricao_id, enfermeiro_id, observacao, lote))

        # Atualizar status da prescrição
        cur.execute("""
            UPDATE prescricoes 
            SET status = 'Aplicado' 
            WHERE id = ?
        """, (prescricao_id,))

        db.commit()
        db.close()

        return jsonify({'sucesso': True}), 200
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── LISTAR TRIAGENS DO PACIENTE ──────────────────────────────────
@enfermeiro_bp.route('/api/enfermeiro/triagens', methods=['GET'])
def listar_triagens():
    from app import get_db_connection
    cpf = request.args.get('cpf', '')

    try:
        db = get_db_connection()
        cur = db.cursor()
        cpf_limpo = "".join(filter(str.isdigit, cpf or ""))
        cur.execute("SELECT id FROM usuarios WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?", (cpf_limpo,))
        pac = cur.fetchone()
        if not pac:
            db.close()
            return jsonify([])

        cur.execute("""
            SELECT t.id, t.peso, t.altura, t.pressao, t.freq_cardiaca, t.temperatura,
                   t.saturacao, t.queixa, t.prioridade, t.imc, t.criado_em,
                   enf.nome AS enfermeiro
            FROM triagens t
            LEFT JOIN usuarios enf ON t.enfermeiro_id = enf.id
            WHERE t.paciente_id = ?
            ORDER BY t.criado_em DESC
        """, (pac['id'],))
        rows = cur.fetchall()
        db.close()

        lista_triagens = []
        for r in rows:
            lista_triagens.append({
                'id': r['id'], 'peso': str(r['peso']) if r['peso'] else None,
                'altura': str(r['altura']) if r['altura'] else None, 'pressao': r['pressao'],
                'fc': r['freq_cardiaca'], 'temperatura': str(r['temperatura']) if r['temperatura'] else None,
                'saturacao': r['saturacao'], 'queixa': r['queixa'], 'prioridade': r['prioridade'],
                'imc': str(r['imc']) if r['imc'] else None,
                'data': str(r['criado_em']) if r['criado_em'] else None,
                'enfermeiro': r['enfermeiro']
            })
        return jsonify(lista_triagens)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── VACINAS DO PACIENTE ──────────────────────────────────────────
@enfermeiro_bp.route('/api/enfermeiro/vacinas-paciente', methods=['GET'])
def vacinas_paciente():
    from app import get_db_connection
    cpf = request.args.get('cpf', '')

    try:
        db = get_db_connection()
        cur = db.cursor()
        cpf_limpo = "".join(filter(str.isdigit, cpf or ""))
        cur.execute("SELECT id FROM usuarios WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?", (cpf_limpo,))
        pac = cur.fetchone()
        if not pac:
            db.close()
            return jsonify([])

        cur.execute("""
            SELECT va.id, va.vacina_nome, va.dose, va.lote, va.local_aplicacao,
                   va.criado_em, enf.nome AS enfermeiro
            FROM vacinas_aplicadas va
            LEFT JOIN usuarios enf ON va.enfermeiro_id = enf.id
            WHERE va.paciente_id = ?
            ORDER BY va.criado_em DESC
        """, (pac['id'],))
        rows = cur.fetchall()
        db.close()

        lista_vacinas = []
        for r in rows:
            lista_vacinas.append({
                'id': r['id'], 'vacina': r['vacina_nome'], 'dose': r['dose'],
                'lote': r['lote'], 'local': r['local_aplicacao'],
                'data': str(r['criado_em']) if r['criado_em'] else None,
                'enfermeiro': r['enfermeiro']
            })
        return jsonify(lista_vacinas)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── EDITAR VACINA ───────────────────────────────────────────────
@enfermeiro_bp.route('/api/enfermeiro/vacina/<int:id>', methods=['PUT'])
def editar_vacina(id):
    from app import get_db_connection
    data = request.get_json()

    enfermeiro_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not enfermeiro_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Verificar se a vacina existe
        cur.execute("SELECT id FROM vacinas_aplicadas WHERE id = ?", (id,))
        if not cur.fetchone():
            db.close()
            return jsonify({'erro': 'Registro de vacina não encontrado'}), 404

        cur.execute("""
            UPDATE vacinas_aplicadas 
            SET vacina_nome = ?, dose = ?, lote = ?, local_aplicacao = ?
            WHERE id = ?
        """, (
            data.get('vacina_nome', ''),
            data.get('dose', ''),
            data.get('lote', ''),
            data.get('local_aplicacao', ''),
            id
        ))
        db.commit()
        db.close()

        return jsonify({'sucesso': True}), 200

    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── REMOVER VACINA ──────────────────────────────────────────────
@enfermeiro_bp.route('/api/enfermeiro/vacina/<int:id>', methods=['DELETE'])
def remover_vacina(id):
    from app import get_db_connection

    enfermeiro_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not enfermeiro_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    try:
        db = get_db_connection()
        cur = db.cursor()

        # Verificar se a vacina existe
        cur.execute("SELECT id FROM vacinas_aplicadas WHERE id = ?", (id,))
        if not cur.fetchone():
            db.close()
            return jsonify({'erro': 'Registro de vacina não encontrado'}), 404

        cur.execute("DELETE FROM vacinas_aplicadas WHERE id = ?", (id,))
        db.commit()
        db.close()

        return jsonify({'sucesso': True}), 200

    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── MÉDICOS DISPONÍVEIS (para destino da triagem) ────────────────
@enfermeiro_bp.route('/api/enfermeiro/medicos', methods=['GET'])
def medicos_disponiveis():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            SELECT u.id, u.nome, m.especialidade
            FROM usuarios u
            JOIN medico_info m ON m.usuario_id = u.id
            WHERE u.tipo = 'medico'
        """)
        rows = cur.fetchall()
        db.close()
        return jsonify([{'id': r['id'], 'nome': r['nome'], 'especialidade': r['especialidade']} for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ── ATENDIMENTOS DO DIA (TRIAGEM, VACINA, MEDICAÇÃO) ──────────────
@enfermeiro_bp.route('/api/enfermeiro/atendimentos-hoje', methods=['GET'])
def atendimentos_hoje():
    from app import get_db_connection
    from datetime import datetime

    enfermeiro_id = session.get('usuario_id') or request.headers.get('X-User-Id')
    if not enfermeiro_id:
        return jsonify({'erro': 'Não autenticado'}), 401

    hoje = datetime.now().strftime('%Y-%m-%d')

    try:
        db = get_db_connection()
        cur = db.cursor()

        # 1. Triagens realizadas hoje pelo enfermeiro
        cur.execute("""
            SELECT t.criado_em, u.nome AS paciente_nome, t.prioridade, t.medico_destino
            FROM triagens t
            JOIN usuarios u ON t.paciente_id = u.id
            WHERE (date(t.criado_em) = ? OR date(t.criado_em, 'localtime') = ?) AND t.enfermeiro_id = ?
        """, (hoje, hoje, enfermeiro_id))
        triagens = cur.fetchall()

        # 2. Vacinas aplicadas hoje pelo enfermeiro
        cur.execute("""
            SELECT va.criado_em, u.nome AS paciente_nome, va.vacina_nome, va.dose
            FROM vacinas_aplicadas va
            JOIN usuarios u ON va.paciente_id = u.id
            WHERE (date(va.criado_em) = ? OR date(va.criado_em, 'localtime') = ?) AND va.enfermeiro_id = ?
        """, (hoje, hoje, enfermeiro_id))
        vacinas = cur.fetchall()

        # 3. Medicamentos aplicados hoje pelo enfermeiro
        cur.execute("""
            SELECT ap.data_hora AS criado_em, u.nome AS paciente_nome, p.medicamento, p.dosagem
            FROM aplicacoes ap
            JOIN prescricoes p ON ap.prescricao_id = p.id
            JOIN usuarios u ON p.paciente_id = u.id
            WHERE (date(ap.data_hora) = ? OR date(ap.data_hora, 'localtime') = ?) AND ap.enfermeiro_id = ?
        """, (hoje, hoje, enfermeiro_id))
        aplicacoes = cur.fetchall()

        db.close()

        lista = []

        # Formatar triagens
        for r in triagens:
            dt_str = str(r['criado_em'])
            hora = ""
            if dt_str and ' ' in dt_str:
                time_part = dt_str.split(' ')[1]
                hora = ':'.join(time_part.split(':')[:2])
            else:
                hora = dt_str

            lista.append({
                'tipo': 'Triagem',
                'nome': r['paciente_nome'],
                'hora': hora,
                'criado_em': dt_str,
                'prioridade': r['prioridade'],
                'detalhe': f"Encaminhado: {r['medico_destino']}" if r['medico_destino'] else "Triagem realizada"
            })

        # Formatar vacinas
        for r in vacinas:
            dt_str = str(r['criado_em'])
            hora = ""
            if dt_str and ' ' in dt_str:
                time_part = dt_str.split(' ')[1]
                hora = ':'.join(time_part.split(':')[:2])
            else:
                hora = dt_str

            lista.append({
                'tipo': 'Vacina',
                'nome': r['paciente_nome'],
                'hora': hora,
                'criado_em': dt_str,
                'prioridade': None,
                'detalhe': f"Vacina: {r['vacina_nome']} ({r['dose']})"
            })

        # Formatar medicações
        for r in aplicacoes:
            dt_str = str(r['criado_em'])
            hora = ""
            if dt_str and ' ' in dt_str:
                time_part = dt_str.split(' ')[1]
                hora = ':'.join(time_part.split(':')[:2])
            else:
                hora = dt_str

            lista.append({
                'tipo': 'Medicação',
                'nome': r['paciente_nome'],
                'hora': hora,
                'criado_em': dt_str,
                'prioridade': None,
                'detalhe': f"Aplicado: {r['medicamento']} {r['dosagem']}"
            })

        # Ordenar decrescente pelo timestamp de criação
        lista.sort(key=lambda x: x['criado_em'] or '', reverse=True)

        return jsonify(lista), 200

    except Exception as e:
        return jsonify({'erro': str(e)}), 500

