import codecs

try:
    content = codecs.open('telemedicina.html', 'r', 'utf-8').read()
    
    # Check if target exists
    target = "CRIAR CONTA</button>\n                </div>"
    if target in content:
        replacement = target + '\n                <div style="margin-top: 15px;">\n                    <button class="btn-neon-health" style="background: transparent; color: #0288d1; border: 1px solid #0288d1; font-size: 0.8rem; padding: 8px 15px;" onclick="abrirCadastroTelemedicina()">👩‍⚕️ Cadastrar-se como Médico para Telemedicina</button>\n                </div>'
        content = content.replace(target, replacement)
        
    # Append script right before body
    script = """
    <script>
    function abrirCadastroTelemedicina() {
        abrirModalAuth('cadastro');
        setTimeout(() => {
            const radM = document.querySelector('input[value="medico"]');
            if(radM) { radM.checked = true; mudarTipoCadastro('medico'); }
            const radT = document.getElementById('radio-tele-medico');
            if(radT) radT.checked = true;
        }, 500);
    }
    </script>
    </body>
    """
    content = content.replace('</body>', script)
    
    codecs.open('telemedicina.html', 'w', 'utf-8').write(content)
    print("Modificacao realizada com sucesso no telemedicina.html")
except Exception as e:
    print(f"Erro: {e}")
