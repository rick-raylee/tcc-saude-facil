const fs = require('fs');
const path = 'index.html';

const header = `<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portal Saúde Fácil</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="main.css?v=1.2">
    <link rel="stylesheet" href="home.css?v=1.2">
    <link rel="stylesheet" href="responsive.css?v=1.2">
</head>

<body>

    <!-- NAVBAR ANIMADA -->
    <header class="navbar" id="navbar">
        <div class="logo">
            <a href="index.html">
                <img src="logo-saude-facil.png" alt="Logo Saúde Fácil"
                    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2260%22><text x=%2210%22 y=%2240%22 font-size=%2230%22 fill=%22white%22>SUS</text></svg>'">
            </a>
        </div>

        <!-- MENU HAMBURGER MOBILE -->
        <input type="checkbox" id="menu-toggle" class="menu-toggle-checkbox">
        <label for="menu-toggle" class="hamburger-menu">
            <span></span>
            <span></span>
            <span></span>
        </label>

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
                <!-- Dropdown de Notificações -->
                <div class="nav-notif-dropdown glass-card" id="navNotifDropdown">
                    <div class="nav-notif-header">
                        <span>Avisos e Campanhas</span>
                        <button onclick="limparNotificacoes()">Limpar</button>
                    </div>
                    <div id="nav-notif-list" class="nav-notif-list">
                        <p class="nav-notif-empty">Nenhuma nova campanha.</p>
                    </div>
                </div>
            </div>
        </nav>

        <div class="nav-auth">
            <button class="btn-auth btn-login" onclick="abrirModalLogin()">LOGIN</button>
            <button class="btn-auth btn-cadastro" onclick="abrirModalCadastro()">CADASTRE-SE</button>
        </div>
    </header>

    <!-- CONTEÚDO PRINCIPAL (REQUISITO 1 & GRID) -->
    <div class="container main-layout">

        <!-- ALERTAS GERAIS E CAMPANHAS -->
        <div id="alertas-container">
            <div id="home-appointment-alert"></div>
            <div id="home-campanhas-alert"></div>
        </div>

        <!-- HERO SECTION DE ELITE (PANORÂMICA 3D) -->
        <section class="hero-section premium-skyline">
            <div class="hero-glass-container glass-card">
                <div class="hero-content">
                    <div class="hero-badge">✨ Saúde Digital 2.0</div>
                    <h1>Explore o Futuro da Saúde com <span>Tecnologia 3D</span></h1>
                    <p>Uma experiência imersiva e inteligente. Gerencie sua saúde com dados em tempo real, 
                       agendamentos simplificados e mapeamento dinâmico de precisão.</p>
                    
                    <div class="hero-actions">
                        <button class="btn-premium btn-primary" onclick="abrirModalCadastro()">Começar Agora</button>
                        <button class="btn-premium btn-outline" onclick="document.querySelector('.noticias-section').scrollIntoView()">Ver Notícias</button>
                    </div>
                </div>
                
                <div class="hero-visual">
`;

try {
    const currentContent = fs.readFileSync(path, 'utf8');
    fs.writeFileSync(path, header + currentContent, 'utf8');
    console.log('index.html restored successfully!');
} catch (err) {
    console.error('Error fixing index.html:', err);
}
