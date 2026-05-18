import codecs
filepath = 'backend/routes/telemedicina.py'
try:
    text = codecs.open(filepath, 'r', 'utf-8').read()
    text = text.replace("if tipo == 'medico':", "if tipo in ['medico', 'medico_tele']:")
    text = text.replace("if session.get('usuario_tipo') != 'medico':", "if session.get('usuario_tipo') not in ['medico', 'medico_tele']:")
    codecs.open(filepath, 'w', 'utf-8').write(text)
    print("Sucesso!")
except Exception as e:
    print("Erro:", e)
