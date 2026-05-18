import os

file_path = 'index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """                                    <div class="form-group-3d">
                                        <label for="coren">🩺 COREN</label>
                                        <input type="text" id="coren" class="input-neon-focus"
                                            placeholder="Ex: 123456/PR">
                                    </div>"""

# Verificando se o target existe no conteúdo
if target in content:
    print("Encontrado! Substituindo...")
    replacement = target + """
                                    <div class="form-group-3d full-width">
                                        <label>📋 Categoria Profissional</label>
                                        <div class="radio-group-horizontal-neon">
                                            <label class="radio-neon">
                                                <input type="radio" name="tipo_profissional" value="Enfermeiro" checked>
                                                <span>Enfermeiro(a)</span>
                                            </label>
                                            <label class="radio-neon">
                                                <input type="radio" name="tipo_profissional" value="Técnico">
                                                <span>Técnico(a)</span>
                                            </label>
                                        </div>
                                    </div>"""
    new_content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Sucesso!")
else:
    print("Não encontrado. Tentando versão simplificada...")
    # Tenta encontrar apenas pelo ID do coren
    parts = content.split('id="coren"')
    if len(parts) > 1:
         # Encontrou o campo, agora tenta achar o fechamento da div dele
         # ... (lógica mais complexa ou apenas sinalizar falha)
         print(f"Encontrou id='coren' mas o bloco completo não bateu. {len(parts)} ocorrências.")
    else:
         print("id='coren' não encontrado.")
