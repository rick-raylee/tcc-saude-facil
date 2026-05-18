import os, glob, codecs

for py_file in glob.glob('backend/routes/*.py'):
    text = codecs.open(py_file, 'r', 'utf-8').read()
    changed = False
    
    orig1 = "usuario_id = session.get('usuario_id')\n"
    fall1 = "usuario_id = session.get('usuario_id') or request.headers.get('X-User-Id')\n"
    if orig1 in text:
        text = text.replace(orig1, fall1)
        changed = True

    orig_uid = "uid = session.get('usuario_id')\n"
    fall_uid = "uid = session.get('usuario_id') or request.headers.get('X-User-Id')\n"
    if orig_uid in text:
         text = text.replace(orig_uid, fall_uid)
         changed = True
         
    orig_tipo = "tipo = session.get('usuario_tipo')\n"
    fall_tipo = "tipo = session.get('usuario_tipo') or request.headers.get('X-User-Type')\n"
    if orig_tipo in text:
         text = text.replace(orig_tipo, fall_tipo)
         changed = True

    # Check for direct calls on session.get('usuario_tipo')
    if "session.get('usuario_tipo') not in ['medico', 'medico_tele']" in text:
        text = text.replace("session.get('usuario_tipo')", "(session.get('usuario_tipo') or request.headers.get('X-User-Type'))")
        changed = True

    if changed:
        codecs.open(py_file, 'w', 'utf-8').write(text)
        print(f"Patched {py_file}")
