"""
Rotas Admin — Notícias, Carrossel, Estatísticas, Logs
"""

from flask import Blueprint, request, jsonify, session, redirect, url_for
from datetime import datetime
from functools import wraps

admin_bp = Blueprint('admin', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_type = session.get("usuario_tipo") or request.headers.get('X-User-Type')
        if user_type != "admin":
            return jsonify({'erro': 'Acesso negado. Administrador não autenticado.'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Função auxiliar para salvar logs do sistema
def registrar_log(acao):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        usuario = session.get('usuario_nome') or request.headers.get('X-User-Nome') or 'Admin'
        cur.execute("INSERT INTO logs (usuario, acao) VALUES (?, ?)", (usuario, acao))
        db.commit()
        db.close()
    except Exception as e:
        print(f"Erro ao salvar log: {e}")

import os
import uuid

UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@admin_bp.route('/api/admin/upload', methods=['POST'])
@login_required
def admin_upload_file():
    if 'imagem_arquivo' not in request.files:
        return jsonify({'erro': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['imagem_arquivo']
    if file.filename == '':
        return jsonify({'erro': 'Nome de arquivo inválido'}), 400
        
    try:
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'png'
        # Gerar nome único para evitar sobreposição
        filename = f"upload_{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # URL relativa para acessar a imagem pelo Flask
        imagem_url = f"/uploads/{filename}"
        
        return jsonify({
            'sucesso': True,
            'url': imagem_url
        })
    except Exception as e:
        return jsonify({'erro': f'Erro ao salvar arquivo: {str(e)}'}), 500

# ══════════════════════════════════════════════════════════════════
#  NOTÍCIAS
# ══════════════════════════════════════════════════════════════════

@admin_bp.route('/api/admin/noticias', methods=['GET'])
@login_required
def listar_noticias():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT * FROM noticias ORDER BY criada_em DESC, id DESC")
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/noticias', methods=['POST'])
@login_required
def criar_noticia():
    from app import get_db_connection
    data = request.get_json()
    try:
        db = get_db_connection()
        cur = db.cursor()

        cur.execute("""
            INSERT INTO noticias (titulo, resumo, conteudo, imagem, categoria, status, destaque_carrossel, prioridade)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('titulo', ''), data.get('resumo', ''), data.get('conteudo', ''), 
            data.get('imagem', ''), data.get('categoria', 'Geral'), data.get('status', 'publicado'),
            data.get('destaque_carrossel', 0), data.get('prioridade', 0)
        ))
        db.commit()
        new_id = cur.lastrowid
        db.close()
        registrar_log(f"Criou a notícia ID: {new_id} - {data.get('titulo', '')}")
        return jsonify({'sucesso': True, 'id': new_id}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/noticias/<int:noticia_id>', methods=['PUT'])
@login_required
def editar_noticia(noticia_id):
    from app import get_db_connection
    data = request.get_json()
    try:
        db = get_db_connection()
        cur = db.cursor()

        cur.execute("""
            UPDATE noticias 
            SET titulo = ?, resumo = ?, conteudo = ?, imagem = ?, categoria = ?, status = ?, destaque_carrossel = ?, prioridade = ?
            WHERE id = ?
        """, (
            data.get('titulo', ''), data.get('resumo', ''), data.get('conteudo', ''), 
            data.get('imagem', ''), data.get('categoria', 'Geral'), 
            data.get('status', 'publicado'), 
            data.get('destaque_carrossel', 0), data.get('prioridade', 0),
            noticia_id
        ))
        db.commit()
        db.close()
        registrar_log(f"Editou a notícia ID: {noticia_id}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/noticias/<int:noticia_id>', methods=['DELETE'])
@login_required
def deletar_noticia(noticia_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("DELETE FROM noticias WHERE id = ?", (noticia_id,))
        db.commit()
        db.close()
        registrar_log(f"Excluiu a notícia ID: {noticia_id}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/noticias/<int:noticia_id>/clique', methods=['POST'])
def registrar_clique_noticia(noticia_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("UPDATE noticias SET acessos = acessos + 1, cliques = cliques + 1 WHERE id = ?", (noticia_id,))
        db.commit()
        db.close()
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ══════════════════════════════════════════════════════════════════
#  CARROSSEL
# ══════════════════════════════════════════════════════════════════

@admin_bp.route('/api/admin/carrossel', methods=['GET'])
@login_required
def listar_carrossel():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT * FROM carrossel ORDER BY ordem ASC")
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/carrossel', methods=['POST'])
@login_required
def criar_slide():
    from app import get_db_connection
    data = request.get_json()
    try:
        db = get_db_connection()
        cur = db.cursor()
        
        # Auto-migrate if columns don't exist
        cur.execute("""
            INSERT INTO carrossel (titulo, subtitulo, texto, imagem, link, ativo, ordem, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('titulo', ''), data.get('subtitulo', ''), data.get('texto', ''), data.get('imagem', ''), 
            data.get('link', ''), data.get('ativo', 1), data.get('ordem', 0), data.get('status', 1)
        ))
        db.commit()
        new_id = cur.lastrowid
        db.close()
        registrar_log(f"Criou slide do carrossel ID: {new_id}")
        return jsonify({'sucesso': True, 'id': new_id}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/carrossel/<int:slide_id>', methods=['PUT'])
@login_required
def editar_slide(slide_id):
    from app import get_db_connection
    data = request.get_json()
    try:
        db = get_db_connection()
        cur = db.cursor()
        
        # Auto-migrate se colunas não existirem
        cur.execute("""
            UPDATE carrossel 
            SET titulo = ?, subtitulo = ?, texto = ?, imagem = ?, link = ?, ativo = ?, ordem = ?, status = ?
            WHERE id = ?
        """, (
            data.get('titulo', ''), data.get('subtitulo', ''), data.get('texto', ''), data.get('imagem', ''), 
            data.get('link', ''), data.get('ativo', 1), data.get('ordem', 0), data.get('status', 1),
            slide_id
        ))
        db.commit()
        db.close()
        registrar_log(f"Editou slide do carrossel ID: {slide_id}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/carrossel/<int:slide_id>', methods=['DELETE'])
@login_required
def deletar_slide(slide_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("DELETE FROM carrossel WHERE id = ?", (slide_id,))
        db.commit()
        db.close()
        registrar_log(f"Excluiu slide do carrossel ID: {slide_id}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ══════════════════════════════════════════════════════════════════
#  ESTATÍSTICAS
# ══════════════════════════════════════════════════════════════════

@admin_bp.route('/api/admin/stats', methods=['GET'])
@login_required
def listar_stats():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT * FROM estatisticas ORDER BY id ASC")
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/stats', methods=['POST'])
@login_required
def salvar_stats():
    from app import get_db_connection
    data = request.get_json()  # expects list of stats
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("DELETE FROM estatisticas")
        for s in data:
            texto = s.get('texto', s.get('descricao', ''))
            valor = s.get('valor', s.get('numero', ''))
            valor_mapa = s.get('valor_mapa', '')
            detalhe = s.get('detalhe', '')
            lat = s.get('lat', '')
            lon = s.get('lon', '')
            cur.execute("""
                INSERT INTO estatisticas (texto, valor, valor_mapa, icone, cor, detalhe, lat, lon)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (texto, valor, valor_mapa, s.get('icone', ''), s.get('cor', ''), detalhe, lat, lon))
        db.commit()
        db.close()
        registrar_log("Atualizou os quadros de Estatísticas do Painel")
        return jsonify({'sucesso': True}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ══════════════════════════════════════════════════════════════════
#  COMENTÁRIOS GLOBAIS
# ══════════════════════════════════════════════════════════════════

# Comentarios Públicos - Enviar novo (Não logado)
@admin_bp.route('/api/admin/noticias/<int:noticia_id>/comentarios', methods=['POST'])
def criar_comentario_noticia(noticia_id):
    from app import get_db_connection
    data = request.get_json()
    try:
        db = get_db_connection()
        cur = db.cursor()
        nome = data.get('nome', 'Anônimo')
        mensagem = data.get('mensagem', data.get('texto', ''))
        cur.execute("""
            INSERT INTO comentarios (noticia_id, nome, texto, status)
            VALUES (?, ?, ?, 'pendente')
        """, (noticia_id, nome, mensagem))
        db.commit()
        new_id = cur.lastrowid
        db.close()
        return jsonify({'sucesso': True, 'id': new_id}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# Comentarios Públicos - Listar da noticia (Não logado - Home render)
@admin_bp.route('/api/admin/noticias/<int:noticia_id>/comentarios', methods=['GET'])
def listar_comentarios_noticia(noticia_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT * FROM comentarios WHERE noticia_id = ? AND status = 'aprovado' ORDER BY criado_em DESC, id DESC", (noticia_id,))
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# Endpoint ADMIN listar todos
@admin_bp.route('/api/admin/comentarios', methods=['GET'])
@login_required
def listar_todos_comentarios():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute('''
            SELECT c.*, n.titulo as noticia_titulo 
            FROM comentarios c
            LEFT JOIN noticias n ON c.noticia_id = n.id
            ORDER BY c.criado_em DESC, c.id DESC
        ''')
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/comentarios/<int:comentario_id>', methods=['PUT'])
@login_required
def aprovar_comentario(comentario_id):
    from app import get_db_connection
    data = request.get_json()
    status = data.get('status', 'aprovado') # aprovado, rejeitado ou pendente
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("UPDATE comentarios SET status = ? WHERE id = ?", (status, comentario_id))
        db.commit()
        db.close()
        registrar_log(f"Alterou status do comentário ID: {comentario_id} para {status}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/comentarios/<int:comentario_id>', methods=['DELETE'])
@login_required
def deletar_comentario(comentario_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("DELETE FROM comentarios WHERE id = ?", (comentario_id,))
        db.commit()
        db.close()
        registrar_log(f"Excluiu permanentemente comentário ID: {comentario_id}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ══════════════════════════════════════════════════════════════════
#  CAMPANHAS
# ══════════════════════════════════════════════════════════════════

@admin_bp.route('/api/admin/campanhas', methods=['GET'])
@login_required
def listar_campanhas():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT * FROM campanhas ORDER BY id DESC")
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/campanhas', methods=['POST'])
@login_required
def criar_campanha():
    from app import get_db_connection
    data = request.get_json()
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            INSERT INTO campanhas (titulo, categoria, status, data_inicio, data_fim, icone, imagem, resumo, descricao, publico_alvo, local, documentos)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('titulo', ''), data.get('categoria', ''), data.get('status', ''),
            data.get('data_inicio', ''), data.get('data_fim', ''), data.get('icone', ''),
            data.get('imagem', ''), data.get('resumo', ''), data.get('descricao', ''),
            data.get('publico_alvo', ''), data.get('local', ''), data.get('documentos', '')
        ))
        db.commit()
        new_id = cur.lastrowid
        db.close()
        registrar_log(f"Criou campanha ID: {new_id} - {data.get('titulo', '')}")
        return jsonify({'sucesso': True, 'id': new_id}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/campanhas/<int:campanha_id>', methods=['PUT'])
@login_required
def editar_campanha(campanha_id):
    from app import get_db_connection
    data = request.get_json()
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            UPDATE campanhas 
            SET titulo = ?, categoria = ?, status = ?, data_inicio = ?, data_fim = ?, icone = ?, imagem = ?, resumo = ?, descricao = ?, publico_alvo = ?, local = ?, documentos = ?
            WHERE id = ?
        """, (
            data.get('titulo', ''), data.get('categoria', ''), data.get('status', ''),
            data.get('data_inicio', ''), data.get('data_fim', ''), data.get('icone', ''),
            data.get('imagem', ''), data.get('resumo', ''), data.get('descricao', ''),
            data.get('publico_alvo', ''), data.get('local', ''), data.get('documentos', ''),
            campanha_id
        ))
        db.commit()
        db.close()
        registrar_log(f"Editou campanha ID: {campanha_id}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/campanhas/<int:campanha_id>', methods=['DELETE'])
@login_required
def deletar_campanha(campanha_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("DELETE FROM campanhas WHERE id = ?", (campanha_id,))
        db.commit()
        db.close()
        registrar_log(f"Excluiu campanha ID: {campanha_id}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ══════════════════════════════════════════════════════════════════
#  MAPA DE DOENÇAS / ATLAS 3D
# ══════════════════════════════════════════════════════════════════

@admin_bp.route('/api/admin/doencas', methods=['GET'])
@login_required
def listar_doencas_prevencao():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        
        # Migração Automática: Adicionar colunas se não existirem
        colunas_necessarias = [
            ("especialista", "TEXT"),
            ("encaminhamento", "TEXT"),
            ("gravidade", "TEXT"),
            ("bg_class", "TEXT"),
            ("tratamento", "TEXT"),
            ("prevencao", "TEXT"),
            ("imagem", "TEXT"),
            ("cor", "TEXT")
        ]
        for col_nome, col_tipo in colunas_necessarias:
            try:
                cur.execute(f"ALTER TABLE doencas_prevencao ADD COLUMN {col_nome} {col_tipo}")
            except Exception:
                pass # Coluna já existe
        
        cur.execute("SELECT * FROM doencas_prevencao ORDER BY ordem ASC, id ASC")
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/doencas', methods=['POST'])
@login_required
def criar_doenca_prevencao():
    from app import get_db_connection
    data = request.get_json()
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            INSERT INTO doencas_prevencao (titulo, icone, o_que_e, tratamento, prevencao, imagem, cor, ordem, especialista, encaminhamento, gravidade, bg_class)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('titulo', ''), data.get('icone', '🩺'), data.get('o_que_e', ''),
            data.get('tratamento', ''), data.get('prevencao', ''), data.get('imagem', ''),
            data.get('cor', '#007bff'), data.get('ordem', 0),
            data.get('especialista', ''), data.get('encaminhamento', ''),
            data.get('gravidade', ''), data.get('bg_class', '')
        ))
        db.commit()
        new_id = cur.lastrowid
        db.close()
        registrar_log(f"Criou doença no Mapa: {data.get('titulo', '')}")
        return jsonify({'sucesso': True, 'id': new_id}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/doencas/<int:doenca_id>', methods=['PUT'])
@login_required
def editar_doenca_prevencao(doenca_id):
    from app import get_db_connection
    data = request.get_json()
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            UPDATE doencas_prevencao 
            SET titulo = ?, icone = ?, o_que_e = ?, tratamento = ?, prevencao = ?, imagem = ?, cor = ?, ordem = ?, especialista = ?, encaminhamento = ?, gravidade = ?, bg_class = ?
            WHERE id = ?
        """, (
            data.get('titulo', ''), data.get('icone', '🩺'), data.get('o_que_e', ''),
            data.get('tratamento', ''), data.get('prevencao', ''), data.get('imagem', ''),
            data.get('cor', '#007bff'), data.get('ordem', 0),
            data.get('especialista', ''), data.get('encaminhamento', ''),
            data.get('gravidade', ''), data.get('bg_class', ''),
            doenca_id
        ))
        db.commit()
        db.close()
        registrar_log(f"Editou doença no Mapa ID: {doenca_id}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/doencas/<int:doenca_id>', methods=['DELETE'])
@login_required
def deletar_doenca_prevencao(doenca_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("DELETE FROM doencas_prevencao WHERE id = ?", (doenca_id,))
        db.commit()
        db.close()
        registrar_log(f"Excluiu doença do Mapa ID: {doenca_id}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ══════════════════════════════════════════════════════════════════
#  LOGS DO SISTEMA E DASHBOARD
# ══════════════════════════════════════════════════════════════════

@admin_bp.route('/api/admin/logs', methods=['GET'])
@login_required
def listar_logs():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT * FROM logs ORDER BY data_acao DESC LIMIT 100")
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/logs', methods=['POST'])
@login_required
def criar_log():
    from app import get_db_connection
    data = request.get_json()
    acao = data.get('acao', '').strip()
    
    if not acao:
        return jsonify({'erro': 'Ação é obrigatória'}), 400
    
    try:
        registrar_log(acao)
        return jsonify({'sucesso': True}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/logs', methods=['DELETE'])
@login_required
def limpar_logs():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("DELETE FROM logs")
        db.commit()
        db.close()
        registrar_log("Limpou todo o histórico de logs")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/resumo', methods=['GET'])
@login_required
def dashboard_resumo():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()

        cur.execute("SELECT COUNT(*) FROM noticias")
        total_noticias = cur.fetchone()[0]

        cur.execute("SELECT COALESCE(SUM(acessos), 0) FROM noticias")
        total_acessos = cur.fetchone()[0] or 0

        cur.execute("SELECT COALESCE(SUM(cliques), 0) FROM noticias")
        soma_cliques = cur.fetchone()[0]
        total_cliques = soma_cliques if soma_cliques else 0

        cur.execute("SELECT COUNT(*) FROM comentarios")
        total_comentarios = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM campanhas WHERE status = 1")
        campanhas_ativas = cur.fetchone()[0]

        db.close()

        return jsonify({
            'noticias': total_noticias,
            'acessos': total_acessos,
            'cliques': total_cliques,
            'comentarios': total_comentarios,
            'campanhas_ativas': campanhas_ativas
        })
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/dashboard', methods=['GET'])
@login_required
def dashboard_legacy():
    # Rota mapeada para manter integridade com possiveis chamadas antigas
    return dashboard_resumo()


# ══════════════════════════════════════════════════════════════════
#  USUÁRIOS E NOTIFICAÇÕES DIRETAS
# ══════════════════════════════════════════════════════════════════

@admin_bp.route('/api/admin/usuarios', methods=['GET'])
@login_required
def listar_usuarios_admin():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("SELECT id, nome, cpf, tipo FROM usuarios ORDER BY nome ASC")
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/notificacoes', methods=['GET'])
@login_required
def listar_notificacoes_admin():
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("""
            SELECT n.*, u.nome as usuario_nome, u.cpf as usuario_cpf
            FROM notificacoes n
            LEFT JOIN usuarios u ON n.usuario_id = u.id
            ORDER BY n.criada_em DESC
        """)
        rows = cur.fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/notificacoes', methods=['POST'])
@login_required
def criar_notificacao_admin():
    from app import get_db_connection
    data = request.get_json()
    usuario_id = data.get('usuario_id')
    mensagem = data.get('mensagem', '').strip()
    
    if not usuario_id or not mensagem:
        return jsonify({'erro': 'Usuário e mensagem são obrigatórios.'}), 400
        
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("INSERT INTO notificacoes (usuario_id, mensagem, lida) VALUES (?, ?, 0)", (usuario_id, mensagem))
        db.commit()
        new_id = cur.lastrowid
        db.close()
        registrar_log(f"Enviou notificação ID: {new_id} para usuário ID: {usuario_id}")
        return jsonify({'sucesso': True, 'id': new_id}), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/notificacoes/<int:notif_id>', methods=['DELETE'])
@login_required
def deletar_notificacao_admin(notif_id):
    from app import get_db_connection
    try:
        db = get_db_connection()
        cur = db.cursor()
        cur.execute("DELETE FROM notificacoes WHERE id = ?", (notif_id,))
        db.commit()
        db.close()
        registrar_log(f"Excluiu notificação ID: {notif_id}")
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ══════════════════════════════════════════════════════════════════
#  SISTEMA, CONFIGURAÇÕES E ESTADÍSTICAS REAIS
# ══════════════════════════════════════════════════════════════════

@admin_bp.route('/api/admin/acessos-semana', methods=['GET'])
@login_required
def obter_acessos_semana():
    from app import get_db_connection
    from datetime import date, timedelta
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Mapeamento do dia da semana
        dias_semana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
        meses_abrev = {
            "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
            "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez"
        }
        
        labels = []
        valores = []
        
        # Pega os últimos 7 dias dinamicamente
        for i in range(6, -1, -1):
            d = date.today() - timedelta(days=i)
            data_str = d.strftime('%Y-%m-%d')
            
            dia_sem_idx = int(d.strftime('%w'))
            dia_semana_nome = dias_semana[dia_sem_idx]
            
            dia_num = d.strftime('%d')
            mes_num = d.strftime('%m')
            mes_nome = meses_abrev.get(mes_num, mes_num)
            
            label_dia = f"{dia_semana_nome} ({dia_num}/{mes_nome})"
            
            cur.execute("SELECT quantidade FROM acessos_diarios WHERE data = ?", (data_str,))
            row = cur.fetchone()
            qtd = row[0] if row else 0
            
            labels.append(label_dia)
            valores.append(qtd)
            
        conn.close()
        return jsonify({
            'labels': labels,
            'valores': valores
        })
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/settings', methods=['GET'])
@login_required
def get_settings():
    from app import get_db_connection
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT chave, valor FROM settings")
        rows = cur.fetchall()
        conn.close()
        settings_dict = {row['chave']: row['valor'] for row in rows}
        return jsonify(settings_dict)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@admin_bp.route('/api/admin/settings', methods=['POST'])
@login_required
def save_settings():
    from app import get_db_connection
    try:
        data = request.get_json()
        conn = get_db_connection()
        cur = conn.cursor()
        for chave, valor in data.items():
            cur.execute("INSERT OR REPLACE INTO settings (chave, valor) VALUES (?, ?)", (chave, str(valor)))
        conn.commit()
        conn.close()
        registrar_log("Atualizou configurações globais do sistema")
        return jsonify({'status': 'sucesso', 'mensagem': 'Configurações salvas com sucesso!'})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


