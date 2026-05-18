import os

file_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\routes\enfermeiro.py'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = 0
for i, line in enumerate(lines):
    if skip > 0:
        skip -= 1
        continue
    
    # Matching the specific lines with line numbers from previous view_file (57-61)
    # Line indices are 0-based, so 57-1 = 56
    if i == 56 and 'if not pac:' in line:
        new_lines.append("        if not pac:\n")
        new_lines.append("            # Tentar Cadastro Rápido se dados forem fornecidos\n")
        new_lines.append("            nome = data.get('nome_novo', '').strip()\n")
        new_lines.append("            if not nome:\n")
        new_lines.append("                db.close()\n")
        new_lines.append("                return jsonify({'erro': 'Paciente não encontrado e dados para cadastro rápido não fornecidos'}), 404\n")
        new_lines.append("\n")
        new_lines.append("            sus = data.get('sus_novo', '').strip()\n")
        new_lines.append("            nasc = data.get('nasc_novo', '').strip()\n")
        new_lines.append("\n")
        new_lines.append("            # Criar senha padrão\n")
        new_lines.append("            from werkzeug.security import generate_password_hash\n")
        new_lines.append("            hash_senha = generate_password_hash('paciente123')\n")
        new_lines.append("\n")
        new_lines.append("            cur.execute(\"\"\"\n")
        new_lines.append("                INSERT INTO usuarios (nome, cpf, sus, data_nascimento, tipo, senha)\n")
        new_lines.append("                VALUES (?, ?, ?, ?, 'paciente', ?)\n")
        new_lines.append("            \"\"\", (nome, paciente_cpf, sus, nasc, hash_senha))\n")
        new_lines.append("            db.commit()\n")
        new_lines.append("            paciente_id = cur.lastrowid\n")
        new_lines.append("        else:\n")
        new_lines.append("            paciente_id = pac['id']\n")
        # Jump over lines 58, 59, 60, 61
        skip = 4 
    else:
        new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully patched enfermeiro.py")
