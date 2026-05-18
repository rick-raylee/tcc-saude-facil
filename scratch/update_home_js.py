
import os

home_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\home.js'

with open(home_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    "window.location.replace('admin.html');": "window.location.replace('/admin');",
    "window.location.replace('painel_telemedicina.html');": "window.location.replace('/painel-telemedicina');",
    "window.location.replace('medico.html');": "window.location.replace('/painel-medico');",
    "window.location.replace('enfermeiro.html');": "window.location.replace('/painel-enfermeiro');",
    "window.location.replace('ti.html');": "window.location.replace('/painel-ti');",
    "window.location.replace('perfil.html');": "window.location.replace('/dashboard');"
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open(home_path, 'w', encoding='utf-8') as f:
    f.writelines(content)

print("home.js redirections updated successfully.")
