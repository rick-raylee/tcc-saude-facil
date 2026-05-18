import re

path = r'C:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\admin.js'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Replace Mojibake bullets
text = text.replace('â€¢', '•')

# Fix corrupted button icons
text = re.sub(r'abrirModalNoticia\([^>]+>.*?<\/button>', lambda m: m.group(0).split('>')[0] + '>✏️</button>', text)
text = re.sub(r'deletarNoticia\([^>]+>.*?<\/button>', lambda m: m.group(0).split('>')[0] + '>🗑️</button>', text)

# Just in case there are loose moji characters
text = text.replace('âœŽï¸', '✏️')
text = text.replace('ðŸ—‘ï¸', '🗑️')
text = text.replace('â„¹ï¸', 'ℹ️')
text = text.replace('INICIALIZAǟO', 'INICIALIZAÇÃO')
text = text.replace('Ediǜo', 'Edição')
text = text.replace('', '') # Remove random replacement characters that got stuck

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Characters Fixed!')
