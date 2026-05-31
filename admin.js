// --- INICIALIZAÇÃO ---
// Variáveis Globais para Edição de Mapa
let idxEstatisticaSelecionada = null;
let adminStatsMapInstance = null;

async function initAdmin() {
    let logado = false;

    if (typeof API !== 'undefined') {
        const sessao = await API.sessao();
        // Se `sessao` for nula OU conter um 'erro' (ex: falha de rede/CORS), assume fallback local
        if (!sessao || sessao.erro) {
            logado = (localStorage.getItem('adminLogado') === 'true');
        } else if (sessao.logado && sessao.usuario && sessao.usuario.tipo === 'admin') {
            logado = true;
            localStorage.setItem('adminLogado', 'true');
            localStorage.setItem('usuarioNome', sessao.usuario.nome);
        } else if (sessao.logado) {
            // Logado como outra coisa que não seja admin
            logado = false;
        } else {
            // Conta não logada na API Central (sessao inexistente ou expirou)
            // Cai no Fallback Local para desenvolvimento offline ou misto
            logado = (localStorage.getItem('adminLogado') === 'true');
        }
    } else {
        logado = (localStorage.getItem('adminLogado') === 'true');
    }

    if (!logado) {
        // Redireciona para o Portal (/) se não estiver logado
        window.location.replace('/'); 
        return;
    }

    // Acesso permitido
    document.body.style.display = 'block';

    const path = window.location.pathname;
    let sectionToLoad = 'dashboard';

    const isServerRouting = window.location.pathname.startsWith('/admin') && !window.location.pathname.includes('.html');

    if (window.location.protocol === 'file:' || !isServerRouting) {
        // Se estiver rodando local ou Live Server, verifica se tem hash (ex: admin.html#noticias)
        if (window.location.hash) {
            const hashRoute = window.location.hash.replace('#', '');
            if (['dashboard', 'carrossel', 'noticias', 'comentarios', 'campanhas', 'estatisticas', 'doencas', 'logs', 'preview', 'settings'].includes(hashRoute)) {
                sectionToLoad = (hashRoute === 'estatisticas' || hashRoute === 'stats') ? 'stats' : hashRoute;
            }
        }
    } else {
        // Nativo do Flask
        if (path.startsWith('/admin/') && path.length > 7) {
            const route = path.split('/')[2];
            if (['dashboard', 'carrossel', 'noticias', 'comentarios', 'campanhas', 'estatisticas', 'doencas', 'logs', 'preview', 'settings'].includes(route)) {
                sectionToLoad = (route === 'estatisticas' || route === 'stats') ? 'stats' : route;
            }
        }
    }

    mudarSecao(sectionToLoad, false); // false = dont push state on initial load

    const nome = localStorage.getItem('usuarioNome') || 'Administrador';
    
    // Suporte ao novo layout de perfil dropdown premium com iniciais
    function getInitials(name) {
        if (!name) return 'AD';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    
    const initials = getInitials(nome);
    const triggerAvatar = document.getElementById('admin-avatar-trigger');
    const largeAvatar = document.getElementById('admin-avatar-large');
    const welcomeModern = document.getElementById('admin-welcome-message-modern');
    const nameFull = document.getElementById('admin-name-full');
    
    if (triggerAvatar) triggerAvatar.textContent = initials;
    if (largeAvatar) largeAvatar.textContent = initials;
    if (welcomeModern) {
        const first = nome.trim().split(/\s+/)[0];
        welcomeModern.textContent = `Olá, ${first}`;
    }
    if (nameFull) nameFull.textContent = nome;

    // Fallback para o caso de elementos antigos
    const welcomeMsg = document.getElementById('admin-welcome-message');
    if (welcomeMsg) welcomeMsg.textContent = `Olá, ${nome}`;

    window.mudarSecao = mudarSecao;

    // SPA Link Hijacking
    document.querySelectorAll('.nav-btn, .logo-admin a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            let sec = 'dashboard';

            if (link.dataset.section) {
                // Pega do data-section se for um botão da sidebar
                sec = link.dataset.section;
            } else if (link.href) {
                // Tenta extrair da URL se for um link normal
                const url = new URL(link.href, window.location.origin);
                const routeMatch = url.pathname.match(/\/admin\/([^\/]+)/);
                if (routeMatch) {
                    sec = routeMatch[1] === 'estatisticas' ? 'stats' : routeMatch[1];
                }
            }

            mudarSecao(sec, true);
            if (sec === 'stats' || sec === 'estatisticas') {
                setTimeout(initAdminMap, 500);
            }
        });
    });

    // History API back/forward support
    window.addEventListener('popstate', () => {
        let sec = 'dashboard';
        if (window.location.protocol === 'file:') {
            if (window.location.hash) {
                sec = window.location.hash.replace('#', '');
            }
        } else {
            const route = window.location.pathname.split('/')[2];
            if (route) sec = route === 'estatisticas' ? 'stats' : route;
        }
        mudarSecao(sec, false);
        if (sec === 'stats' || sec === 'estatisticas') {
            setTimeout(initAdminMap, 500);
        }
    });
} if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initAdmin); } else { initAdmin(); }

function logoutAdmin() {
    if (typeof API !== 'undefined') API.logout();
    localStorage.removeItem('adminLogado');
    localStorage.removeItem('usuarioLogado');
    localStorage.removeItem('usuarioNome');
    localStorage.removeItem('tipoUsuario');
    window.location.replace('/');
}

async function mudarSecao(secaoId, push = true) {
    document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    const sectionEl = document.getElementById(`sec-${secaoId}`);
    if (sectionEl) sectionEl.style.display = 'block';

    const btn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.dataset.section === secaoId);
    if (btn) btn.classList.add('active');

    if (push) {
        const routePath = secaoId === 'stats' ? 'estatisticas' : secaoId;
        const isServerRouting = window.location.pathname.startsWith('/admin') && !window.location.pathname.includes('.html');
        
        if (window.location.protocol === 'file:' || !isServerRouting) {
            // Em arquivos locais ou usando Live Server (admin.html), substitui a URL pelo hash (#noticias)
            // Isso previne o erro "Cannot GET /admin/..." ao atualizar a página (F5)
            window.history.pushState(null, '', `#${routePath}`);
        } else {
            // No servidor Flask (rodando em /admin nativamente), substitui pela barra limpa /admin/noticias
            try {
                window.history.pushState(null, '', `/admin/${routePath}`);
            } catch (e) {
                console.warn("Navegação SPA não suportada no ambiente atual", e);
            }
        }
    }

    // Carregar dados via API ou Local
    if (secaoId === 'dashboard') await carregarDashboard();
    if (secaoId === 'noticias') await carregarNoticias();
    if (secaoId === 'comentarios') await carregarComentarios();
    if (secaoId === 'campanhas') await carregarCampanhas();
    if (secaoId === 'notificacoes') await carregarNotificacoesAdmin();
    if (secaoId === 'stats') await carregarStatsEditor();
    if (secaoId === 'doencas') await carregarDoencas();
    if (secaoId === 'carrossel') await carregarCarrosselEditor();
    if (secaoId === 'logs') await carregarLogs();
    if (secaoId === 'settings') await carregarSettings();

    // Forçar carregamento do Preview se necessário
    if (secaoId === 'preview') {
        const iframe = document.getElementById('iframe-preview');
        if (iframe) {
            iframe.src = window.ADMIN_INDEX_URL || (window.location.protocol === 'file:' ? 'index.html' : '/index.html'); 
        }
    }

    if (secaoId === 'stats' || secaoId === 'estatisticas') {
        setTimeout(initAdminMap, 300);
    }
}

// --- DASHBOARD ---
async function carregarDashboard() {
    let googleAnalyticsId = '';
    
    // Tentar via API
    if (typeof API !== 'undefined') {
        const dados = await API.dashboard();
        if (dados && !dados.erro) {
            document.getElementById('counter-noticias').textContent = dados.noticias || 0;
            document.getElementById('counter-acessos').textContent = dados.acessos || 0;
            document.getElementById('counter-cliques').textContent = dados.cliques || 0;
            document.getElementById('counter-comentarios').textContent = dados.comentarios || 0;
            document.getElementById('counter-campanhas').textContent = dados.campanhas_ativas || 0;
        }

        // Tentar obter configurações gerais públicas
        const config = await API.settingsPublic();
        if (config && !config.erro) {
            googleAnalyticsId = config.google_analytics_id || '';
        }
    }

    // Atualizar Widget de Status do Google Analytics
    const gaTitle = document.getElementById('ga-status-title');
    const gaIdVal = document.getElementById('ga-status-id');
    const gaDot = document.getElementById('ga-status-dot');
    const gaMsg = document.getElementById('ga-status-msg');

    if (gaTitle && gaIdVal && gaDot && gaMsg) {
        if (googleAnalyticsId && googleAnalyticsId.trim() !== '') {
            gaTitle.textContent = "Sincronizado e Ativo";
            gaIdVal.textContent = googleAnalyticsId;
            gaDot.style.background = "#4caf50"; // Verde
            gaDot.style.boxShadow = "0 0 10px #4caf50";
            gaMsg.textContent = "Conectado e rastreando visitas";
        } else {
            gaTitle.textContent = "Não Conectado";
            gaIdVal.textContent = "Não Configurado";
            gaDot.style.background = "#f44336"; // Vermelho
            gaDot.style.boxShadow = "none";
            gaMsg.textContent = "Integração desativada";
        }
    }

    // Carregar Gráfico com Dados Reais do Banco
    let labelsGrafico = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    let dadosGrafico = [120, 190, 300, 500, 200, 300, 450]; // Mock de fallback

    if (typeof API !== 'undefined') {
        const dadosAcessos = await API.acessosSemana();
        if (dadosAcessos && !dadosAcessos.erro && dadosAcessos.labels && dadosAcessos.valores) {
            labelsGrafico = dadosAcessos.labels;
            dadosGrafico = dadosAcessos.valores;
        }
    }

    const chartCanvas = document.getElementById('acessosChart');
    if (chartCanvas) {
        if (window.myAcessosChartInstance) {
            window.myAcessosChartInstance.destroy();
        }
        
        const ctx = chartCanvas.getContext('2d');
        window.myAcessosChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labelsGrafico,
                datasets: [{
                    label: 'Acessos Reais (Visitas)',
                    data: dadosGrafico,
                    borderColor: '#004b82',
                    backgroundColor: 'rgba(0, 75, 130, 0.08)',
                    borderWidth: 3,
                    pointBackgroundColor: '#004b82',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 6,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
}

// --- CONFIGURAÇÕES DO SISTEMA ---
async function carregarSettings() {
    if (typeof API === 'undefined') return;
    
    showHealthLoader("Buscando configurações");
    const settings = await API.settings();
    hideHealthLoader();
    
    if (settings && !settings.erro) {
        document.getElementById('settings-portal-titulo').value = settings.portal_titulo || '';
        document.getElementById('settings-portal-subtitulo').value = settings.portal_subtitulo || '';
        document.getElementById('settings-ga-id').value = settings.google_analytics_id || '';
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Não foi possível carregar as configurações do sistema.'
        });
    }
}

async function salvarSettingsGerais(event) {
    event.preventDefault();
    if (typeof API === 'undefined') return;
    
    const titulo = document.getElementById('settings-portal-titulo').value.trim();
    const subtitulo = document.getElementById('settings-portal-subtitulo').value.trim();
    
    showHealthLoader("Salvando configurações");
    const resp = await API.salvarSettings({
        portal_titulo: titulo,
        portal_subtitulo: subtitulo
    });
    hideHealthLoader();
    
    if (resp && resp.status === 'sucesso') {
        Swal.fire({
            icon: 'success',
            title: 'Identidade Atualizada',
            text: 'As informações de identidade do portal foram salvas com sucesso!'
        });
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Falha ao Salvar',
            text: resp.erro || 'Ocorreu um erro ao salvar as configurações.'
        });
    }
}

async function salvarSettingsAnalytics(event) {
    event.preventDefault();
    if (typeof API === 'undefined') return;
    
    const gaId = document.getElementById('settings-ga-id').value.trim();
    
    showHealthLoader("Salvando configurações");
    const resp = await API.salvarSettings({
        google_analytics_id: gaId
    });
    hideHealthLoader();
    
    if (resp && resp.status === 'sucesso') {
        Swal.fire({
            icon: 'success',
            title: 'Integração Google Analytics',
            text: gaId === '' ? 'Integração desativada com sucesso.' : `ID ${gaId} ativado com sucesso! As visitas já estão sendo sincronizadas.`
        });
        await carregarDashboard();
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Falha ao Salvar',
            text: resp.erro || 'Ocorreu um erro ao salvar as configurações.'
        });
    }
}

// Exportar manipuladores globais
window.salvarSettingsGerais = salvarSettingsGerais;
window.salvarSettingsAnalytics = salvarSettingsAnalytics;
window.carregarSettings = carregarSettings;


// --- NOT�?CIAS ---
async function carregarNoticias() {
    const lista = document.getElementById('lista-noticias');
    if (!lista) return;

    let noticias = [];
    if (typeof API !== 'undefined') {
        const resp = await API.noticias();
        if (resp && !resp.erro) noticias = resp;
    }

    // Tratamento Fallback Local para evitar Tela em Branco Offline
    if (!noticias || noticias.length === 0) {
        noticias = JSON.parse(localStorage.getItem('admin_noticias') || '[]');
        if (noticias.length === 0) {
            noticias = [
                { id: 1, categoria: "Campanha Nacional", titulo: "Ministério amplia vacinação contra HPV para meninos de até 15 anos", conteudo: "Medida visa reduzir casos de câncer de colo de útero e outras doenças relacionadas ao vírus. O SUS agora disponibiliza...", data: "10 de Fevereiro, 2026", status: "publicado", destaque_carrossel: true, imagem: "https://www.gov.br/saude/pt-br/assuntos/noticias/2022/abril/campanha-de-vacinacao-contra-gripe-e-sarampo-comeca-nesta-segunda-4/vacinacao-gripe-sarampo.jpg/@@images/image.jpeg" },
                { id: 2, categoria: "Tecnologia", titulo: "SUS lança novo aplicativo para agendamento de consultas", conteudo: "Disponível para todo o país, a ferramenta promete zerar as filas em postos de saúde da Atenção Básica.", data: "08 de Fevereiro, 2026", status: "publicado", destaque_carrossel: false, imagem: "https://img.freepik.com/fotos-gratis/equipe-medica-de-sucesso_329181-4235.jpg" },
                { id: 3, categoria: "Saúde Pública", titulo: "Casos de dengue diminuem 40% após campanhas de conscientização", conteudo: "Ações conjuntas entre agentes de saúde e população mostram resultados positivos contra o Aedes aegypti no verão.", data: "05 de Fevereiro, 2026", status: "publicado", destaque_carrossel: false, imagem: "https://blog.ipog.edu.br/wp-content/uploads/2018/10/m%C3%A9dico-com-tablet.jpg" }
            ];
            localStorage.setItem('admin_noticias', JSON.stringify(noticias));
        }
    }

    window._adminNoticiasCache = noticias;

    lista.innerHTML = '';
    noticias.forEach((noticia, idx) => {
        const item = document.createElement('div');
        item.className = 'admin-item';
        const dataStr = noticia.criada_em || noticia.data || '---';
        item.innerHTML = `
            <div class="item-info">
                <h4>${noticia.titulo} <span style="font-size:0.7rem; background:${noticia.status === 'publicado' ? '#28a745' : '#ffc107'}; color:${noticia.status === 'publicado' ? 'white' : 'black'}; padding:2px 5px; border-radius:3px;">${noticia.status.toUpperCase()}</span></h4>
                <small>${dataStr} • Categoria: ${noticia.categoria || 'Geral'}</small>
            </div>
            <div class="item-actions">
                <button class="btn-edit btn-icon-only" onclick="window.abrirModalNoticiaIndex(${idx})"><i class="fi fi-rr-edit"></i></button>
                <button class="btn-delete btn-icon-only" onclick="deletarNoticia(${noticia.id})"><i class="fi fi-rr-trash"></i></button>
            </div>
        `;
        lista.appendChild(item);
    });
}

window.abrirModalNoticiaIndex = function(index) {
    if (window._adminNoticiasCache && window._adminNoticiasCache[index]) {
        window.abrirModalNoticia(window._adminNoticiasCache[index]);
    }
};

async function deletarNoticia(id) {
    if (!confirm('Excluir notícia permanentemente?')) return;

    if (typeof API !== 'undefined') {
        const resp = await API.deletarNoticia(id);
        if (resp && resp.sucesso) {
            Swal.fire({ icon: 'success', title: 'Excluída', text: 'Notícia excluída permanentemente!' });
            await carregarNoticias();
            return;
        }
    }

    // Local
    let noticias = JSON.parse(localStorage.getItem('admin_noticias') || '[]');
    noticias = noticias.filter(n => n.id !== id);
    localStorage.setItem('admin_noticias', JSON.stringify(noticias));
    carregarNoticias();
}

window.abrirModalNoticia = function (noticia = null) {
    const modal = document.getElementById('modal-admin');
    const form = document.getElementById('form-admin');
    document.getElementById('modal-title').textContent = noticia ? 'Editar Notícia' : 'Nova Notícia';

    form.innerHTML = `
        <input type="hidden" id="tipo-form" value="noticia">
        ${noticia ? `<input type="hidden" id="form-noticia-id" value="${noticia.id}">` : ''}
        <div style="margin-bottom:10px; display:grid; grid-template-columns: 2fr 1fr 1fr; gap:10px;">
            <div><label>Título</label><input type="text" id="form-titulo" value="${noticia ? noticia.titulo : ''}" required style="width:100%; padding:8px;"></div>
            <div><label>Categoria</label>
                 <select id="form-categoria" style="width:100%; padding:8px;">
                     <option value="Serviços" ${noticia && noticia.categoria === 'Serviços' ? 'selected' : ''}>Serviços</option>
                     <option value="Campanhas" ${noticia && noticia.categoria === 'Campanhas' ? 'selected' : ''}>Campanhas</option>
                     <option value="Avisos" ${noticia && noticia.categoria === 'Avisos' ? 'selected' : ''}>Avisos</option>
                     <option value="Geral" ${!noticia || noticia.categoria === 'Geral' ? 'selected' : ''}>Geral</option>
                 </select>
            </div>
            <div><label>Status</label>
                 <select id="form-status" style="width:100%; padding:8px;">
                     <option value="publicado" ${!noticia || noticia.status === 'publicado' ? 'selected' : ''}>Publicado</option>
                     <option value="rascunho" ${noticia && noticia.status === 'rascunho' ? 'selected' : ''}>Rascunho</option>
                 </select>
            </div>
        </div>
        <div style="margin-bottom:10px"><label>Resumo</label><textarea id="form-resumo" required style="width:100%; padding:8px; height:60px;">${noticia ? noticia.resumo : ''}</textarea></div>
        <div style="margin-bottom:10px"><label>Conteúdo Completo</label><textarea id="form-texto" required style="width:100%; padding:8px; height:80px;">${noticia ? noticia.conteudo : ''}</textarea></div>
        <div style="margin-bottom:10px; border:1px solid #ccc; padding:10px; border-radius:5px; background:#fafafa;">
             <label style="display:block; margin-bottom:5px;">Imagem da Notícia</label>
             <input type="file" id="form-img-file" accept="image/*" style="width:100%; padding:8px; margin-bottom:10px; background:white; border:1px solid #ddd; cursor:pointer;">
             <div style="text-align:center; font-size:0.85rem; color:#666; margin-bottom:5px;">OU informe uma URL:</div>
             <input type="text" id="form-img" value="${noticia ? noticia.imagem : ''}" placeholder="https://..." style="width:100%; padding:8px;">
        </div>
        
        <div style="margin-bottom:10px; display:flex; gap:15px; align-items:center; background:#f5f5f5; padding:10px; border-radius:4px;">
            <label style="display:flex; align-items:center; gap:5px; margin:0;"><input type="checkbox" id="form-destaque" ${noticia && noticia.destaque_carrossel ? 'checked' : ''}> Aparecer no Carrossel</label>
        </div>
        <button type="submit" style="background:var(--admin-success); color:white; border:none; padding:10px; width:100%; font-weight:bold; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;"><i class="fi fi-rr-disk"></i> ${noticia ? 'Salvar Alterações' : 'Publicar Notícia'}</button>
    `;
    modal.style.display = 'flex';
}

// --- ESTAT�?STICAS ---
window.adicionarEstatistica = function () {
    let stats = JSON.parse(localStorage.getItem('admin_stats') || '[]');
    stats.push({
        id: Date.now(),
        icone: "<i class='fi fi-rr-chart-histogram'></i> ",
        texto: "Nova Estatística",
        valor: "0",
        valor_mapa: "0",
        detalhe: "Detalhe Opcional",
        lat: "-23.5",
        lon: "-46.6",
        cor: "azul"
    });
    localStorage.setItem('admin_stats', JSON.stringify(stats));
    carregarStatsEditor();
}

window.deletarEstatistica = function (index) {
    if (!confirm("Tem certeza que deseja remover esta estatística?")) return;
    let stats = JSON.parse(localStorage.getItem('admin_stats') || '[]');
    stats.splice(index, 1);
    localStorage.setItem('admin_stats', JSON.stringify(stats));
    carregarStatsEditor();
}

async function carregarStatsEditor() {
    let stats = [];
    if (typeof API !== 'undefined') {
        stats = await API.stats();
    }

    // Tratamento Fallback Local para evitar Tela em Branco Offline
    if (!stats || stats.length === 0 || stats.erro) {
        stats = JSON.parse(localStorage.getItem('admin_stats') || '[]');
        if (stats.length === 0) {
            stats = [
                { id: 1, icone: "<i class='fi fi-rr-syringe'></i> ", texto: "Diabéticos no Brasil", valor: "16,8 milhões", detalhe: "Representa 9% da população adulta", cor: "azul" },
                { id: 2, icone: "<i class='fi fi-rr-heart'></i> ", texto: "Hipertensos no Brasil", valor: "38 milhões", detalhe: "Principal fator de risco para AVC", cor: "verde" },
                { id: 3, icone: "<i class='fi fi-rr-bug'></i> ", texto: "Casos de Dengue em 2025", valor: "1,6 milhão", detalhe: "Aumento de 200% em relação a 2024", cor: "laranja" },
                { id: 4, icone: "<i class='fi fi-rr-brain'></i> ", texto: "População com Depressão", valor: "12%", detalhe: "Cerca de 25 milhões de brasileiros", cor: "roxo" },
                { id: 5, icone: "<i class='fi fi-rr-lungs'></i> ", texto: "Mortes por Tuberculose/ano", valor: "70 mil", detalhe: "Doença curável com tratamento adequado", cor: "vermelho" },
                { id: 6, icone: "<i class='fi fi-rr-medicine'></i> ", texto: "Cobertura Vacinal Infantil", valor: "95%", detalhe: "Meta da OMS alcançada em 2025", cor: "ciano" }
            ];
            localStorage.setItem('admin_stats', JSON.stringify(stats));
        }
    }

    const container = document.getElementById('grid-stats-edit');
    if (!container) return;
    container.innerHTML = '';

    stats.forEach((stat, index) => {
        const div = document.createElement('div');
        div.className = 'form-group-stats-item';
        div.style = 'background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #ddd; display:grid; grid-template-columns:120px 1.2fr 1fr 1fr 1.5fr 60px 60px 80px auto; gap:10px; align-items:end; margin-bottom:10px;';

        const iconOptions = [
            { value: "<i class='fi fi-rr-chart-histogram'></i> ", label: "📊 Gráfico / Histograma" },
            { value: "<i class='fi fi-rr-syringe'></i> ", label: "💉 Seringa (Vacinação)" },
            { value: "<i class='fi fi-rr-heart'></i> ", label: "❤️ Coração (Cardio/Saúde)" },
            { value: "<i class='fi fi-rr-bug'></i> ", label: "🦟 Inseto (Vetor/Dengue)" },
            { value: "<i class='fi fi-rr-brain'></i> ", label: "🧠 Cérebro (Saúde Mental)" },
            { value: "<i class='fi fi-rr-lungs'></i> ", label: "🫁 Pulmões (Respiratório)" },
            { value: "<i class='fi fi-rr-medicine'></i> ", label: "💊 Remédio (Medicamentos)" },
            { value: "<i class='fi fi-rr-hospital'></i> ", label: "🏥 Hospital (Estrutura)" },
            { value: "<i class='fi fi-rr-stethoscope'></i> ", label: "🩺 Estetoscópio (Consultas)" },
            { value: "<i class='fi fi-rr-microscope'></i> ", label: "🔬 Microscópio (Análises)" },
            { value: "<i class='fi fi-rr-ambulance'></i> ", label: "🚑 Ambulância (Urgência)" },
            { value: "<i class='fi fi-rr-drop'></i> ", label: "🩸 Gota de Sangue (Doação)" }
        ];
        const cleanIcon = (str) => str ? str.replace(/"/g, "'").trim() : '';
        const optionsHtml = iconOptions.map(op => {
            const sel = cleanIcon(stat.icone) === cleanIcon(op.value) ? 'selected' : '';
            const valEscaped = op.value.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            return `<option value="${valEscaped}" ${sel}>${op.label}</option>`;
        }).join('');

        div.innerHTML = `
            <div><label style="font-size:0.75rem; font-weight:bold;">Ícone</label><select id="stat-icon-${index}" onchange="atualizarPreviewStat(${index})" style="padding:5px; width:100%;">${optionsHtml}</select></div>
            <div><label style="font-size:0.75rem; font-weight:bold;">Título</label><input type="text" id="stat-texto-${index}" oninput="atualizarPreviewStat(${index})" value="${stat.texto}" style="width:100%; padding:5px;"></div>
            <div><label style="font-size:0.75rem; font-weight:bold;">Valor (Geral)</label><input type="text" id="stat-valor-${index}" oninput="atualizarPreviewStat(${index})" value="${stat.valor}" style="width:100%; padding:5px; font-weight:bold; color:#007bff;" title="Valor exibido no Card (Página Inicial)"></div>
            <div><label style="font-size:0.75rem; font-weight:bold;">Valor (Mapa)</label><input type="text" id="stat-valor-mapa-${index}" value="${stat.valor_mapa || stat.valor || ''}" style="width:100%; padding:5px; font-weight:bold; color:#28a745;" title="Valor exibido apenas no marcador do Mapa"></div>
            <div><label style="font-size:0.75rem; font-weight:bold;">Detalhe (Opcional)</label><input type="text" id="stat-detalhe-${index}" oninput="atualizarPreviewStat(${index})" value="${stat.detalhe || ''}" style="width:100%; padding:5px; font-size:0.8rem;"></div>
            <div><label style="font-size:0.75rem; font-weight:bold;">Lat</label><input type="text" id="stat-lat-${index}" value="${stat.lat || ''}" placeholder="-23.5" style="width:100%; padding:5px; font-size:0.8rem;"></div>
            <div><label style="font-size:0.75rem; font-weight:bold;">Lon</label><input type="text" id="stat-lon-${index}" value="${stat.lon || ''}" placeholder="-46.6" style="width:100%; padding:5px; font-size:0.8rem;"></div>
            <div><label style="font-size:0.75rem; font-weight:bold;">Cor</label>
                <select id="stat-cor-${index}" onchange="atualizarPreviewStat(${index})" style="padding:5px; width:100%;">
                    <option value="azul" ${stat.cor === 'azul' ? 'selected' : ''}>Azul</option>
                    <option value="verde" ${stat.cor === 'verde' ? 'selected' : ''}>Verde</option>
                    <option value="laranja" ${stat.cor === 'laranja' ? 'selected' : ''}>Laranja</option>
                    <option value="roxo" ${stat.cor === 'roxo' ? 'selected' : ''}>Roxo</option>
                    <option value="vermelho" ${stat.cor === 'vermelho' ? 'selected' : ''}>Vermelho</option>
                    <option value="ciano" ${stat.cor === 'ciano' ? 'selected' : ''}>Ciano</option>
                </select>
            </div>
            <div style="padding-bottom:1px; display:flex; gap:5px;">
                <button class="btn-edit" onclick="selecionarParaMapa(${index})" id="btn-map-${index}" style="height:35px; background:#0056AC; color:white; border:none; border-radius:4px; cursor:pointer; width:35px; display:inline-flex; align-items:center; justify-content:center;" title="Selecionar para editar no mapa"><i class="fi fi-rr-map-marker"></i></button>
                <button class="btn-delete" onclick="deletarEstatistica(${index})" style="height:35px; width:35px; background:#fee2e2; color:#b91c1c; border:1px solid rgba(185,28,28,0.15); border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="Deletar estatística"><i class="fi fi-rr-trash"></i></button>
            </div>
            <div id="stat-preview-${index}" style="grid-column: 1 / -1; margin-top:10px; display:flex; justify-content:center; background:#eee; padding:10px; border-radius:8px;">
                <!-- Card Preview Injected Here -->
            </div>
        `;
        container.appendChild(div);
        atualizarPreviewStat(index);
    });
}

function atualizarPreviewStat(index) {
    const previewDiv = document.getElementById(`stat-preview-${index}`);
    if (!previewDiv) return;

    const icone = document.getElementById(`stat-icon-${index}`).value;
    const texto = document.getElementById(`stat-texto-${index}`).value;
    const valor = document.getElementById(`stat-valor-${index}`).value;
    const detalhe = document.getElementById(`stat-detalhe-${index}`).value;
    const cor = document.getElementById(`stat-cor-${index}`).value;

    // Reset agressivo para o preview não herdar !important do responsive.css
    previewDiv.innerHTML = `
        <style>
            #card-prev-${index} {
                width: 260px !important;
                height: 230px !important;
                min-height: 230px !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                text-align: center !important;
                padding: 20px !important;
                margin: 0 auto !important;
                overflow: hidden !important;
                transform: none !important;
                position: relative !important;
                border-radius: 20px !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2) !important;
                cursor: default !important;
                line-height: normal !important;
            }
            #card-prev-${index} .stat-icon-wrapper {
                margin: 0 auto 10px auto !important;
                transform: none !important;
                display: ${icone && icone.length > 2 ? 'flex' : 'none'} !important;
                width: 50px !important;
                height: 50px !important;
                background: rgba(255,255,255,0.2) !important;
                border-radius: 12px !important;
                justify-content: center !important;
                align-items: center !important;
            }
            #card-prev-${index} .stat-info {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                transform: none !important;
                width: 100% !important;
            }
            #card-prev-${index} .stat-numero {
                font-size: 1.8rem !important;
                font-weight: 900 !important;
                color: white !important;
                margin: 0 !important;
                padding: 0 !important;
                line-height: 1.1 !important;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            }
            #card-prev-${index} .stat-label {
                font-size: 1rem !important;
                font-weight: 800 !important;
                color: white !important;
                text-transform: uppercase !important;
                margin: 5px 0 !important;
                letter-spacing: 0.5px !important;
            }
            #card-prev-${index} .stat-detalhe {
                font-size: 0.8rem !important;
                color: rgba(255,255,255,0.85) !important;
                margin: 0 !important;
            }
        </style>
        <div id="card-prev-${index}" class="stat-card ${cor}">
            <div class="stat-icon-wrapper"><div class="stat-icon">${icone}</div></div>
            <div class="stat-info">
                <div class="stat-numero">${valor}</div>
                <div class="stat-label">${texto}</div>
                <div class="stat-detalhe">${detalhe}</div>
            </div>
        </div>
    `;
}

window.salvarStats = async function () {
    const container = document.getElementById('grid-stats-edit');
    const rows = container.children;
    let stats = [];

    Array.from(rows).forEach((row, index) => {
        stats.push({
            icone: document.getElementById(`stat-icon-${index}`).value,
            texto: document.getElementById(`stat-texto-${index}`).value,
            valor: document.getElementById(`stat-valor-${index}`).value,
            valor_mapa: document.getElementById(`stat-valor-mapa-${index}`).value,
            detalhe: document.getElementById(`stat-detalhe-${index}`).value,
            lat: parseFloat(document.getElementById(`stat-lat-${index}`).value) || 0,
            lon: parseFloat(document.getElementById(`stat-lon-${index}`).value) || 0,
            cor: document.getElementById(`stat-cor-${index}`).value
        });
    });

    if (typeof API !== 'undefined') {
        try {
            showHealthLoader('Sincronizando estatísticas com o servidor...');
            const resp = await API.salvarStats(stats);
            hideHealthLoader();
            
            if (resp && resp.sucesso) {
                Swal.fire({ 
                    icon: 'success', 
                    title: 'Sincronizado', 
                    html: '<i class="fi fi-rr-check-circle"></i> Estatísticas salvas no banco de dados!',
                    timer: 1500,
                    showConfirmButton: false
                });
                await carregarStatsEditor();
                return;
            } else if (resp && resp.erro) {
                Swal.fire({ icon: 'error', title: 'Erro na API', text: 'O servidor retornou um erro: ' + resp.erro });
                return;
            }
        } catch (err) {
            hideHealthLoader();
            console.error("Erro na requisição de stats:", err);
        }
    }

    localStorage.setItem('admin_stats', JSON.stringify(stats));
    Swal.fire({ 
        icon: 'info', 
        title: 'Modo Offline', 
        html: '<i class="fi fi-rr-info"></i>  Não foi possível conectar ao servidor. Estatísticas salvas localmente no navegador!' 
    });
}

// --- FUNÇÕES DE MAPA ADMINISTRATIVO ---

function selecionarParaMapa(index) {
    // Remove destaque anterior
    document.querySelectorAll('.form-group-stats-item').forEach(el => el.style.background = '#f8f9fa');
    document.querySelectorAll('.btn-edit[id^="btn-map-"]').forEach(btn => btn.style.background = '#0056AC');

    idxEstatisticaSelecionada = index;
    
    // Destaca a linha selecionada
    const container = document.getElementById('grid-stats-edit');
    if (container && container.children[index]) {
        container.children[index].style.background = '#e7f3ff';
        const btn = document.getElementById(`btn-map-${index}`);
        if (btn) btn.style.background = '#28a745';
    }

    const status = document.getElementById('map-edit-status');
    if (status) {
        const texto = document.getElementById(`stat-texto-${index}`).value || 'Nova Estatística';
        status.textContent = `Editando: ${texto}`;
        status.style.background = '#d4edda';
        status.style.color = '#155724';
    }
}

function initAdminMap() {
    if (!document.getElementById('adminChartDiv')) return;
    if (typeof am4core === 'undefined' || typeof am4maps === 'undefined') return;

    if (adminStatsMapInstance) {
        adminStatsMapInstance.dispose();
    }

    am4core.useTheme(am4themes_animated);
    let chart = am4core.create("adminChartDiv", am4maps.MapChart);
    adminStatsMapInstance = chart;

    chart.geodata = am4geodata_brazilLow;
    chart.projection = new am4maps.projections.Miller();

    let polygonSeries = chart.series.push(new am4maps.MapPolygonSeries());
    polygonSeries.useGeodata = true;
    polygonSeries.mapPolygons.template.fill = am4core.color("#e9ecef");
    polygonSeries.mapPolygons.template.stroke = am4core.color("#adb5bd");
    polygonSeries.mapPolygons.template.strokeWidth = 0.5;

    // --- ADICIONAR LABELS DOS ESTADOS (UF) ---
    let labelSeries = chart.series.push(new am4maps.MapImageSeries());
    let labelTemplate = labelSeries.mapImages.template.createChild(am4core.Label);
    labelTemplate.horizontalCenter = "middle";
    labelTemplate.verticalCenter = "middle";
    labelTemplate.fontSize = 10;
    labelTemplate.fill = am4core.color("#495057");
    labelTemplate.fontWeight = "bold";
    labelTemplate.nonScaling = true;
    labelTemplate.interactionsEnabled = false;

    polygonSeries.events.on("datavalidated", function() {
        polygonSeries.mapPolygons.each(function(polygon) {
            let label = labelSeries.mapImages.create();
            let stateId = polygon.dataItem.dataContext.id.replace("BR-", "");
            label.latitude = polygon.visualLatitude;
            label.longitude = polygon.visualLongitude;
            label.children.getIndex(0).text = stateId;
        });
    });

    // Hover effect
    let hs = polygonSeries.mapPolygons.template.states.create("hover");
    hs.properties.fill = am4core.color("#dee2e6");

    // Click on Background/Map to capture coordinates
    chart.seriesContainer.events.on("hit", function(ev) {
        if (idxEstatisticaSelecionada === null) {
            Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Selecione primeiro qual estatística deseja posicionar clicando no ícone de marcador (📍) ao lado dela.' });
            return;
        }

        let coords = chart.svgPointToGeo(ev.svgPoint);
        const lat = coords.latitude.toFixed(4);
        const lon = coords.longitude.toFixed(4);

        // Atualizar inputs
        const latInput = document.getElementById(`stat-lat-${idxEstatisticaSelecionada}`);
        const lonInput = document.getElementById(`stat-lon-${idxEstatisticaSelecionada}`);
        
        if (latInput && lonInput) {
            latInput.value = lat;
            lonInput.value = lon;
            
            // Visual feedback on the dot
            renderAdminMarkers();
            
            // Log local
            console.log(`Coordenada capturada para índice ${idxEstatisticaSelecionada}: Lat ${lat}, Lon ${lon}`);
        }
    });

    renderAdminMarkers();
}

function renderAdminMarkers() {
    if (!adminStatsMapInstance) return;

    // Remover series de marcadores antiga se existir
    adminStatsMapInstance.series.each(s => {
        if (s instanceof am4maps.MapImageSeries && s.id === "markers") {
            adminStatsMapInstance.series.removeIndex(adminStatsMapInstance.series.indexOf(s));
        }
    });

    let imageSeries = adminStatsMapInstance.series.push(new am4maps.MapImageSeries());
    imageSeries.id = "markers";
    let imageTemplate = imageSeries.mapImages.template;
    imageTemplate.propertyFields.longitude = "longitude";
    imageTemplate.propertyFields.latitude = "latitude";
    imageTemplate.nonScaling = true;

    let marker = imageTemplate.createChild(am4core.Circle);
    marker.radius = 6;
    marker.fill = am4core.color("#0056AC");
    marker.stroke = am4core.color("#ffffff");
    marker.strokeWidth = 2;

    // Pegar dados atuais dos inputs para renderizar "em tempo real" no mapa admin
    const container = document.getElementById('grid-stats-edit');
    if (!container) return;
    
    let data = [];
    const rows = container.children;
    Array.from(rows).forEach((row, index) => {
        const latStr = document.getElementById(`stat-lat-${index}`).value;
        const lonStr = document.getElementById(`stat-lon-${index}`).value;
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        if (!isNaN(lat) && !isNaN(lon) && latStr.trim() !== '' && lonStr.trim() !== '') {
            data.push({
                latitude: lat,
                longitude: lon,
                title: document.getElementById(`stat-texto-${index}`).value
            });
        }
    });

    imageSeries.data = data;
}

// --- CARROSSEL ---
// Cache global para evitar quebra de aspas nos botões do carrossel
window._adminCarouselCache = { slides: [], noticias: [] };

async function carregarCarrosselEditor() {
    const lista = document.getElementById('lista-carrossel');
    if (!lista) return;

    let slides = [];
    let noticias = [];
    
    if (typeof API !== 'undefined') {
        try {
            const respC = await API.carrossel();
            if (respC && !respC.erro) slides = respC;
            const respN = await API.noticias();
            if (respN && !respN.erro) noticias = respN;
        } catch (e) {
            console.error("Erro ao carregar dados:", e);
        }
    }

    if ((!slides || slides.length === 0) && (!noticias || noticias.length === 0)) {
        slides = JSON.parse(localStorage.getItem('admin_carrossel') || '[]');
        noticias = JSON.parse(localStorage.getItem('admin_noticias') || '[]');
    }

    // Salva no cache global
    window._adminCarouselCache.slides = slides;
    window._adminCarouselCache.noticias = noticias;

    const noticiasNoCarrossel = noticias.filter(n => parseInt(n.destaque_carrossel) === 1 || n.destaque_carrossel === true);
    lista.innerHTML = '';

    // 1. Renderizar os Slides Fixos
    slides.forEach((slide, idx) => {
        const item = document.createElement('div');
        item.className = 'admin-item';
        item.innerHTML = `
            <div class="item-info" style="display: flex; align-items: center; gap: 15px;">
                <img src="${slide.imagem || slide.img || 'https://via.placeholder.com/80x50'}" style="width: 80px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;">
                <div>
                    <h4 style="margin: 0;">${slide.titulo || 'Slide'}</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: #555;">${slide.subtitulo || ''}</p>
                    <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: #d4edda; color: #155724; border: 1px solid currentColor; display: inline-flex; align-items: center; gap: 4px;"><i class="fi fi-rr-check-circle"></i> Slide Ativo</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-edit" onclick="window.abrirModalCarrossel(window._adminCarouselCache.slides[${idx}])"><i class="fi fi-rr-edit"></i> Editar</button>
                <button class="btn-delete" onclick="deletarSlide('${slide.id}')"><i class="fi fi-rr-trash"></i> Excluir</button>
            </div>
        `;
        lista.appendChild(item);
    });

    if (slides.length === 0) {
        lista.innerHTML = '<div style="text-align:center; padding: 20px; color: #666;">Nenhum item ativo no carrossel.</div>';
    }
}

// Função auxiliar para mudar de aba e abrir a notícia
window.irParaNoticia = function(index) {
    const btnNoticia = document.querySelector('[data-section="noticias"]');
    if (btnNoticia) {
        btnNoticia.click();
        setTimeout(() => {
            if (window._adminCarouselCache && window._adminCarouselCache.noticias[index]) {
                abrirModalNoticia(window._adminCarouselCache.noticias[index]);
            }
        }, 300);
    }
}

async function deletarSlide(id) {
    console.log('Solicitando exclusão do slide:', id);
    if (!confirm('Remover imagem do carrossel?')) return;

    showHealthLoader('Removendo slide...');

    try {
        if (typeof API !== 'undefined') {
            const resp = await API.deletarSlide(id);
            if (resp && resp.sucesso) {
                console.log('Slide removido do servidor');
            }
        }

        // Remover do cache local e atualizar UI
        let slides = JSON.parse(localStorage.getItem('admin_carrossel') || '[]');
        slides = slides.filter(s => String(s.id) !== String(id));
        localStorage.setItem('admin_carrossel', JSON.stringify(slides));
        
        await carregarCarrosselEditor();
        Swal.fire({ icon: 'success', title: 'Removido', text: 'Slide removido com sucesso do carrossel!' });
    } catch (err) {
        console.error('Erro ao deletar slide:', err);
    } finally {
        hideHealthLoader();
    }
}

window.abrirModalCarrossel = function (slide = null) {
    const modal = document.getElementById('modal-admin');
    const form = document.getElementById('form-admin');
    document.getElementById('modal-title').textContent = slide ? 'Editar Slide' : 'Novo Slide';

    form.innerHTML = `
        <input type="hidden" id="tipo-form" value="carrossel">
        ${slide ? `<input type="hidden" id="form-slide-id" value="${slide.id}">` : ''}
        <div style="margin-bottom:10px"><label>Título</label><input type="text" id="form-img-alt" value="${slide ? (slide.titulo || slide.alt || '') : ''}" required style="width:100%; padding:8px;"></div>
        <div style="margin-bottom:10px"><label>Subtítulo</label><input type="text" id="form-img-sub" value="${slide ? (slide.subtitulo || '') : ''}" style="width:100%; padding:8px;"></div>
        <div style="margin-bottom:10px"><label>Texto Base</label><textarea id="form-img-txt" style="width:100%; padding:8px; height:60px;">${slide ? (slide.texto || '') : ''}</textarea></div>
        <div style="margin-bottom:10px; border:1px solid #ccc; padding:10px; border-radius:5px; background:#fafafa;">
             <label style="display:block; margin-bottom:5px;">Imagem do Slide</label>
             <input type="file" id="form-slide-file" accept="image/*" style="width:100%; padding:8px; margin-bottom:10px; background:white; border:1px solid #ddd; cursor:pointer;">
             <div style="text-align:center; font-size:0.85rem; color:#666; margin-bottom:5px;">OU informe uma URL:</div>
             <input type="text" id="form-img-url" value="${slide ? (slide.imagem || slide.img) : ''}" placeholder="https://..." style="width:100%; padding:8px;">
        </div>
        <div style="margin-bottom:10px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div><label>Link do Slide</label><input type="text" id="form-img-link" value="${slide ? (slide.link || '') : ''}" placeholder="Ex: /campanhas" style="width:100%; padding:8px;"></div>
            <div><label>Ordem (ex: 1)</label><input type="number" id="form-img-ordem" value="${slide ? (slide.ordem || 0) : 0}" style="width:100%; padding:8px;"></div>
        </div>
        <div style="margin-bottom:10px; display:flex; gap:10px; align-items:center;">
            <input type="checkbox" id="form-img-ativo" ${!slide || parseInt(slide.ativo) || parseInt(slide.status) ? 'checked' : ''}>
            <label for="form-img-ativo" style="margin:0;">Ativar slide na página inicial</label>
        </div>
        <button type="submit" style="background:var(--admin-success); color:white; border:none; padding:10px; width:100%; font-weight:bold; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;"><i class="fi fi-rr-disk"></i> ${slide ? 'Salvar Alterações' : 'Adicionar Slide'}</button>
    `;
    modal.style.display = 'flex';
}

// --- MODAL & FORM SUBMIT ---
window.fecharModalAdmin = function () {
    document.getElementById('modal-admin').style.display = 'none';
}

window.salvarDadosAdmin = async function (e) {
    e.preventDefault();
    const tipo = document.getElementById('tipo-form').value;

    if (tipo === 'noticia') {
        const idNoticia = document.getElementById('form-noticia-id') ? document.getElementById('form-noticia-id').value : null;
        const titulo = document.getElementById('form-titulo').value;
        const resumo = document.getElementById('form-resumo').value;
        const conteudo = document.getElementById('form-texto').value;
        let imagem = document.getElementById('form-img') ? document.getElementById('form-img').value.trim() : '';
        const fileInput = document.getElementById('form-img-file');

        if (fileInput && fileInput.files && fileInput.files[0]) {
            if (typeof showHealthLoader === 'function') showHealthLoader('Processando imagem');
            try {
                imagem = await converteParaBase64(fileInput.files[0]);
            } catch (e) { console.error('Erro ao ler imagem', e); }
            if (typeof hideHealthLoader === 'function') hideHealthLoader();
        }

        if (!imagem) imagem = 'https://via.placeholder.com/300x200?text=Saude';

        const categoria = document.getElementById('form-categoria').value;
        const status = document.getElementById('form-status').value;
        const destaque_carrossel = document.getElementById('form-destaque').checked ? 1 : 0;

        if (typeof API !== 'undefined') {
            let resp;
            const payload = { titulo, resumo, conteudo, imagem, categoria, status, destaque_carrossel };
            if (idNoticia) {
                resp = await API.editarNoticia(idNoticia, payload);
            } else {
                resp = await API.criarNoticia(payload);
            }
            if (resp && resp.sucesso) {
                Swal.fire({ icon: 'success', title: 'Sucesso', text: idNoticia ? 'Notícia atualizada com sucesso!' : 'Notícia publicada com sucesso!' });
                await carregarNoticias();
                fecharModalAdmin();
                return;
            } else if (resp && resp.erro) {
                Swal.fire({ icon: 'error', title: 'Erro na API', text: 'Erro ao salvar notícia: ' + resp.erro });
                return;
            }
            console.warn("Backend offline. Usando fallback local para Notícias...");
        }

        // Fallback Local
        let listaN = JSON.parse(localStorage.getItem('admin_noticias') || '[]');
        if (idNoticia) {
            const i = listaN.findIndex(n => n.id == idNoticia);
            if (i !== -1) listaN[i] = { ...listaN[i], titulo, resumo, conteudo, imagem, categoria, status, destaque_carrossel };
        } else {
            listaN.unshift({ id: Date.now(), titulo, resumo, conteudo, imagem, categoria, status, destaque_carrossel, data: new Date().toLocaleDateString() });
        }
        localStorage.setItem('admin_noticias', JSON.stringify(listaN));
        Swal.fire({ icon: 'info', title: 'Modo Offline', text: idNoticia ? 'Notícia atualizada localmente!' : 'Notícia publicada localmente!' });
        carregarNoticias();

    } else if (tipo === 'carrossel') {
        const idSlide = document.getElementById('form-slide-id') ? document.getElementById('form-slide-id').value : null;
        const titulo = document.getElementById('form-img-alt').value;
        const subtitulo = document.getElementById('form-img-sub').value;
        const texto = document.getElementById('form-img-txt').value;
        let imagem = document.getElementById('form-img-url') ? document.getElementById('form-img-url').value.trim() : '';
        const fileInput = document.getElementById('form-slide-file');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            if (typeof showHealthLoader === 'function') showHealthLoader('Processando imagem');
            try {
                imagem = await converteParaBase64(fileInput.files[0]);
            } catch (e) { console.error('Erro ao ler imagem', e); }
            if (typeof hideHealthLoader === 'function') hideHealthLoader();
        }

        if (!imagem) imagem = 'https://via.placeholder.com/300x200?text=Saude';

        const link = document.getElementById('form-img-link').value;
        const ordem = parseInt(document.getElementById('form-img-ordem').value) || 0;
        const ativo = document.getElementById('form-img-ativo').checked ? 1 : 0;

        if (typeof API !== 'undefined') {
            let resp;
            const payload = { titulo, subtitulo, texto, imagem, link, ativo, ordem, status: ativo };
            if (idSlide) {
                resp = await API.editarSlide(idSlide, payload);
            } else {
                resp = await API.criarSlide(payload);
            }
            if (resp && resp.sucesso) {
                Swal.fire({ icon: 'success', title: 'Sucesso', text: idSlide ? 'Slide atualizado!' : 'Slide adicionado!' });
                await carregarCarrosselEditor();
                fecharModalAdmin();
                return;
            } else if (resp && resp.erro) {
                Swal.fire({ icon: 'error', title: 'Erro na API', text: 'Erro ao salvar slide: ' + resp.erro });
                return;
            }
            console.warn("Backend offline. Usando fallback local para Carrossel...");
        }

        // Fallback Local
        let listaC = JSON.parse(localStorage.getItem('admin_carrossel') || '[]');
        if (idSlide) {
            const i = listaC.findIndex(s => s.id == idSlide);
            if (i !== -1) listaC[i] = { ...listaC[i], titulo, subtitulo, texto, imagem, link, ativo, ordem, status: ativo };
        } else {
            listaC.push({ id: Date.now(), titulo, subtitulo, texto, imagem, link, ativo, ordem, status: ativo });
        }
        localStorage.setItem('admin_carrossel', JSON.stringify(listaC));
        Swal.fire({ icon: 'info', title: 'Modo Offline', text: idSlide ? 'Slide atualizado localmente!' : 'Slide adicionado localmente!' });
        carregarCarrosselEditor();
        fecharModalAdmin();

    } else if (tipo === 'campanha') {
        const idCampanha = document.getElementById('form-camp-id') ? document.getElementById('form-camp-id').value : null;
        const titulo = document.getElementById('form-camp-titulo').value;
        const descricao = document.getElementById('form-camp-descricao').value;
        let imagem = document.getElementById('form-camp-img') ? document.getElementById('form-camp-img').value.trim() : '';

        const fileInput = document.getElementById('form-camp-file');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            if (typeof showHealthLoader === 'function') showHealthLoader('Processando imagem');
            try {
                imagem = await converteParaBase64(fileInput.files[0]);
            } catch (e) { console.error('Erro ao ler imagem', e); }
            if (typeof hideHealthLoader === 'function') hideHealthLoader();
        }

        if (!imagem) imagem = 'https://via.placeholder.com/300x200?text=Saude';

        const data_inicio = document.getElementById('form-camp-inicio').value;
        const data_fim = document.getElementById('form-camp-fim').value;
        const status = document.getElementById('form-camp-status').value;
        
        const categoria = document.getElementById('form-camp-categoria').value;
        const icone = document.getElementById('form-camp-icone').value;
        const resumo = document.getElementById('form-camp-resumo').value;
        const publico_alvo = document.getElementById('form-camp-publico').value;
        const local = document.getElementById('form-camp-local').value;
        const documentos = document.getElementById('form-camp-documentos').value;

        if (typeof API !== 'undefined') {
            let resp;
            const payload = { 
                titulo, 
                descricao, 
                imagem, 
                data_inicio, 
                data_fim, 
                status, 
                categoria, 
                icone, 
                resumo, 
                publico_alvo, 
                local, 
                documentos 
            };
            if (idCampanha) {
                resp = await API.editarCampanha(idCampanha, payload);
            } else {
                resp = await API.criarCampanha(payload);
            }
            if (resp && resp.sucesso) {
                Swal.fire({ icon: 'success', title: 'Sucesso', text: idCampanha ? 'Campanha atualizada!' : 'Campanha criada!' });
                await carregarCampanhas();
                fecharModalAdmin();
                return;
            } else if (resp && resp.erro) {
                Swal.fire({ icon: 'error', title: 'Erro na API', text: 'Erro ao salvar campanha: ' + resp.erro });
                return;
            }
            console.warn("Backend offline. Usando fallback local para Campanhas...");
        }

        // Fallback Local
        let listaCamp = JSON.parse(localStorage.getItem('admin_campanhas') || '[]');
        const campDataObj = { 
            titulo, 
            descricao, 
            imagem, 
            data_inicio, 
            data_fim, 
            status, 
            categoria, 
            icone, 
            resumo, 
            publico_alvo, 
            publicoAlvo: publico_alvo, 
            local, 
            documentos 
        };
        if (idCampanha) {
            const i = listaCamp.findIndex(c => c.id == idCampanha);
            if (i !== -1) listaCamp[i] = { ...listaCamp[i], ...campDataObj };
        } else {
            listaCamp.unshift({ id: Date.now(), ...campDataObj });
        }
        localStorage.setItem('admin_campanhas', JSON.stringify(listaCamp));
        Swal.fire({ icon: 'info', title: 'Modo Offline', text: idCampanha ? 'Campanha atualizada localmente!' : 'Campanha criada localmente!' });
        carregarCampanhas();

    } else if (tipo === 'notificacao') {
        const usuario_id = document.getElementById('form-notif-usuario').value;
        const mensagem = document.getElementById('form-notif-msg').value;

        if (typeof API !== 'undefined') {
            const resp = await API.enviarNotificacaoAdmin({ usuario_id, mensagem });
            if (resp && resp.sucesso) {
                Swal.fire({ icon: 'success', title: 'Sucesso', html: '<i class=\"fi fi-rr-check-circle\"></i>  Notificação enviada com sucesso!' });
                await carregarNotificacoesAdmin();
                fecharModalAdmin();
                return;
            }
        }
        alert('Erro ao enviar notificação.');
    }

    fecharModalAdmin();
}

// --- COMENT�?RIOS E CAMPANHAS ---
async function carregarComentarios() {
    const lista = document.getElementById('lista-comentarios');
    if (!lista) return;

    if (typeof API !== 'undefined') {
        const comentarios = await API.comentariosAdmin();
        if (comentarios && !comentarios.erro) {
            lista.innerHTML = comentarios.map(c => `
                <div class="admin-item">
                    <div style="flex:1;">
                        <h4 style="margin:0 0 5px 0;">De: ${c.nome} ${c.noticia_titulo ? `(Notícia: ${c.noticia_titulo})` : ''}</h4>
                        <p style="margin:0 0 5px 0; font-size:0.9rem; color:#444;">"${c.mensagem || c.texto}"</p>
                        <span style="font-size: 0.8rem; padding: 2px 6px; border-radius: 4px; background: ${c.status === 'aprovado' ? '#d4edda' : '#fff3cd'}; color: ${c.status === 'aprovado' ? '#155724' : '#856404'};">${c.status.toUpperCase()}</span>
                    </div>
                    <div class="item-actions">
                        ${c.status !== 'aprovado' ? `<button class="btn-edit" style="background:#28a745; color:white; display:inline-flex; align-items:center; gap:6px;" onclick="aprovarComentario(${c.id})"><i class="fi fi-rr-check"></i> Aprovar</button>` : ''}
                        <button class="btn-delete" onclick="rejeitarComentario(${c.id})"><i class="fi fi-rr-trash"></i> Excluir</button>
                    </div>
                </div>
            `).join('');
            if (comentarios.length === 0) lista.innerHTML = '<p style="padding:15px; text-align:center; color:#666;">Nenhum comentário.</p>';
        }
    }
}

async function aprovarComentario(id) {
    if (typeof API !== 'undefined') {
        await API.aprovarComentario(id, 'aprovado');
        carregarComentarios();
    }
}

async function rejeitarComentario(id) {
    if (!confirm('Deletar comentário permanentemente?')) return;
    if (typeof API !== 'undefined') {
        await API.deletarComentario(id);
        carregarComentarios();
    }
}

async function carregarCampanhas() {
    const lista = document.getElementById('lista-campanhas');
    if (!lista) return;

    let campanhas = [];
    if (typeof API !== 'undefined') {
        campanhas = await API.campanhas();
    }

    const sementeCampanhas = [
        {
            id: 10,
            titulo: "Vacinação Febre Amarela 2026",
            categoria: "destaque",
            status: "ativo",
            data_inicio: "2026-01-01",
            data_fim: "2026-12-31",
            icone: "<i class='fi fi-rr-syringe'></i>",
            imagem: "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&q=80&w=600",
            resumo: "Proteja-se e proteja sua família contra a febre amarela.",
            descricao: "Proteja-se e proteja sua família! A vacina contra febre amarela está disponível em todas as UBS de Cascavel.",
            publico_alvo: "População em geral a partir de 9 meses",
            local: "Todas as Unidades Básicas de Saúde (UBS) de Cascavel",
            documentos: "Cartão SUS, RG e CPF"
        },
        {
            id: 1,
            titulo: "Outubro Rosa",
            categoria: "prevencao",
            status: "ativo",
            data_inicio: "2026-10-01",
            data_fim: "2026-10-31",
            icone: "<i class='fi fi-rr-stethoscope'></i>",
            imagem: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=600",
            resumo: "Campanha de prevenção ao câncer de mama.",
            descricao: "O Outubro Rosa é um movimento internacional de conscientização para o controle do câncer de mama. O objetivo é compartilhar informações e promover a conscientização sobre a doença; proporcionar maior acesso aos serviços de diagnóstico e de tratamento e contribuir para a redução da moralidade.",
            publico_alvo: "Mulheres a partir de 40 anos",
            local: "Todas as Unidades Básicas de Saúde (UBS)",
            documentos: "Cartão SUS, RG e CPF"
        },
        {
            id: 2,
            titulo: "Novembro Azul",
            categoria: "prevencao",
            status: "aguardando",
            data_inicio: "2026-11-01",
            data_fim: "2026-11-30",
            icone: "💙",
            imagem: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=600",
            resumo: "Prevenção ao câncer de próstata.",
            descricao: "O Novembro Azul reforça a importância da prevenção e do diagnóstico precoce do câncer de próstata. A doença é o segundo tipo de câncer mais comum entre os homens brasileiros. As maiores vítimas são homens a partir de 50 anos.",
            publico_alvo: "Homens a partir de 45 anos",
            local: "Clínicas da Família e UBS",
            documentos: "Documento com foto e Cartão SUS"
        },
        {
            id: 3,
            titulo: "Saúde Bucal nas Escolas",
            categoria: "infantil",
            status: "ativo",
            data_inicio: "2026-02-15",
            data_fim: "2026-12-15",
            icone: "🦷",
            imagem: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=600",
            resumo: "Atendimento odontológico preventivo para estudantes.",
            descricao: "Programa que visa promover a saúde bucal no ambiente escolar, com palestras educativas, escovação supervisionada e aplicação tópica de flúor.",
            publico_alvo: "Crianças e adolescentes da rede pública",
            local: "Escolas Municipais e Estaduais",
            documentos: "Autorização dos pais"
        },
        {
            id: 4,
            titulo: "Hipertensão e Diabetes",
            categoria: "cronicos",
            status: "ativo",
            data_inicio: "2026-01-01",
            data_fim: "2026-12-31",
            icone: "<i class='fi fi-rr-heart'></i>",
            imagem: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=600",
            resumo: "Triagem e acompanhamento contínuo.",
            descricao: "Acompanhamento mensal para portadores de hipertensão e diabetes, com entrega de medicação gratuita e verificação de pressão arterial e glicemia.",
            publico_alvo: "Portadores de doenças crônicas",
            local: "Farmácias Popular e UBS",
            documentos: "Receita médica atualizada e Cartão SUS"
        },
        {
            id: 5,
            titulo: "Vacinação Infantil",
            categoria: "vacinacao",
            status: "ativo",
            data_inicio: "2026-01-01",
            data_fim: "2026-12-31",
            icone: "🧒",
            imagem: "https://images.unsplash.com/photo-1609188076864-c35269136b99?auto=format&fit=crop&q=80&w=600",
            resumo: "Atualização da caderneta de vacinação.",
            descricao: "Manter a vacinação em dia é fundamental para proteger as crianças contra diversas doenças graves. Traga a caderneta de vacinação para conferência.",
            publico_alvo: "Crianças de 0 a 5 anos",
            local: "Salas de Vacinação das UBS",
            documentos: "Caderneta de Vacinação"
        },
        {
            id: 6,
            titulo: "Janeiro Branco",
            categoria: "mental",
            status: "encerrado",
            data_inicio: "2026-01-01",
            data_fim: "2026-01-31",
            icone: "<i class='fi fi-rr-brain'></i>",
            imagem: "https://images.unsplash.com/photo-1518072718539-7c4c917f8d5b?auto=format&fit=crop&q=80&w=600",
            resumo: "Conscientização sobre saúde mental.",
            descricao: "O Janeiro Branco é uma campanha dedicada a convidar as pessoas a pensarem sobre suas vidas, o sentido e o propósito das suas existências, a qualidade dos seus relacionamentos e o quanto elas conhecem sobre si mesmas, suas emoções, seus pensamentos e seus comportamentos.",
            publico_alvo: "População em geral",
            local: "CAPS e Centros de Convivência",
            documentos: "Nenhum documento necessário"
        }
    ];

    // Tratamento Fallback Local para evitar Tela em Branco Offline
    if (!campanhas || campanhas.length === 0 || campanhas.erro) {
        if (!localStorage.getItem('admin_campanhas_v4_fix')) {
            localStorage.setItem('admin_campanhas', JSON.stringify(sementeCampanhas));
            localStorage.setItem('admin_campanhas_v4_fix', 'true');
        }

        campanhas = JSON.parse(localStorage.getItem('admin_campanhas') || '[]');
        if (campanhas.length === 0) {
            campanhas = sementeCampanhas;
            localStorage.setItem('admin_campanhas', JSON.stringify(campanhas));
        }
    }

    window._adminCampanhasCache = campanhas;

    if (campanhas && !campanhas.erro) {
        lista.innerHTML = campanhas.map((c, idx) => {
            const statusLower = String(c.status || '').toLowerCase();
            const isAtiva = statusLower === 'ativa' || statusLower === 'ativo' || c.status == 1;
            const isEmBreve = statusLower === 'aguardando' || statusLower === 'em breve';
            
            const badgeColor = isAtiva ? '#28a745' : (isEmBreve ? '#f39c12' : '#dc3545');
            const badgeText = isAtiva ? 'ATIVA' : (isEmBreve ? 'EM BREVE' : 'ENCERRADA');

            return `
                <div class="admin-item">
                    <div style="display:flex; gap:15px; flex:1; align-items:center;">
                        <img src="${c.imagem || 'https://via.placeholder.com/80x50?text=Campanha'}" style="width:80px; height:50px; object-fit:cover; border-radius:4px;" />
                        <div>
                            <h4 style="margin:0;">${c.titulo}</h4>
                            <p style="margin:0; font-size:0.85rem; color:#666;">Início: ${c.data_inicio || c.dataInicio || '---'} | Término: ${c.data_fim || c.dataFim || '---'}</p>
                            <span style="font-size:0.7rem; background:${badgeColor}; color:white; padding:2px 5px; border-radius:3px;">${badgeText}</span>
                            <span style="font-size:0.7rem; background:#17a2b8; color:white; padding:2px 5px; border-radius:3px; margin-left:5px;">${String(c.categoria || 'Geral').toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-edit btn-icon-only" onclick="window.abrirModalCampanhaIndex(${idx})"><i class="fi fi-rr-edit"></i></button>
                        <button class="btn-delete btn-icon-only" onclick="deletarCampanha(${c.id})"><i class="fi fi-rr-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');
        if (campanhas.length === 0) lista.innerHTML = '<p style="padding:15px; text-align:center; color:#666;">Nenhuma campanha ativa.</p>';
    }
}

window.abrirModalCampanhaIndex = function(index) {
    if (window._adminCampanhasCache && window._adminCampanhasCache[index]) {
        window.abrirModalCampanha(window._adminCampanhasCache[index]);
    }
};

window.abrirModalCampanha = function (camp = null) {
    const modal = document.getElementById('modal-admin');
    const form = document.getElementById('form-admin');
    document.getElementById('modal-title').textContent = camp ? 'Editar Campanha' : 'Nova Campanha';

    const escapeAttr = (str) => String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    form.innerHTML = `
        <input type="hidden" id="tipo-form" value="campanha">
        ${camp ? `<input type="hidden" id="form-camp-id" value="${escapeAttr(camp.id)}">` : ''}
        <div style="margin-bottom:10px"><label>Título da Campanha</label><input type="text" id="form-camp-titulo" value="${camp ? escapeAttr(camp.titulo) : ''}" required style="width:100%; padding:8px;"></div>
        
        <div style="margin-bottom:10px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div>
                <label>Categoria</label>
                <select id="form-camp-categoria" style="width:100%; padding:8px;" required>
                    <option value="destaque" ${camp && camp.categoria === 'destaque' ? 'selected' : ''}>Destaque (Banner Principal)</option>
                    <option value="vacinacao" ${camp && camp.categoria === 'vacinacao' ? 'selected' : ''}>Vacinação</option>
                    <option value="prevencao" ${camp && camp.categoria === 'prevencao' ? 'selected' : ''}>Prevenção</option>
                    <option value="infantil" ${camp && camp.categoria === 'infantil' ? 'selected' : ''}>Infantil / Escolar</option>
                    <option value="cronicos" ${camp && camp.categoria === 'cronicos' ? 'selected' : ''}>Doenças Crônicas</option>
                    <option value="mental" ${camp && camp.categoria === 'mental' ? 'selected' : ''}>Saúde Mental</option>
                </select>
            </div>
            <div>
                <label>Ícone (Emoji ou classe CSS)</label>
                <input type="text" id="form-camp-icone" value="${camp ? escapeAttr(camp.icone || '') : ''}" placeholder="Ex: 💉 ou 🦷" style="width:100%; padding:8px;">
            </div>
        </div>

        <div style="margin-bottom:10px"><label>Resumo / Descrição Curta</label><input type="text" id="form-camp-resumo" value="${camp ? escapeAttr(camp.resumo || '') : ''}" required placeholder="Ex: Proteja-se e proteja sua família contra a febre amarela." style="width:100%; padding:8px;"></div>
        <div style="margin-bottom:10px"><label>Descrição Completa</label><textarea id="form-camp-descricao" rows="4" style="width:100%; padding:8px;">${camp ? escapeAttr(camp.descricao || camp.resumo || '') : ''}</textarea></div>
        
        <div style="margin-bottom:10px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div>
                <label>Público-Alvo</label>
                <input type="text" id="form-camp-publico" value="${camp ? escapeAttr(camp.publico_alvo || camp.publicoAlvo || '') : ''}" placeholder="Ex: População em geral" style="width:100%; padding:8px;">
            </div>
            <div>
                <label>Local de Atendimento</label>
                <input type="text" id="form-camp-local" value="${camp ? escapeAttr(camp.local || '') : ''}" placeholder="Ex: Todas as UBS" style="width:100%; padding:8px;">
            </div>
        </div>

        <div style="margin-bottom:10px"><label>Documentos Necessários</label><input type="text" id="form-camp-documentos" value="${camp ? escapeAttr(camp.documentos || '') : ''}" placeholder="Ex: Cartão SUS, RG e CPF" style="width:100%; padding:8px;"></div>

        <div style="margin-bottom:10px; border:1px solid #ccc; padding:10px; border-radius:5px; background:#fafafa;">
             <label style="display:block; margin-bottom:5px;">Imagem Banner</label>
             <input type="file" id="form-camp-file" accept="image/*" style="width:100%; padding:8px; margin-bottom:10px; background:white; border:1px solid #ddd; cursor:pointer;">
             <div style="text-align:center; font-size:0.85rem; color:#666; margin-bottom:5px;">OU informe uma URL:</div>
             <input type="text" id="form-camp-img" value="${camp ? escapeAttr(camp.imagem || '') : ''}" placeholder="https://..." style="width:100%; padding:8px;">
        </div>
        <div style="margin-bottom:10px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
             <div><label>Data Início</label><input type="date" id="form-camp-inicio" value="${camp ? escapeAttr(camp.data_inicio || '') : ''}" style="width:100%; padding:8px;"></div>
             <div><label>Data Fim</label><input type="date" id="form-camp-fim" value="${camp ? escapeAttr(camp.data_fim || '') : ''}" style="width:100%; padding:8px;"></div>
        </div>
        <div style="margin-bottom:10px;"><label>Status da Campanha</label>
             <select id="form-camp-status" style="width:100%; padding:8px;">
                  <option value="ativo" ${!camp || String(camp.status).toLowerCase() === 'ativo' || String(camp.status).toLowerCase() === 'ativa' || parseInt(camp.status) === 1 ? 'selected' : ''}>Ativa (Em andamento)</option>
                  <option value="aguardando" ${camp && (String(camp.status).toLowerCase() === 'aguardando' || String(camp.status).toLowerCase() === 'em breve') ? 'selected' : ''}>Aguardando (Em breve)</option>
                  <option value="encerrado" ${camp && (String(camp.status).toLowerCase() === 'encerrado' || String(camp.status).toLowerCase() === 'inativa' || parseInt(camp.status) === 0) ? 'selected' : ''}>Encerrada</option>
             </select>
        </div>
        <button type="submit" style="background:var(--admin-success); color:white; border:none; padding:10px; width:100%; font-weight:bold; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;"><i class="fi fi-rr-disk"></i> ${camp ? 'Salvar Alterações' : 'Lançar Campanha'}</button>
    `;
    modal.style.display = 'flex';
}

async function deletarCampanha(id) {
    if (!confirm('Excluir esta campanha?')) return;
    if (typeof API !== 'undefined') {
        const resp = await API.deletarCampanha(id);
        if (resp && resp.sucesso) {
            carregarCampanhas();
            return;
        }
    }

    // Fallback Local
    let campanhas = JSON.parse(localStorage.getItem('admin_campanhas') || '[]');
    campanhas = campanhas.filter(c => c.id != id);
    localStorage.setItem('admin_campanhas', JSON.stringify(campanhas));
    carregarCampanhas();
}

// --- LOG SYSTEM ---
async function carregarLogs() {
    const lista = document.getElementById('lista-logs');
    if (!lista) return;

    let logs = [];
    if (typeof API !== 'undefined') {
        const response = await API.logs();
        // Verifica se a resposta é um array ou tem erro
        if (Array.isArray(response)) {
            logs = response;
        } else if (response && response.erro) {
            console.error('Erro ao carregar logs:', response.erro);
            lista.innerHTML = '<li style="padding: 15px; text-align: center; color: #d32f2f;"><i class="fi fi-rr-cross-circle"></i> Erro ao carregar logs: ' + response.erro + '</li>';
            return;
        } else {
            logs = [];
        }
    } else {
        logs = JSON.parse(localStorage.getItem('admin_logs') || '[]');
    }

    if (logs.length === 0) {
        lista.innerHTML = '<li style="padding: 15px; text-align: center; color: #666;">Nenhuma ação registrada ainda.</li>';
        return;
    }

    lista.innerHTML = logs.map(log => `
        <li style="padding: 10px; border-bottom: 1px solid #eee; font-size: 0.9rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                <strong>${log.acao}</strong>
                <small style="color:#888">${log.data_acao || log.data || 'Agora'}</small>
            </div>
            <div style="color: #555;">Por: ${log.usuario || 'Sistema'}</div>
        </li>
    `).join('');
}

window.limparLogs = async function () {
    if (!confirm('Deseja realmente limpar todo o histórico?')) return;

    if (typeof API !== 'undefined') {
        const resp = await API.limparLogs();
        if (resp && resp.erro) {
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao limpar logs: ' + resp.erro });
        } else if (resp && resp.sucesso) {
            Swal.fire({ icon: 'success', title: 'Limpo', text: 'Todo o histórico de logs foi removido!' });
        }
    }

    localStorage.setItem('admin_logs', JSON.stringify([]));
    carregarLogs();
}

// Helper: Converte Arquivo de Imagem para Base64 Redimensionada (Otimização de Banco)
function converteParaBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Limite de tamanho para não estourar o banco de dados
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.floor(height * (MAX_WIDTH / width));
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Retorna compressão JPEG 0.7 dependendo do suporte
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = error => reject(error);
    });
}

// ==========================================
// MÓDULO: DOENÇAS & ATLAS 3D
// ==========================================

let adminDoencasCache = [];

async function carregarDoencas() {
    let doencasDb = [];

    if (typeof API !== 'undefined') {
        try {
            const resp = await API.adminDoencas('GET');
            if (resp && !resp.erro) {
                doencasDb = resp;
            }
        } catch (e) {
            console.error("Erro ao carregar doenças da API:", e);
        }
    }

    // SINCRONIZAÇÃO: Se a API falhou ou retornou vazio, mas temos LocalStorage
    const local = localStorage.getItem('admin_doencas_corpo');
    if (doencasDb.length === 0 && local) {
        const doencasLocal = JSON.parse(local);
        if (doencasLocal.length > 0) {
            console.log("Sincronizando LocalStorage para o Banco de Dados...");
            for (const d of doencasLocal) {
                try {
                    await API.adminDoencas('POST', {
                        titulo: d.nome,
                        icone: d.icon,
                        o_que_e: d.descricao,
                        imagem: d.img,
                        bg_class: d.bgClass,
                        especialista: d.especialista,
                        encaminhamento: d.encaminhamento,
                        gravidade: d.gravidade,
                        ordem: d.ordem || 0
                    });
                } catch (err) { console.error("Falha ao sincronizar item:", d.nome); }
            }
            // Recarregar após sincronizar
            const respFinal = await API.adminDoencas('GET');
            if (respFinal && !respFinal.erro) doencasDb = respFinal;
        }
    }

    // Se ainda estiver tudo vazio, usar SEED e salvar na API
    if (doencasDb.length === 0) {
        const seed = [
            { titulo: "Hipertensão", icone: "<i class='fi fi-rr-heart'></i> ", imagem: "hypertension_3d_card_1772990851793.png", bg_class: "bg-hipertensao", especialista: "Cardiologista", encaminhamento: "Clínico Geral (UBS) ou Médico da Família", gravidade: "Alta", o_que_e: "A pressão alta crônica força o coração a trabalhar muito além do normal, correndo o risco de causar hipertrofia ventricular e insuficiência cardíaca." },
            { titulo: "Diabetes", icone: "<i class='fi fi-rr-syringe'></i> ", imagem: "diabetes_3d_card_1772990866460.png", bg_class: "bg-diabetes", especialista: "Endocrinologista", encaminhamento: "Clínico Geral para exames de rotina (Glicemia)", gravidade: "Alta", o_que_e: "Doença crônica onde o corpo não produz ou não usa adequadamente a insulina. O monitoramento contínuo evita complicações graves na visão e nos rins." }
        ];
        for (const s of seed) { await API.adminDoencas('POST', s); }
        const respSeed = await API.adminDoencas('GET');
        if (respSeed && !respSeed.erro) doencasDb = respSeed;
    }

    adminDoencasCache = doencasDb;
    localStorage.setItem('admin_doencas_corpo', JSON.stringify(doencasDb));

    const lista = document.getElementById('lista-doencas');
    if (!lista) return;

    lista.innerHTML = doencasDb.map((d, idx) => `
        <div class="admin-item" style="flex-direction:column; align-items:stretch; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <div style="display:flex; gap:15px; flex:1; align-items:center;">
                    <div style="font-size: 2rem;">${d.icone || '<i class="fi fi-rr-stethoscope"></i>'}</div>
                    <div>
                        <h4 style="margin: 0 0 5px 0; color:#0056AC;">${d.titulo} <span style="font-size:0.8rem; background:#e2e8f0; padding:2px 8px; border-radius:10px; margin-left:10px;">Médico: ${d.especialista || 'Geral'}</span></h4>
                        <p style="margin: 0; font-size: 0.9rem; color:#666;">${(d.o_que_e || '').substring(0, 100)}...</p>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-edit btn-icon-only" onclick="abrirModalDoenca(${idx})"><i class="fi fi-rr-edit"></i></button>
                    <button class="btn-delete btn-icon-only" onclick="excluirDoenca(${idx})"><i class="fi fi-rr-trash"></i></button>
                </div>
            </div>
            
            <div style="margin-top:15px; background:#f0f0f0; padding:15px; border-radius:8px; display:flex; flex-direction:column; align-items:center;">
                <span style="font-size:0.8rem; color:#888; margin-bottom:10px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">Pré-visualização do Card</span>
                <div class="vertical-card ${d.bg_class || 'bg-diabetes'}" style="position:relative; transform: scale(0.7); margin: -40px 0;">
                    <img src="${d.imagem || 'https://via.placeholder.com/400x225'}" alt="${d.titulo}">
                    <div class="overlay-text" style="display:none;">${d.icone || '<i class=\"fi fi-rr-stethoscope\"></i> '}</div>
                </div>
                <div style="margin-top:10px; text-align:center; color:#444; width:100%; max-width:400px;">
                    <h3 style="margin:5px 0; font-size:1.1rem; color:var(--primary-color);">${d.icone || '<i class=\"fi fi-rr-stethoscope\"></i> '} ${d.titulo}</h3>
                    <p style="font-size:0.85rem; line-height:1.4; color:#666; margin:0 0 10px;">${d.o_que_e}</p>
                    ${d.tratamento ? `<p style="font-size:0.8rem; color:#444; margin:0 0 5px;"><strong>Tratamento:</strong> ${d.tratamento}</p>` : ''}
                    ${d.prevencao ? `<p style="font-size:0.8rem; color:#444; margin:0;"><strong>Prevenção:</strong> ${d.prevencao}</p>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    if (doencasDb.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color:#999;">Nenhuma Doença cadastrada para o Carrossel.</p>';
    }
}

function abrirModalDoenca(idx = null) {
    const isEdit = idx !== null;
    const d = isEdit ? adminDoencasCache[idx] : { titulo: '', icone: '', bg_class: 'bg-diabetes', especialista: '', encaminhamento: '', imagem: '', o_que_e: '', tratamento: '', prevencao: '', gravidade: 'Baixa', ordem: 0 };

    document.getElementById('modal-title').textContent = isEdit ? 'Editar Doença (Mapa 3D)' : 'Nova Doença (Mapa 3D)';

    // Detectar ícone atual: é emoji ou classe flaticon?
    const iconeAtual = d.icone || d.icon || '';
    const iconeOpcoes = [
        { value: '', label: '-- Selecione um ícone --' },
        { value: "<i class='fi fi-rr-heart'></i> ", label: '❤️ Coração (Hipertensão/Cardio)' },
        { value: "<i class='fi fi-rr-syringe'></i> ", label: '💉 Seringa (Diabetes/Vacinas)' },
        { value: "<i class='fi fi-rr-brain'></i> ", label: '🧠 Cérebro (Mental/Neurológico)' },
        { value: "<i class='fi fi-rr-lungs'></i> ", label: '🫁 Pulmões (Respiratório/Asma)' },
        { value: "<i class='fi fi-rr-bug'></i> ", label: '🦟 Inseto (Dengue/Infecções)' },
        { value: "<i class='fi fi-rr-medicine'></i> ", label: '💊 Remédio (Medicamentos)' },
        { value: "<i class='fi fi-rr-stethoscope'></i> ", label: '🩺 Estetoscópio (Geral)' },
        { value: "<i class='fi fi-rr-hospital'></i> ", label: '🏥 Hospital (Emergência)' },
        { value: "<i class='fi fi-rr-eye'></i> ", label: '👁️ Olho (Oftalmologia)' },
        { value: "<i class='fi fi-rr-tooth'></i> ", label: '🦷 Dente (Odontologia)' },
        { value: "<i class='fi fi-rr-bone'></i> ", label: '🦴 Osso (Ortopedia)' },
        { value: "<i class='fi fi-rr-wheelchair'></i> ", label: '♿ Cadeirante (Mobilidade)' },
        { value: "<i class='fi fi-rr-virus'></i> ", label: '🦠 Vírus (COVID/Gripe)' },
        { value: "<i class='fi fi-rr-drop'></i> ", label: '🩸 Sangue (Hematologia)' },
        { value: "<i class='fi fi-rr-microscope'></i> ", label: '🔬 Microscópio (Análises)' },
        { value: "<i class='fi fi-rr-ambulance'></i> ", label: '🚑 Ambulância (Emergência)' },
    ];

    const iconeOptionsHtml = iconeOpcoes.map(op => {
        const sel = op.value === iconeAtual ? 'selected' : '';
        return `<option value="${op.value.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" ${sel}>${op.label}</option>`;
    }).join('');

    document.getElementById('form-admin').innerHTML = `
        <input type="hidden" id="form-doenca-id" value="${isEdit ? d.id : ''}">
        <input type="hidden" id="form-doenca-idx" value="${isEdit ? idx : ''}">
        
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:10px; margin-bottom:15px;">
            <div>
                <label>Nome da Doença:</label>
                <input type="text" id="form-doenca-nome" value="${(d.titulo || d.nome || '').replace(/"/g, '&quot;')}" required placeholder="Ex: Diabetes Tipo 2" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;">
            </div>
            <div>
                <label>Ícone:</label>
                <select id="form-doenca-icon" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;">
                    ${iconeOptionsHtml}
                </select>
            </div>
            <div>
                <label>Gravidade:</label>
                <select id="form-doenca-gravidade" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;">
                    <option value="Baixa" ${d.gravidade === 'Baixa' ? 'selected' : ''}>Baixa</option>
                    <option value="Média" ${(d.gravidade === 'Média' || d.gravidade === 'Media') ? 'selected' : ''}>Média</option>
                    <option value="Alta" ${d.gravidade === 'Alta' ? 'selected' : ''}>Alta</option>
                </select>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:15px;">
            <div>
                <label>Especialista:</label>
                <input type="text" id="form-doenca-especialista" value="${(d.especialista || '').replace(/"/g, '&quot;')}" required placeholder="Ex: Cardiologista" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;">
            </div>
            <div>
                <label>Cor de Fundo:</label>
                <select id="form-doenca-bg" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;">
                    <option value="bg-diabetes" ${(d.bg_class || d.bgClass) === 'bg-diabetes' ? 'selected' : ''}>Roxo / Rosa</option>
                    <option value="bg-mental" ${(d.bg_class || d.bgClass) === 'bg-mental' ? 'selected' : ''}>Azul / Verde</option>
                    <option value="bg-hipertensao" ${(d.bg_class || d.bgClass) === 'bg-hipertensao' ? 'selected' : ''}>Vermelho / Vinho</option>
                    <option value="bg-vacina" ${(d.bg_class || d.bgClass) === 'bg-vacina' ? 'selected' : ''}>Azul / Branco</option>
                    <option value="bg-dengue" ${(d.bg_class || d.bgClass) === 'bg-dengue' ? 'selected' : ''}>Laranja / Amarelo</option>
                </select>
            </div>
            <div>
                <label>Ordem:</label>
                <input type="number" id="form-doenca-ordem" value="${d.ordem || 0}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;">
            </div>
        </div>

        <div style="margin-bottom:15px;">
            <label>Encaminhamento na Rede:</label>
            <input type="text" id="form-doenca-encaminhamento" value="${(d.encaminhamento || '').replace(/"/g, '&quot;')}" required placeholder="Ex: UPA para emergência, UBS para rotina" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;">
        </div>

        <div style="margin-bottom:15px; border:1px solid #ccc; padding:10px; border-radius:5px; background:#fafafa;">
             <label style="display:block; margin-bottom:5px;">Imagem Ilustrativa (3D)</label>
             <select id="form-doenca-img-select" style="width:100%; padding:8px; margin-bottom:10px; border:1px solid #ddd; border-radius:5px;" onchange="document.getElementById('form-doenca-img').value = this.value">
                 <option value="">-- Ou escolha uma arte padrão --</option>
                 <option value="assets/organs/heart_3d_stylized.png">Coração 3D</option>
                 <option value="assets/organs/brain_3d_stylized.png">Cérebro 3D</option>
                 <option value="assets/organs/lungs_3d_stylized.png">Pulmões 3D</option>
                 <option value="assets/organs/eyes_3d_stylized.png">Olhos 3D</option>
                 <option value="assets/organs/mouth_3d_stylized.png">Boca 3D</option>
                 <option value="assets/organs/human_body_3d_stylized.png">Corpo Inteiro 3D</option>
             </select>
             <input type="text" id="form-doenca-img" value="${(d.imagem || d.img || '').replace(/"/g, '&quot;')}" placeholder="URL da imagem..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;">
        </div>

        <div style="display:grid; grid-template-columns: 1fr; gap:10px; margin-bottom:15px;">
            <div>
                <label>O que é:</label>
                <textarea id="form-doenca-o-que-e" rows="2" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;"></textarea>
            </div>
            <div>
                <label>Tratamento:</label>
                <textarea id="form-doenca-tratamento" rows="2" placeholder="Como é tratado..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;"></textarea>
            </div>
            <div>
                <label>Prevenção:</label>
                <textarea id="form-doenca-prevencao" rows="2" placeholder="Como prevenir..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:5px;"></textarea>
            </div>
        </div>
        
        <div style="text-align:right;">
            <button type="button" class="btn-cancel" onclick="fecharModalAdmin()" style="margin-right:10px; padding:10px 15px; cursor:pointer;">Cancelar</button>
            <button type="submit" class="btn-save" style="background:#28a745; color:white; border:none; padding:10px 15px; border-radius:4px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px;"><i class="fi fi-rr-disk"></i> Salvar Alterações</button>
        </div>
    `;

    // Preencher textareas via .value para evitar problemas de encoding HTML
    document.getElementById('form-doenca-o-que-e').value = d.o_que_e || d.descricao || '';
    document.getElementById('form-doenca-tratamento').value = d.tratamento || '';
    document.getElementById('form-doenca-prevencao').value = d.prevencao || '';

    document.getElementById('form-admin').onsubmit = salvarDoenca;
    document.getElementById('modal-admin').style.display = 'flex';
}

async function salvarDoenca(e) {
    e.preventDefault();

    const id = document.getElementById('form-doenca-id').value;
    const titulo = document.getElementById('form-doenca-nome').value;
    const icone = document.getElementById('form-doenca-icon').value;
    const gravidade = document.getElementById('form-doenca-gravidade').value;
    const especialista = document.getElementById('form-doenca-especialista').value;
    const bg_class = document.getElementById('form-doenca-bg').value;
    const encaminhamento = document.getElementById('form-doenca-encaminhamento').value;
    let imagem = document.getElementById('form-doenca-img').value;
    const o_que_e = document.getElementById('form-doenca-o-que-e').value;
    const tratamento = document.getElementById('form-doenca-tratamento').value;
    const prevencao = document.getElementById('form-doenca-prevencao').value;
    const ordem = document.getElementById('form-doenca-ordem').value;

    const fileInput = document.getElementById('form-doenca-file');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        if (typeof showHealthLoader === 'function') showHealthLoader('Processando imagem 3D...');
        try {
            imagem = await converteParaBase64(fileInput.files[0]);
        } catch (err) { console.error('Erro imagem:', err); }
        if (typeof hideHealthLoader === 'function') hideHealthLoader();
    }

    const payload = { titulo, icone, gravidade, especialista, bg_class, encaminhamento, imagem, o_que_e, tratamento, prevencao, ordem };

    try {
        let resp;
        if (id) {
            resp = await API.adminDoencas('PUT', payload, id);
        } else {
            resp = await API.adminDoencas('POST', payload);
        }

        if (resp && resp.sucesso) {
            fecharModalAdmin();
            await carregarDoencas();
            Swal.fire({ icon: 'success', title: 'Sincronizado', text: 'Dados sincronizados com o Dashboard e Mapa com sucesso!' });
        } else {
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao salvar no banco de dados: ' + (resp.erro || 'Desconhecido') });
        }
    } catch (err) {
        console.error("Erro ao salvar doença:", err);
        Swal.fire({ icon: 'error', title: 'Falha na API', text: 'Não foi possível estabelecer comunicação com o servidor.' });
    }
}

async function excluirDoenca(idx) {
    const d = adminDoencasCache[idx];
    if (!d) return;

    if (!confirm(`Tem certeza que deseja apagar "${d.titulo || d.nome}" do Mapa 3D?`)) return;

    try {
        const resp = await API.adminDoencas('DELETE', null, d.id);
        if (resp && resp.sucesso) {
            if (typeof API !== 'undefined' && typeof API.criarLog === 'function') {
                await API.criarLog(`Excluiu Doença do Mapa: ${d.titulo || d.nome}`);
            }
            await carregarDoencas();
            Swal.fire({ icon: 'success', title: 'Excluído', text: 'Doença removida do mapa com sucesso.' });
        } else {
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao excluir: ' + (resp.erro || 'Desconhecido') });
        }
    } catch (err) {
        console.error("Erro ao deletar:", err);
        Swal.fire({ icon: 'error', title: 'Falha na API', text: 'Não foi possível processar a exclusão.' });
    }
}

// �?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?
//  MÓDULO: GESTÃO DE NOTIFICAÇÕES DIRETAS
// �?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?

async function carregarNotificacoesAdmin() {
    const lista = document.getElementById('lista-notificacoes');
    if (!lista) return;

    let notificacoes = [];
    if (typeof API !== 'undefined') {
        notificacoes = await API.notificacoesAdmin();
    }

    if (notificacoes && !notificacoes.erro) {
        lista.innerHTML = notificacoes.map(n => `
            <div class="admin-item">
                <div style="flex:1;">
                    <h4 style="margin:0 0-5px 0;">Para: ${n.usuario_nome || 'Usuário Desconhecido'} (${n.usuario_cpf || '---'})</h4>
                    <p style="margin:5px 0; font-size:0.95rem; color:#333;">"${n.mensagem}"</p>
                    <small style="color:#888;">Enviada em: ${n.criada_em || '---'} | Status: ${n.lida ? '<i class=\"fi fi-rr-check-circle\"></i> Lida' : '<i class=\"fi fi-rr-envelope\"></i> Pendente'}</small>
                </div>
                <div class="item-actions">
                    <button class="btn-delete" onclick="deletarNotificacaoAdmin(${n.id})"><i class="fi fi-rr-trash"></i> Excluir</button>
                </div>
            </div>
        `).join('');
        if (notificacoes.length === 0) lista.innerHTML = '<p style="padding:15px; text-align:center; color:#666;">Nenhuma notificação enviada.</p>';
    }
}

window.abrirModalNotificacao = async function() {
    const modal = document.getElementById('modal-admin');
    const form = document.getElementById('form-admin');
    document.getElementById('modal-title').textContent = 'Enviar Nova Notificação';

    showHealthLoader('Carregando usuários...');
    let usuarios = [];
    if (typeof API !== 'undefined') {
        usuarios = await API.usuariosAdmin();
    }
    hideHealthLoader();

    const userOptions = usuarios.map(u => `<option value="${u.id}">${u.nome} (${u.cpf}) - ${u.tipo}</option>`).join('');

    form.innerHTML = `
        <input type="hidden" id="tipo-form" value="notificacao">
        <div style="margin-bottom:15px;">
            <label>Destinatário (Paciente/Médico/Enf):</label>
            <select id="form-notif-usuario" required style="width:100%; padding:10px; border-radius:5px; border:1px solid #ddd;">
                <option value="">Selecione um usuário...</option>
                ${userOptions}
            </select>
        </div>
        <div style="margin-bottom:15px;">
            <label>Mensagem do Alerta:</label>
            <textarea id="form-notif-msg" rows="4" required placeholder="Ex: Seu exame de sangue já está disponível para retirada na UBS." style="width:100%; padding:10px; border-radius:5px; border:1px solid #ddd;"></textarea>
        </div>
        <div style="text-align:right; gap:10px; display:flex; justify-content:flex-end;">
            <button type="button" class="btn-cancel" onclick="fecharModalAdmin()" style="padding:10px 20px;">Cancelar</button>
            <button type="submit" style="background:#28a745; color:white; border:none; padding:10px 20px; border-radius:5px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px;"><i class="fi fi-rr-paper-plane"></i> Enviar Notificação</button>
        </div>
    `;
    modal.style.display = 'flex';
}

async function deletarNotificacaoAdmin(id) {
    if (!confirm('Excluir esta notificação permanentemente?')) return;
    if (typeof API !== 'undefined') {
        const resp = await API.deletarNotificacaoAdmin(id);
        if (resp && resp.sucesso) {
            await carregarNotificacoesAdmin();
        }
    }
}

// Expor todas as funções globais necessárias ao escopo window para garantir a correta execução dos onclicks inline
window.deletarNoticia = deletarNoticia;
window.deletarSlide = deletarSlide;
window.deletarCampanha = deletarCampanha;
window.aprovarComentario = aprovarComentario;
window.rejeitarComentario = rejeitarComentario;
window.abrirModalDoenca = abrirModalDoenca;
window.excluirDoenca = excluirDoenca;
window.deletarNotificacaoAdmin = deletarNotificacaoAdmin;
