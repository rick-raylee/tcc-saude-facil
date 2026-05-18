import re

path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\routes\ti.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

def fix_table_data(m):
    return '''@ti_bp.route('/api/ti/db/data/<table_name>', methods=['GET'])
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
        return jsonify({'erro': str(e)}), 500'''

text = re.sub(r"@ti_bp\.route\('/api/ti/db/data/<table_name>', methods=\['GET'\]\).*?return jsonify\(\{'erro': str\(e\)\}\), 500", fix_table_data, text, flags=re.DOTALL)

def fix_add_row(m):
    return '''@ti_bp.route('/api/ti/db/data/<table_name>', methods=['POST'])
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
        return jsonify({'erro': str(e)}), 500'''

text = re.sub(r"@ti_bp\.route\('/api/ti/db/data/<table_name>', methods=\['POST'\]\).*?return jsonify\(\{'erro': str\(e\)\}\), 500", fix_add_row, text, flags=re.DOTALL)


def fix_update_row(m):
    return '''@ti_bp.route('/api/ti/db/data/<table_name>/<pk_col>/<pk_val>', methods=['PUT'])
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
        return jsonify({'erro': str(e)}), 500'''

text = re.sub(r"@ti_bp\.route\('/api/ti/db/data/<table_name>/<pk_col>/<pk_val>', methods=\['PUT'\]\).*?return jsonify\(\{'erro': str\(e\)\}\), 500", fix_update_row, text, flags=re.DOTALL)


def fix_delete_row(m):
    return '''@ti_bp.route('/api/ti/db/data/<table_name>/<pk_col>/<pk_val>', methods=['DELETE'])
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
        return jsonify({'erro': str(e)}), 500'''

text = re.sub(r"@ti_bp\.route\('/api/ti/db/data/<table_name>/<pk_col>/<pk_val>', methods=\['DELETE'\]\).*?return jsonify\(\{'erro': str\(e\)\}\), 500", fix_delete_row, text, flags=re.DOTALL)


def fix_table_struct(m):
    return '''@ti_bp.route('/api/ti/db/structure/<table_name>', methods=['GET'])
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
        return jsonify({'erro': str(e)}), 500'''

text = re.sub(r"@ti_bp\.route\('/api/ti/db/structure/<table_name>', methods=\['GET'\]\).*?return jsonify\(\{'erro': str\(e\)\}\), 500", fix_table_struct, text, flags=re.DOTALL)


with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('SQLI vulnerabilities mitigated.')
