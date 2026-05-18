import os

path = r'c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP\index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check if nav-links already exists (just in case)
if '<nav class="nav-links">' not in content:
    nav_links = """
        <nav class="nav-links">
            <a href="agendamento.html">Agendamento</a>
            <a href="telemedicina.html">Telemedicina</a>
            <a href="campanhas.html">Campanhas</a>
            <a href="mapas.html">Mapas</a>
            <a href="duvidas.html">Dúvidas</a>
            <div class="nav-bell-container" id="navBellContainer">
                <div class="nav-bell-icon" onclick="toggleNotificacoes(event)">
                    🔔
                    <span class="nav-bell-badge" id="nav-notif-count">0</span>
                </div>
                <div class="nav-notif-dropdown glass-card" id="navNotifDropdown">
                    <div class="nav-notif-header">
                        <span>Campanhas e Avisos</span>
                        <button onclick="limparNotificacoes()">Limpar</button>
                    </div>
                    <div id="nav-notif-list" class="nav-notif-list">
                        <p class="nav-notif-empty">Nenhuma nova campanha.</p>
                    </div>
                </div>
            </div>
        </nav>
"""
    # Insert before <div class="nav-auth">
    if '<div class="nav-auth">' in content:
        content = content.replace('<div class="nav-auth">', nav_links + '\n        <div class="nav-auth">')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Navbar restored and bell added.")
    else:
        print("Error: nav-auth not found.")
else:
    print("Navbar already exists.")
