import os
import re

target_files = [
    'index.html',
    'indexHome.html',
    'agendamento.html',
    'campanhas.html',
    'duvidas.html',
    'telemedicina.html',
    'termos.html',
    'privacidade.html'
]

script_tag = '    <script src="cookie-consent.js" defer></script>\n</body>'

base_path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP'

for filename in target_files:
    filepath = os.path.join(base_path, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if already injected
        if 'cookie-consent.js' in content:
            print(f"Already injected in {filename}")
            continue

        # Replace </body> (case-insensitive) with the script tag followed by </body>
        new_content = re.sub(r'</body>', script_tag, content, flags=re.IGNORECASE)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Injected in {filename}")
    else:
        print(f"File not found: {filename}")
