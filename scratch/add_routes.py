
import os

app_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\backend\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
inserted = False
for line in lines:
    new_lines.append(line)
    if "@app.route('/painel-telemedicina', strict_slashes=False)" in line:
        # Wait until we find the end of this function (index.html, redirect, etc)
        pass
    if "return redirect('/')" in line and not inserted and any("/painel-telemedicina" in l for l in new_lines[-5:]):
        new_lines.append("\n")
        new_lines.append("@app.route('/painel-medico', strict_slashes=False)\n")
        new_lines.append("def painel_medico():\n")
        new_lines.append("    user_role = session.get('usuario_tipo') or session.get('tipo')\n")
        new_lines.append("    if session.get('usuario_id') and (user_role == 'medico' or user_role == 'medico_tele'):\n")
        new_lines.append("        return send_from_directory('../', 'medico.html')\n")
        new_lines.append("    return redirect('/')\n")
        new_lines.append("\n")
        new_lines.append("@app.route('/painel-ti', strict_slashes=False)\n")
        new_lines.append("def painel_ti():\n")
        new_lines.append("    user_role = session.get('usuario_tipo') or session.get('tipo')\n")
        new_lines.append("    if session.get('usuario_id') and user_role == 'ti':\n")
        new_lines.append("        return send_from_directory('../', 'ti.html')\n")
        new_lines.append("    return redirect('/')\n")
        inserted = True

with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Routes inserted successfully.")
