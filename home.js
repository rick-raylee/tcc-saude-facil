// ====================================================================
// HOME.JS - JavaScript para Carousel e Modal de Notícias
// ====================================================================

// Inicializar carousel e componentes quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', async function () {
    console.log('Página carregada, iniciando componentes...');

    try {
        // 1. Dados Administrativos (Notícias/Stats)
        carregarDadosDinamicos();
        setInterval(carregarDadosDinamicos, 30000);

        // 2. Mapa de Doenças 3D (Substituído pelo Carrossel Vertical)
        initVerticalCarousel().catch(err => console.error('Falha no carrossel vertical:', err));

        // 3. Lógica do Carrossel 3D de Notícias (Giro e Drag)
        init3DCarouselLogic();

        // 4. Sistema de Cadastro e Sessão
        verificarSessao().catch(err => console.error('Falha ao verificar sessão:', err));
        const checkedRadio = document.querySelector('input[name="tipoCadastro"]:checked');
        if (checkedRadio) {
            mudarTipoCadastro(checkedRadio.value);
        }

        // 5. Verificações secundárias
        checkAppointments();
        carregarConfiguracoesPortal().catch(err => console.error('Falha ao carregar config identidade:', err));
    } catch (err) {
        console.error('ERRO CRÍTICO NA INICIALIZAÇÃO:', err);
        // Fallback: Tentar iniciar ao menos a lógica básica do carrossel para não quebrar a UI
        init3DCarouselLogic();
    }
});

// --- LÓGICA DO CARROSSEL 3D (HORIZONTAL) ---
let carousel3dAngle = 0;
let isDragging = false;
let startX = 0;
let currentX = 0;
let startY = 0;
let movedY = 0;

function init3DCarouselLogic() {
    const spinner = document.getElementById('carousel3dSpinner');
    if (!spinner) return;

    // --- LÓGICA DE AUTO-ROTAÇÃO (TEMPORIZADOR) ---
        let autoPlayTimer = null;
    const startAutoPlay = () => {
        if (autoPlayTimer) return;
        autoPlayTimer = setInterval(() => {
            if (slides3D.length === 0 || isDragging) return;
            const step = 360 / slides3D.length;
            carousel3dAngle -= step; 
            spinner.style.transition = 'transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
            spinner.style.transform = `translateZ(var(--tz, -425px)) rotateY(${carousel3dAngle}deg)`;
            atualizarDots3D();
        }, 3000);
    };

    const stopAutoPlay = () => {
        if (autoPlayTimer) clearInterval(autoPlayTimer);
        autoPlayTimer = null;
    };

    // Função global para girar via dots
    window.girarParaSlide3D = function (index) {
        if (!slides3D || slides3D.length === 0) return;
        stopAutoPlay();
        const step = 360 / slides3D.length;
        // Ajustar o ângulo para ser o mais próximo do atual (evitar giros bruscos)
        const currentRot = Math.round(carousel3dAngle / 360) * 360;
        carousel3dAngle = currentRot - (index * step);
        spinner.style.transition = 'transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
        spinner.style.transform = `translateZ(var(--tz, -425px)) rotateY(${carousel3dAngle}deg)`;
        atualizarDots3D();
        startAutoPlay();
    };

    // Desktop Mouse Events
    spinner.parentElement.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.pageX;
        spinner.style.transition = 'none';
        spinner.style.cursor = 'grabbing';
        stopAutoPlay();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentX = e.pageX;
        const diff = (currentX - startX) * 0.5; // Fator de sensibilidade
        spinner.style.transform = `translateZ(var(--tz, -425px)) rotateY(${carousel3dAngle + diff}deg)`;
    });

    window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        spinner.style.cursor = 'grab';
        const diff = (e.pageX - startX) * 0.5;
        carousel3dAngle += diff;
        spinner.style.transition = 'transform 1s cubic-bezier(0.2, 0.8, 0.2, 1)';
        if (slides3D.length > 0) {
            const step = 360 / slides3D.length;
            carousel3dAngle = Math.round(carousel3dAngle / step) * step;
            spinner.style.transform = `translateZ(var(--tz, -425px)) rotateY(${carousel3dAngle}deg)`;
            atualizarDots3D();
        }
        startAutoPlay();
    });
// Mobile / Touch
    spinner.parentElement.addEventListener('touchstart', (e) => {
        isDragging = true;
        startX = e.touches[0].pageX;
        spinner.style.transition = 'none';
        stopAutoPlay();
    }, { passive: true });

    spinner.parentElement.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].pageX;
        const diff = (currentX - startX) * 0.5;
        spinner.style.transform = `translateZ(var(--tz, -425px)) rotateY(${carousel3dAngle + diff}deg)`;
    }, { passive: true });

    spinner.parentElement.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const diff = (currentX - startX) * 0.5;
        carousel3dAngle += diff;
        spinner.style.transition = 'transform 1s cubic-bezier(0.2, 0.8, 0.2, 1)';
        if (slides3D.length > 0) {
            const step = 360 / slides3D.length;
            carousel3dAngle = Math.round(carousel3dAngle / step) * step;
            spinner.style.transform = `translateZ(var(--tz, -425px)) rotateY(${carousel3dAngle}deg)`;
            atualizarDots3D();
        }
        startAutoPlay();
    });

    // Expor globalmente para que carregarCarouselDinamico possa reiniciar
    window.startAutoPlay3D = startAutoPlay;

    // Iniciar auto-rotação imediatamente
    startAutoPlay();
}

function atualizarDots3D() {
    const dotsContainer = document.getElementById('carousel3dDots');
    if (!dotsContainer || !slides3D.length) return;

    const dots = document.querySelectorAll('.carousel-3d-dot');
    const cards = document.querySelectorAll('.card-3d');
    const step = 360 / slides3D.length;
    // Normalizar o ângulo para index (0 a length-1)
    let index = Math.round(-carousel3dAngle / step) % slides3D.length;
    if (index < 0) index += slides3D.length;

    // Atualizar classes dos cards para efeito de profundidade
    cards.forEach((card, i) => {
        if (i === index) {
            card.classList.add('active');
            card.classList.remove('inactive');
        } else {
            card.classList.remove('active');
            card.classList.add('inactive');
        }
    });

    dots.forEach((dot, i) => {
        dot.style.background = (i === index) ? '#004b82' : 'rgba(0, 75, 130, 0.2)';
        dot.style.transform = (i === index) ? 'scale(1.3)' : 'scale(1)';
    });

    // Atualizar Contador Digital (Ex: 1 de 5)
    let countSpan = document.getElementById('carousel3dCount');
    if (!countSpan) {
        countSpan = document.createElement('span');
        countSpan.id = 'carousel3dCount';
        countSpan.style.cssText = 'color: #004b82; font-weight: 800; font-size: 0.95rem; margin-right: 15px; background: rgba(255,255,255,0.9); padding: 5px 15px; border-radius: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: inline-block;';
        dotsContainer.prepend(countSpan);
    }
    countSpan.innerText = `${index + 1} de ${slides3D.length}`;
}

// --- VERIFICAR AGENDAMENTOS ---
async function checkAppointments() {
    const container = document.getElementById('patient-appointment-alert');
    if (!container) return;

    let agendamentos = [];
    if (typeof API !== 'undefined') {
        try {
            agendamentos = await API.minhasConsultas();
        } catch (apiErr) {
            console.warn("Erro ao buscar consultas na API em checkAppointments:", apiErr);
        }
    }

    if (!agendamentos || agendamentos.length === 0 || agendamentos.erro) {
        agendamentos = JSON.parse(localStorage.getItem('agendamentos') || '[]');
    }

    if (!agendamentos || agendamentos.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Filtrar pendentes ou ativos
    let pendentes = agendamentos.filter(a => {
        const s = (a.status || '').toLowerCase();
        return s === 'agendado' || s === 'confirmado' || s === 'confirmada' || s === 'em_atendimento' || s === 'aguardando';
    });
    if (pendentes.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Pegar o próximo agendamento mais recente
    const rawUltimo = pendentes[0];

    // Normalizar propriedades para garantir suporte a API e LocalStorage sem 'undefined'
    const ultimo = {
        id: rawUltimo.id,
        medico: rawUltimo.medico || rawUltimo.medicoNome || 'Médico Geral',
        especialidade: rawUltimo.especialidade || 'Consulta Médica',
        data: rawUltimo.data || rawUltimo.dataRaw || rawUltimo.dataAgendamento || '',
        hora: rawUltimo.hora || rawUltimo.horario || '',
        tipo: rawUltimo.tipo || 'presencial',
        status: rawUltimo.status
    };

    // Formatar exibição de data se for AAAA-MM-DD
    let diaExibicao = ultimo.data;
    if (diaExibicao && diaExibicao.includes('-')) {
        diaExibicao = diaExibicao.split('-').reverse().join('/');
    }

    // Preparar data de comparação
    let dataParaComparar = ultimo.data;
    if (dataParaComparar && dataParaComparar.includes('/') && !dataParaComparar.includes('-')) {
        const parts = dataParaComparar.split('/');
        dataParaComparar = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const isLogged = localStorage.getItem('usuarioLogado') === 'true';
    let isTime = false;
    let buttonHtml = '';

    if (dataParaComparar && ultimo.hora) {
        const appointmentTime = new Date(`${dataParaComparar}T${ultimo.hora}:00`);
        const now = new Date();
        const diffMin = (appointmentTime - now) / (1000 * 60);

        // Se está no período da teleconsulta (30 minutos antes até 1 hora depois)
        if (diffMin <= 30 && diffMin >= -60) {
            isTime = true;
        }

        if (!isLogged) {
            buttonHtml = `<button onclick="abrirModalLogin()" class="btn-enter-video" style="background:var(--primary-color); border:none; cursor:pointer;">Faça LOGIN para entrar</button>`;
        } else if (isTime && (ultimo.tipo || '').toLowerCase() === 'telemedicina') {
            buttonHtml = `<a href="telemedicina.html?sala=ativa&id=${ultimo.id}" class="btn-enter-video">ENTRAR NA SALA DE ESPERA</a>`;
        } else if ((ultimo.tipo || '').toLowerCase() === 'telemedicina') {
            buttonHtml = `<button class="btn-enter-video" disabled style="background:#ccc; cursor:not-allowed; border:none; color:#666;">Aguarde ${diaExibicao} às ${ultimo.hora}</button>`;
        } else {
            // Presencial
            buttonHtml = `<span style="padding: 10px 20px; background: rgba(0,75,130,0.1); color: var(--primary-color); font-weight: bold; border-radius: 20px; font-size: 0.9rem;"><i class="fi fi-rr-hospital"></i> Presencial</span>`;
        }
    }

    container.style.display = 'block';
    container.innerHTML = `
        <div class="appointment-alert-card" style="margin-top: 10px; margin-bottom: 10px;">
            <div class="appointment-info">
                <h3><i class='fi fi-rr-calendar'></i> Próxima Consulta: ${ultimo.medico}</h3>
                <p>${ultimo.especialidade} • ${diaExibicao || 'Data pendente'} às ${ultimo.hora || 'Horário pendente'}</p>
                <small>${(ultimo.tipo || '').toLowerCase() === 'telemedicina' ? 'Realize sua consulta de onde estiver.' : 'Compareça à unidade de saúde com antecedência.'}</small>
            </div>
            ${buttonHtml}
        </div>
    `;
}

// ====================================================================
// MODAL DE NOTÍCIAS
// ====================================================================

let hashCarrossel = "";
let hashNoticias = "";
let hashStats = "";
let slides3D = []; // Array do Carrossel 3D Administrativo

function safeParseArray(raw, fallback = []) {
    if (!raw) return [...fallback];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [...fallback];
    } catch (err) {
        console.warn('JSON inválido em localStorage:', err);
        return [...fallback];
    }
}

function normalizeApiArray(resp) {
    if (Array.isArray(resp)) return resp;
    if (!resp || typeof resp !== 'object') return [];

    const candidates = [resp.data, resp.resultado, resp.items, resp.rows, resp.dados];
    for (const item of candidates) {
        if (Array.isArray(item)) return item;
    }
    return [];
}

async function carregarConfiguracoesPortal() {
    try {
        if (typeof API !== 'undefined' && typeof API.settingsPublic === 'function') {
            const config = await API.settingsPublic();
            if (config && !config.erro) {
                const tituloEl = document.getElementById('portal-hero-titulo');
                const subtituloEl = document.getElementById('portal-hero-subtitulo');
                
                if (tituloEl && config.portal_titulo && config.portal_titulo.trim() !== '') {
                    tituloEl.innerHTML = config.portal_titulo;
                }
                if (subtituloEl && config.portal_subtitulo && config.portal_subtitulo.trim() !== '') {
                    subtituloEl.textContent = config.portal_subtitulo;
                }
            }
        }
    } catch (e) {
        console.warn("Falha ao carregar configurações de identidade do portal:", e);
    }
}

// --- CONFIGURAÇÃO DINÂMICA (ADMIN) ---
// Ler dados do localStorage ou usar padrão (se ainda não foi salvo pelo Admin)
async function carregarDadosDinamicos() {
    try { await carregarCarouselDinamico(); } catch (err) { console.error('Falha no carrossel 3D:', err); }
    try { await carregarNoticiasDinamicas(); } catch (err) { console.error('Falha nas notícias:', err); }
    try { await carregarStatsDinamicos(); } catch (err) { console.error('Falha nas estatísticas:', err); }
    try { await carregarCampanhasPublicas(); } catch (err) { console.error('Falha nas campanhas:', err); }
}

async function carregarCarouselDinamico() {
    const spinner = document.getElementById('carousel3dSpinner');
    const dotsContainer = document.getElementById('carousel3dDots');
    if (!spinner) {
        return;
    }

    let slidesAPI = [];
    let noticiasAPI = [];
    try {
        if (typeof API !== 'undefined' && typeof API.carrosselPublic === 'function') {
            const respC = await API.carrosselPublic();

            slidesAPI = normalizeApiArray(respC);
            
            if (typeof API.noticiasPublic === 'function') {
                const respN = await API.noticiasPublic();
                noticiasAPI = normalizeApiArray(respN);
            }
        }
    } catch (e) {
        console.warn('API carrossel indisponível:', e);
    }


    let slidesLocal = safeParseArray(localStorage.getItem('admin_carrossel'));
    let noticiasLocal = safeParseArray(localStorage.getItem('admin_noticias'));
    
    let todasNoticias = [...noticiasAPI];
    noticiasLocal.forEach(nl => { if(!todasNoticias.find(n => n.id === nl.id)) todasNoticias.push(nl); });

    let destaquesNoticias = todasNoticias.filter(n => parseInt(n.destaque_carrossel) === 1 || n.destaque_carrossel === true || String(n.destaque_carrossel) === 'true').map(n => ({
        id: 'n' + n.id,
        imagem: n.imagem,
        titulo: n.titulo,
        subtitulo: n.categoria || 'Notícia',
        texto: n.resumo || (n.conteudo && n.conteudo.substring(0, 100)) + '...',
        ativo: 1,
        link: '#'
    }));

    let todosSlides = [...slidesAPI];
    slidesLocal.forEach(sl => { if(!todosSlides.find(s => s.id === sl.id)) todosSlides.push(sl); });

    let slides = [...todosSlides, ...destaquesNoticias];

    slides3D = slides.filter(s => parseInt(s.ativo) === 1 || parseInt(s.status) === 1 || String(s.status) === 'publicado' || s.ativo === undefined);


    // Fallback: seed embutido quando API e localStorage estão vazios
    if (slides3D.length === 0) {
        slides3D = [
            { id: 'seed1', imagem: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=1200", titulo: "Saúde Digital 2.0", subtitulo: "A inovação que cuida de você", texto: "O SUS agora conectado à palma da sua mão.", ativo: 1 },
            { id: 'seed2', imagem: "https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?auto=format&fit=crop&q=80&w=1200", titulo: "Campanha de Vacinação", subtitulo: "Proteja quem você ama", texto: "O Ministério amplia vacinação contra HPV e gripe.", ativo: 1 },
            { id: 'seed3', imagem: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=1200", titulo: "Novos Profissionais", subtitulo: "Mais rapidez no atendimento", texto: "Novos médicos contratados para zerar as filas.", ativo: 1 }
        ];
    }

    // Hash mais completo para detectar mudanças no conteúdo (Título, Imagem, etc)
    const novoHash = JSON.stringify(slides3D.map(s => ({id: s.id, t: s.titulo, i: s.imagem})));

    if (novoHash === hashCarrossel) return;
    hashCarrossel = novoHash;

    spinner.innerHTML = '';
    if (dotsContainer) dotsContainer.innerHTML = '';

    // Criar Cartões 3D baseados nos Slides Administrativos
    slides3D.forEach((slide, index) => {
        const div = document.createElement('div');
        div.className = 'card-3d';

        // Calcular o ângulo e a profundidade (translateZ) para formar um polígono perfeito (Ex: Hexágono se 6 slides)
        const n = slides3D.length;
        const angle = 360 / n;
        
        // Geometria de Polígono Regular: apótema = (largura / 2) / tan(PI / n)
        // Ler exatamente do CSS para que a profundidade 3D (Z) case perfeitamente com a largura visual real
        let cardWidth = spinner.offsetWidth;
        if (!cardWidth || cardWidth < 100) cardWidth = window.innerWidth >= 723 ? 850 : window.innerWidth * 0.9;
        
        // Evitar divisão por zero se n=1 (embora o carrossel costume ter 3+)
        const anglePI = Math.PI / Math.max(n, 3); 
        const tz = Math.round((cardWidth / 2) / Math.tan(anglePI)) + 50; // Offset extra de 50px
        spinner.style.setProperty('--tz', `-${tz}px`);
        
        div.style.transform = `rotateY(${index * angle}deg) translateZ(${tz}px)`;
        div.style.cursor = 'pointer'; 

        // Melhoria: Detectar se foi um clique ou um arraste para não abrir notícia por engano
        let startClickX = 0;
        let startClickY = 0;

        div.onmousedown = (e) => {
            startClickX = e.pageX;
            startClickY = e.pageY;
        };

        div.onclick = (e) => {
            const moveX = Math.abs(e.pageX - startClickX);
            const moveY = Math.abs(e.pageY - startClickY);
            
            // Se moveu mais de 10px, consideramos que foi um arraste/drag
            if (moveX > 10 || moveY > 10) return;

            // Lógica original de abertura de notícia
            const newsIndex = noticias.findIndex(n => 
                (slide.noticia_id && n.id == slide.noticia_id) || 
                (n.titulo && n.titulo.toLowerCase().trim() === (slide.titulo || "").toLowerCase().trim())
            );

            if (newsIndex !== -1) {
                abrirNoticia(newsIndex);
            } else {
                // Fallback simplificado e seguro
                abrirDestaqueTemporario(slide);
            }
        };

        const imagemUrl = slide.imagem || slide.img || 'https://via.placeholder.com/500x280/004b82/ffffff?text=Destaque';

        let pContent = '';
        // Apenas exibir subtítulo se for curto (banners/campanhas) para não entulhar o card com o corpo da notícia
        const txtApoio = slide.subtitulo || slide.texto || '';
        if (txtApoio && txtApoio.length < 75) {
            pContent = `<p style="font-size:0.95rem; opacity:0.9; margin-top:5px; line-height:1.4;">${txtApoio}</p>`;
        }

        div.innerHTML = `
            <div class="card-3d-image" style="background-image: url('${imagemUrl}');"></div>
            <div class="card-3d-content" style="background: linear-gradient(to top, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.2)); padding: 20px;">
                <h3 style="font-size:1.6rem; font-weight:800; line-height:1.3; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${slide.titulo || ''}</h3>
                ${pContent}
            </div>
        `;

        spinner.appendChild(div);

        // Adicionar Dot
        if (dotsContainer) {
            const dot = document.createElement('div');
            dot.className = 'carousel-3d-dot';
            dot.style.cssText = 'width: 12px; height: 12px; border-radius: 50%; background: rgba(0, 75, 130, 0.2); cursor: pointer; transition: all 0.3s ease;';
            dot.onclick = () => girarParaSlide3D(index);
            dotsContainer.appendChild(dot);
        }
    });

    // Inicializar Dots
    atualizarDots3D();

    // ── CRITICAL: Definir o transform inicial do spinner para que os cards 3D fiquem visíveis ──
    spinner.style.transform = `translateZ(var(--tz, -425px)) rotateY(${carousel3dAngle}deg)`;

    // Iniciar auto-rotação após criar os cards
    if (typeof window.startAutoPlay3D === 'function') window.startAutoPlay3D();

    // Ajustar o contador ou navegação se necessário
    if (typeof renderCarousel3DCount === 'function') renderCarousel3DCount();

    // Re-renderizar ao redimensionar para ajustar o tz dinamicamente
    if (!window.hasCarouselResizeListener) {
        window.addEventListener('resize', () => {
            clearTimeout(window.carouselResizeTimeout);
            window.carouselResizeTimeout = setTimeout(carregarCarouselDinamico, 200);
        });
        window.hasCarouselResizeListener = true;
    }

}
// Função auxiliar para abrir destaque que não está formalmente na lista de notícias
function abrirDestaqueTemporario(slide) {
    const tempNoticia = {
        id: slide.id,
        titulo: slide.titulo || "Destaque",
        categoria: "Destaque",
        data: "Informativo",
        conteudo: slide.texto || slide.subtitulo || "Conteúdo não disponível.",
        imagem: slide.imagem || slide.img
    };
    
    // Injetar temporariamente para o modal exibir
    const originalNoticias = [...noticias];
    noticias = [tempNoticia];
    abrirNoticia(0);
    
    const checkModal = setInterval(() => {
        const modal = document.getElementById('modalNoticia');
        if (modal && !modal.classList.contains('show')) {
            noticias = originalNoticias;
            clearInterval(checkModal);
        }
    }, 500);
}

// Variável global de notícias (atualizada via JS)
let noticias = [];
let noticiaAtual = 0;

async function carregarNoticiasDinamicas() {
    let noticiasAPI = [];
    try {
        if (typeof API !== 'undefined') {
            const resp = await API.noticiasPublic();
            noticiasAPI = normalizeApiArray(resp);
        }
    } catch (e) {
        console.warn('API notícias indisponível:', e);
    }

    let noticiasLocal = safeParseArray(localStorage.getItem('admin_noticias'));

    let todasNoticias = [...noticiasAPI];
    noticiasLocal.forEach(nl => {
        if (!todasNoticias.find(n => n.id === nl.id || n.titulo === nl.titulo)) {
            todasNoticias.push(nl);
        }
    });

    if (todasNoticias.length > 0) {
        noticias = todasNoticias;
    } else {
        noticias = [];
    }

    if (!noticias || noticias.length === 0) {
        noticias = [
            { id: 1, categoria: "Campanha Nacional", titulo: "Ministério amplia vacinação contra HPV para meninos de até 15 anos", conteudo: "Medida visa reduzir casos de câncer de colo de útero e outras doenças relacionadas ao vírus.", data: "10/02/2026", imagem: "health_campaign_art_branded.png" },
            { id: 2, categoria: "Investimento", titulo: "SUS investe R$ 2 bilhões em equipamentos hospitalares", conteudo: "Recursos destinados à modernização de UTIs e centros cirúrgicos em todo o país.", data: "08/02/2026", imagem: "health_campaign_art_branded.png" },
            { id: 3, categoria: "Tecnologia", titulo: "Telemedicina atende 5 milhões de brasileiros em 2025", conteudo: "Modalidade cresceu 300% e reduziu filas de espera em consultórios de especialidades.", data: "05/02/2026", imagem: "health_campaign_art_branded.png" }
        ];
    }

    const novoHash = JSON.stringify(noticias);
    if (novoHash === hashNoticias) return;
    hashNoticias = novoHash;

    if (!window.initialCommentsLoaded && noticias.length > 0) {
        if (typeof API !== 'undefined' && noticias[noticiaAtual].id) {
            carregarComentariosPublico(noticias[noticiaAtual].id);
        }
        window.initialCommentsLoaded = true;
    }

    const container = document.getElementById('newsSliderContainer');
    if (container) {
        container.innerHTML = '';
        noticias.forEach((n, index) => {
            const slide = document.createElement('div');
            slide.className = 'card-padrao news-slide-item';
            
            // ✅ FIX: Imagem robusta com múltiplos fallbacks e loading otimizado
            let imagemUrl = 'https://via.placeholder.com/400x400/004b82/ffffff?text=Not%C3%ADcia';
            if (n.imagem) imagemUrl = n.imagem;
            else if (n.imagemUrl) imagemUrl = n.imagemUrl;
            else if (n.img) imagemUrl = n.img;
            else if (n.imagem_path) imagemUrl = n.imagem_path;

            slide.innerHTML = `
                <div class="news-slide-img-container">
                    <img src="${imagemUrl}" 
                         alt="${n.titulo || 'Notícia'}" 
                         class="news-slide-img" 
                         loading="lazy"
                         onerror="this.onerror=null; this.src='health_campaign_art_branded.png'; this.onerror=function(){this.src='https://via.placeholder.com/400x400/004b82/ffffff?text=SA%C3%9ADE';};">
                </div>
                <div class="news-slide-info">
                    <div class="news-slide-tag">${n.categoria || 'Notícia'}</div>
                    <h3>${n.titulo || 'Notícia sem título'}</h3>
                    <!-- ✅ FIX: Texto sempre visível com fallbacks múltiplos -->
                    <p>${(n.resumo && n.resumo.length > 0) ? n.resumo.substring(0, 120) : 
                       (n.conteudo && n.conteudo.length > 0) ? n.conteudo.substring(0, 120) : 
                       (n.descricao && n.descricao.length > 0) ? n.descricao.substring(0, 120) : 
                       'Leia mais sobre saúde e prevenção...' }...</p>
                    <span class="news-slide-date">
                        <i class='fi fi-rr-calendar'></i>  
                        ${n.data || n.criada_em || n.data_criacao || 'Data não disponível'}
                    </span>
                    <button class="news-slide-btn" onclick="abrirNoticia(${index})">Ler Notícia Completa</button>
                </div>
            `;
            container.appendChild(slide);

            // Estado inicial explícito para garantir que ao menos o slide central apareça
            if (index === 0) {
                slide.style.display = 'flex';
                slide.style.visibility = 'visible';
                slide.style.opacity = '1';
                slide.style.transform = 'translate3d(-50%, -50%, 180px) translateX(0) rotateY(0deg) scale(1)';
                slide.style.zIndex = '50';
            } else if (index === 1) {
                slide.style.display = 'flex';
                slide.style.visibility = 'visible';
                slide.style.opacity = '0.45';
                slide.style.transform = 'translate3d(-50%, -50%, -120px) translateX(220px) rotateY(-60deg) scale(0.8)';
                slide.style.zIndex = '39';
            } else if (index === noticias.length - 1) {
                slide.style.display = 'flex';
                slide.style.visibility = 'visible';
                slide.style.opacity = '0.45';
                slide.style.transform = 'translate3d(-50%, -50%, -120px) translateX(-220px) rotateY(60deg) scale(0.8)';
                slide.style.zIndex = '39';
            } else {
                slide.style.display = 'none';
                slide.style.visibility = 'hidden';
                slide.style.opacity = '0';
            }
        });
        noticiaAtual = 0;
        requestAnimationFrame(() => atualizarSliderNoticia());
    }
}

async function carregarStatsDinamicos() {
    let statsAPI = [];
    if (typeof API !== 'undefined') {
        try {
            const resp = await API.statsPublic();
            statsAPI = normalizeApiArray(resp);
        } catch (err) {
            console.warn('API stats indisponível:', err);
        }
    }

    let statsLocal = safeParseArray(localStorage.getItem('admin_stats'));

    let stats = statsAPI.length > 0 ? statsAPI : statsLocal;

    // FALLBACK: Se não houver dados, carregar padrão para o Mapa e Cards
    if (!stats || stats.length === 0) {
        stats = [
            { id: 1, titulo: "Hipertensos no Brasil", valor: "38 milhões", icon: "<i class='fi fi-rr-heart'></i> ", lat: -15.7801, lon: -47.9292, cor: "verde", detalhe: "Principal fator de risco para AVC" },
            { id: 2, titulo: "Diabéticos no Brasil", valor: "16,8 milhões", icon: "<i class='fi fi-rr-syringe'></i> ", lat: -23.5505, lon: -46.6333, cor: "azul", detalhe: "Representa 9% da população adulta" },
            { id: 3, titulo: "Casos de Dengue", valor: "1,6 milhão", icon: "<i class='fi fi-rr-bug'></i> ", lat: -3.1190, lon: -60.0217, cor: "laranja", detalhe: "Dados acumulados em 2025" },
            { id: 4, titulo: "Cobertura Vacinal", valor: "82%", icon: "<i class='fi fi-rr-virus'></i> ", lat: -8.0476, lon: -34.8770, cor: "roxo", detalhe: "Média nacional de imunização" }
        ];
    }

    if (!stats || stats.length === 0) {
        initStatsMap([]);
        return;
    }

    // Inicializa o mapa com as estatísticas
    initStatsMap(stats);

    const novoHash = JSON.stringify(stats);
    if (novoHash === hashStats) return;
    hashStats = novoHash;

    const rightContainer = document.getElementById('stats-right');
    
    // Suporte para o novo layout ou antigo
    if (rightContainer) {
        renderCardsInContainer(rightContainer, stats);
    } else {
        const leftContainer = document.getElementById('stats-left');
        if (leftContainer) {
            renderCardsInContainer(leftContainer, stats);
        } else {
            const container = document.querySelector('.stats-grid');
            if (container) renderCardsInContainer(container, stats);
        }
    }
}

function renderCardsInContainer(container, stats) {
    if (!container) return;
    container.innerHTML = '';
    const cores = ['azul', 'verde', 'laranja', 'roxo', 'vermelho', 'ciano'];
    
    stats.forEach((item, index) => {
        const cor = item.cor || cores[index % cores.length];
        const icone = item.icone || '<i class=\"fi fi-rr-chart-histogram\"></i> ';
        const card = document.createElement('div');
        card.className = `stat-card ${cor}`;
        card.innerHTML = `
            <div class="stat-icon-wrapper"><div class="stat-icon">${icone}</div></div>
            <div class="stat-info">
                <div class="stat-numero">${item.valor || item.numero || '0'}</div>
                <div class="stat-label">${item.titulo || item.texto || item.descricao || 'Estatística'}</div>
                <div class="stat-detalhe">${item.detalhe || ''}</div>
            </div>
        `;
        container.appendChild(card);

        // --- Efeito 3D Dashboard Interativo (Tilt + Parallax) ---
        card.addEventListener('mousemove', function (e) {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Calculo da Rotação (Sensibilidade: 15)
            const rotateX = ((centerY - y) / centerY) * 15;
            const rotateY = ((x - centerX) / centerX) * 15;

            // Aplica ao card base
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;

            // Efeito Parallax Direcional (Iluminação)
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });

        card.addEventListener('mouseleave', function () {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            card.style.setProperty('--mouse-x', '50%');
            card.style.setProperty('--mouse-y', '50%');
            // Interaction: Hide Tooltip when mouse leaves
            if (statsImageSeries && statsImageSeries.mapImages.getIndex(index)) {
                statsImageSeries.mapImages.getIndex(index).hideTooltip();
                // Opcional: Voltar zoom para estado inical
                // if (statsMapInstance) statsMapInstance.goHome();
            }
        });

        // Interaction: Hover to show Marker on Map
        card.addEventListener('mouseenter', function () {
            if (statsImageSeries && statsImageSeries.mapImages.getIndex(index)) {
                let markerTarget = statsImageSeries.mapImages.getIndex(index);
                markerTarget.showTooltip();

                // Opcional: Centralizar o mapa na coordenada do marker
                if (statsMapInstance) {
                    statsMapInstance.zoomToMapObject(markerTarget);
                }
            }
        });
    });
}

let statsMapInstance = null;
let statsImageSeries = null;

function initStatsMap(stats) {
    if (!document.getElementById('chartdiv')) return;
    if (typeof am4core === 'undefined') return;

    // Destroy previous instance
    if (statsMapInstance) {
        statsMapInstance.dispose();
    }

    // Set theme
    am4core.useTheme(am4themes_animated);

    // Create map instance
    let chart = am4core.create("chartdiv", am4maps.MapChart);
    chart.geodata = am4geodata_brazilLow;
    chart.projection = new am4maps.projections.Miller();

    // Create map polygon series
    let polygonSeries = chart.series.push(new am4maps.MapPolygonSeries());
    polygonSeries.useGeodata = true;

    // Configure series
    let polygonTemplate = polygonSeries.mapPolygons.template;
    polygonTemplate.tooltipText = "{name}";
    polygonTemplate.fill = am4core.color("#004b82").lighten(0.5);
    polygonTemplate.stroke = am4core.color("#ffffff");
    polygonTemplate.strokeWidth = 1;

    // Hover state
    let hs = polygonTemplate.states.create("hover");
    hs.properties.fill = am4core.color("#004b82");

    // Add image series for markers
    let imageSeries = chart.series.push(new am4maps.MapImageSeries());
    let imageSeriesTemplate = imageSeries.mapImages.template;
    let circle = imageSeriesTemplate.createChild(am4core.Circle);
    circle.radius = 8;
    circle.fill = am4core.color("#ff4757");
    circle.stroke = am4core.color("#FFFFFF");
    circle.strokeWidth = 2;
    circle.nonScaling = true;
    circle.tooltipText = "{title}: [bold]{value}[/]";

    imageSeriesTemplate.propertyFields.latitude = "latitude";
    imageSeriesTemplate.propertyFields.longitude = "longitude";

    let data = [];
    const fallbackCoords = [
        { lat: -23.5505, lon: -46.6333 }, // SP
        { lat: -15.7801, lon: -47.9292 }, // DF
        { lat: -3.1190, lon: -60.0217 },  // AM
        { lat: -8.0476, lon: -34.8770 },  // PE
        { lat: -30.0346, lon: -51.2177 }, // RS
        { lat: -12.9714, lon: -38.5014 }  // BA
    ];

    stats.forEach((stat, i) => {
        let lat = parseFloat(stat.lat || stat.latitude);
        let lon = parseFloat(stat.lon || stat.longitude);
        let fbCoord = fallbackCoords[i % fallbackCoords.length];

        let finalLat = !isNaN(lat) ? lat : fbCoord.lat;
        let finalLon = !isNaN(lon) ? lon : fbCoord.lon;

        let title = stat.texto || stat.descricao || 'Informação';
        let value = stat.valor_mapa || stat.valor || stat.numero || '';

        data.push({
            "latitude": finalLat,
            "longitude": finalLon,
            "title": title,
            "value": value
        });
    });

    imageSeries.data = data;
    statsImageSeries = imageSeries;
    statsMapInstance = chart;
}


function abrirNoticia(index) {
    noticiaAtual = index;
    exibirNoticia();
    document.getElementById('modalNoticia').classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevenir scroll da página

    const noticia = noticias[noticiaAtual];
    if (typeof API !== 'undefined' && noticia.id) {
        API.registrarCliqueNoticia(noticia.id);
        carregarComentariosPublico(noticia.id);
    }
}

function fecharNoticia() {
    document.getElementById('modalNoticia').classList.remove('show');
    document.body.style.overflow = ''; // Restaurar scroll
}

function proximaNoticia() {
    if (noticiaAtual < noticias.length - 1) {
        noticiaAtual++;
        exibirNoticia();
    }
}

function noticiaAnterior() {
    if (noticiaAtual > 0) {
        noticiaAtual--;
        exibirNoticia();
    }
}

function exibirNoticia() {
    const noticia = noticias[noticiaAtual];
    const conteudoDiv = document.getElementById('noticiaConteudo');
    const numeroSpan = document.getElementById('noticiaNumero');

    // ✅ FIX: Imagem robusta com múltiplos fallbacks para o modal
    let imagemUrl = '';
    if (noticia.imagem) imagemUrl = noticia.imagem;
    else if (noticia.imagemUrl) imagemUrl = noticia.imagemUrl;
    else if (noticia.img) imagemUrl = noticia.img;
    else if (noticia.imagem_path) imagemUrl = noticia.imagem_path;

    // ✅ FIX: Data robusta com múltiplos fallbacks
    const dataExibicao = noticia.data || noticia.criada_em || noticia.data_criacao || 'Data não disponível';

    // Atualizar conteúdo
    conteudoDiv.innerHTML = `
        <h2>${noticia.titulo}</h2>
        <div class="noticia-meta">
            <div class="meta-item">
                <span>📂</span>
                <span>${noticia.categoria || 'Geral'}</span>
            </div>
            <div class="meta-item">
                <span><i class='fi fi-rr-calendar'></i> </span>
                <span>${dataExibicao}</span>
            </div>
        </div>
        ${imagemUrl ? `
        <div class="noticia-imagem-modal-container" style="width: 100%; max-height: 400px; overflow: hidden; border-radius: 12px; margin: 20px 0; box-shadow: 0 8px 30px rgba(0,0,0,0.08);">
            <img src="${imagemUrl}" alt="${noticia.titulo || 'Notícia'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';">
        </div>
        ` : ''}
        <div class="noticia-texto-completo" style="line-height: 1.8; color: #444; font-size: 1.05rem; margin-top: 20px; white-space: pre-wrap; text-align: justify;">
            ${noticia.conteudo || noticia.texto || noticia.descricao || 'Conteúdo indisponível.'}
        </div>
    `;

    // Atualizar número
    numeroSpan.textContent = `${noticiaAtual + 1} / ${noticias.length}`;

    // Atualizar estado dos botões
    const btnAnterior = document.querySelector('.btn-nav:first-of-type');
    const btnProxima = document.querySelector('.btn-nav:last-of-type');

    btnAnterior.disabled = (noticiaAtual === 0);
    btnProxima.disabled = (noticiaAtual === noticias.length - 1);

    // Carregar comentários se a notícia mudar pela navegação
    if (typeof API !== 'undefined' && noticia.id) {
        API.registrarCliqueNoticia(noticia.id);
        carregarComentariosPublico(noticia.id);
    }
}

// COMENTÁRIOS E CAMPANHAS PUBLICAS
async function carregarComentariosPublico(idNoticia) {
    const lista = document.getElementById('lista-comentarios-noticia');
    if (!lista) return;
    lista.innerHTML = '<p>Carregando comentários...</p>';
    const comments = await API.listarComentariosNoticia(idNoticia);
    if (comments && !comments.erro) {
        lista.innerHTML = comments.map(c => `
        <div style="background:#f4f4f4; padding:10px; border-radius:6px; margin-bottom:10px;">
                <strong style="display:block; font-size:0.9rem;">${c.nome}</strong>
                <p style="margin:5px 0 0 0; font-size:0.9rem; color:#444;">${c.mensagem || c.texto}</p>
            </div>
            `).join('');
        if (comments.length === 0) lista.innerHTML = '<p style="color:#666;">Seja o primeiro a comentar!</p>';
    } else {
        lista.innerHTML = '<p style="color:#666;">Não foi possível carregar os comentários.</p>';
    }
}

window.enviarComentarioPublico = async function () {
    const nome = document.getElementById('comentario-nome').value;
    const texto = document.getElementById('comentario-texto').value;
    const noticia = noticias[noticiaAtual];

    if (!texto.trim()) { alert('Digite seu comentário!'); return; }

    const dados = { nome: nome || 'Anônimo', texto };
    if (typeof API !== 'undefined' && noticia.id) {
        const resp = await API.enviarComentario(noticia.id, dados);
        if (resp && resp.sucesso) {
            alert('Comentário enviado! Aguardando aprovação do administrador.');
            document.getElementById('comentario-texto').value = '';
        } else {
            alert('Erro ao enviar comentário.');
        }
    }
}

async function carregarCampanhasPublicas() {
    const listContainer = document.getElementById('nav-notif-list');
    const badge = document.getElementById('nav-notif-count');
    const welcomeContainer = document.getElementById('welcome-card-container');
    const homeAlertContainer = document.getElementById('home-campanhas-alert');

    let campanhasAPI = [];
    let notificacoesPessoais = [];
    
    // 1. Buscar Campanhas Públicas
    if (typeof API !== 'undefined' && typeof API.campanhasPublic === 'function') {
        try {
            const resp = await API.campanhasPublic();
            if (resp && !resp.erro) campanhasAPI = resp;
        } catch (e) { console.warn('API (Campanhas) indisponível.'); }
    }

    // 2. Buscar Notificações Pessoais (se logado)
    if (typeof API !== 'undefined' && localStorage.getItem('usuarioLogado')) {
        try {
            const respNotif = await API.notificacoes();
            if (respNotif && !respNotif.erro) {
                // Filtra apenas as não lidas para o badge, mas mostra todas no dropdown
                notificacoesPessoais = respNotif;
            }
        } catch (e) { console.warn('API (Notificações) indisponível.'); }
    }

    let localCamp = JSON.parse(localStorage.getItem('admin_campanhas') || '[]');
    let campanhas = (campanhasAPI && campanhasAPI.length > 0) ? campanhasAPI : localCamp;

    if (campanhas.length === 0) {
        campanhas = [{ id: 0, titulo: "Portal Saúde Fácil", descricao: "Bem-vindo ao portal!", imagem: "health_campaign_art_branded.png", status: "ativa" }];
    }

    campanhas = campanhas.filter(c => c.status == 1 || String(c.status).toLowerCase() === 'ativa' || String(c.status).toLowerCase() === 'ativo');

    // Welcome Card
    let welcomeCamp = campanhas.find(c => (c.titulo && c.titulo.toLowerCase().includes("bem-vindo")) || c.id == 0) || campanhas[0];
    if (welcomeContainer && welcomeCamp) {
        welcomeContainer.innerHTML = `
            <div class="welcome-card-3d-wrapper" style="perspective: 1200px; max-width: 900px; margin: 0 auto;">
                <div class="welcome-card-3d" style="transform-style: preserve-3d; transition: transform 0.4s ease; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,20,60,0.35);">
                    <div class="welcome-card" style="display: flex; align-items: center; background: #fff;">
                        <div style="flex: 1;"><img src="${welcomeCamp.imagem || 'health_campaign_art_branded.png'}" style="width:100%; object-fit:cover;"></div>
                        <div style="flex: 1.2; padding: 30px;">
                            <h2 style="color:#004b82; margin-bottom:10px;">${welcomeCamp.titulo}</h2>
                            <p style="color:#555; line-height:1.6; margin-bottom:20px;">${welcomeCamp.descricao}</p>
                            <button onclick="abrirModalCadastro()" class="btn-premium btn-primary">COMEÇAR AGORA</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    // AGGREGAÇÃO NO SININHO (BELL)
    const outrasCampanhas = campanhas.filter(c => c.id !== welcomeCamp.id);
    const totalItens = outrasCampanhas.length + notificacoesPessoais.filter(n => !n.lida).length;
    
    if (listContainer) {
        let htmlContent = '';

        // Adiciona Notificações Pessoais Primeiro
        if (notificacoesPessoais.length > 0) {
            htmlContent += notificacoesPessoais.map(n => `
                <div class="nav-notif-item ${n.lida ? 'read' : 'unread'}" onclick="marcarNotifLida(${n.id}, event)">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <h4><i class='fi fi-rr-bullseye'></i>  Aviso Para Você</h4>
                        ${!n.lida ? '<span class="unread-dot"></span>' : ''}
                    </div>
                    <p>${n.mensagem}</p>
                    <small>${n.data || ''}</small>
                </div>
            `).join('');
        }

        // Adiciona Campanhas Gerais
        if (outrasCampanhas.length > 0) {
            htmlContent += outrasCampanhas.map(c => `
                <div class="nav-notif-item campaign">
                    <h4>📢 ${c.titulo}</h4>
                    <p>${c.descricao || ''}</p>
                </div>
            `).join('');
        }

        if (htmlContent === '') {
            listContainer.innerHTML = '<p class="nav-notif-empty">Nenhuma nova notificação.</p>';
        } else {
            listContainer.innerHTML = htmlContent;
        }

        if (badge) {
            if (totalItens > 0) {
                badge.innerText = totalItens;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    if (homeAlertContainer) homeAlertContainer.style.display = 'none';
}

// Funções do Sininho
window.toggleNotificacoes = function(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('navNotifDropdown');
    dropdown.classList.toggle('show');
    
    // Ocultar o badge do número de notificações quando aberto
    if (dropdown.classList.contains('show')) {
        const badge = document.getElementById('nav-notif-count');
        if (badge) {
            badge.style.display = 'none';
            badge.innerText = '0';
        }
    }
}

window.marcarNotifLida = async function(id, event) {
    if (typeof API !== 'undefined') {
        try {
            await API.lerNotificacao(id);
            // Atualiza visualmente sem recarregar tudo
            const item = event.currentTarget;
            item.classList.add('read');
            item.classList.remove('unread');
            const dot = item.querySelector('.unread-dot');
            if (dot) dot.remove();
            
            // Decrementa o badge
            const badge = document.getElementById('nav-notif-count');
            if (badge) {
                let val = parseInt(badge.innerText) - 1;
                if (val <= 0) badge.style.display = 'none';
                else badge.innerText = val;
            }
        } catch (e) { console.error('Erro ao marcar como lida'); }
    }
}

window.limparNotificacoes = function() {
    const list = document.getElementById('nav-notif-list');
    const badge = document.getElementById('nav-notif-count');
    if (list) list.innerHTML = '<p class="nav-notif-empty">Nenhuma notificação recente.</p>';
    if (badge) badge.style.display = 'none';
}

// Fechar ao clicar fora
document.addEventListener('click', () => {
    const dropdown = document.getElementById('navNotifDropdown');
    if (dropdown) dropdown.classList.remove('show');
});

// Fechar modal ao pressionar ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fecharNoticia();
    }
});

// Fechar modal ao clicar fora
document.getElementById('modalNoticia')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalNoticia') {
        fecharNoticia();
    }
});

// Navegação com setas do teclado
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modalNoticia');
    if (modal && modal.classList.contains('show')) {
        if (e.key === 'ArrowLeft') noticiaAnterior();
        if (e.key === 'ArrowRight') proximaNoticia();
    }
});
// ====================================================================
// MODAIS DE AUTENTICAÇÃO (LOGIN E CADASTRO)
// ====================================================================

// ====================================================================
// MODAIS DE AUTENTICAÇÃO MODERNIZADOS (DESIGN 3D & GLASSMORPHISM)
// ====================================================================

function abrirModalLogin() {
    document.querySelectorAll('.modal-auth.show, .modal-auth-login-overlay.show, .modal-cadastro-overlay.show').forEach(function (m) { m.classList.remove('show'); });
    var modal = document.getElementById('modalLogin');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    } else {
        // Fallback: index.html usa modalAuth com flip
        var modalAuth = document.getElementById('modalAuth');
        if (modalAuth) {
            modalAuth.classList.add('show');
            document.body.style.overflow = 'hidden';
            flipParaLogin();
        }
    }
}

function abrirModalCadastro() {
    try {
        document.querySelectorAll('.modal-auth.show, .modal-auth-login-overlay.show, .modal-cadastro-overlay.show').forEach(function (m) { m.classList.remove('show'); });
        var modalC = document.getElementById('modalCadastro');
        if (modalC) {
            modalC.classList.add('show');
            document.body.style.overflow = 'hidden';
            cadIrParaPasso(1);
        } else {
            // Fallback: index.html usa modalAuth com flip
            var modalAuth = document.getElementById('modalAuth');
            if (modalAuth) {
                modalAuth.classList.add('show');
                document.body.style.overflow = 'hidden';
                flipParaCadastro();
            } else {
                alert('DEBUG: nenhum modal encontrado (nem modalCadastro, nem modalAuth)');
            }
        }
    } catch (e) {
        alert('ERRO em abrirModalCadastro: ' + e.message);
    }
}


function fecharModalLogin() {
    var modal = document.getElementById('modalLogin');
    if (modal) modal.classList.remove('show');
    if (!document.querySelector('.modal-auth.show') && !document.querySelector('.modal-auth-login-overlay.show') && !document.querySelector('.modal-cadastro-overlay.show')) {
        document.body.style.overflow = '';
    }
}

function fecharModalCadastro() {
    var modal = document.getElementById('modalCadastro');
    if (modal) modal.classList.remove('show');
    if (!document.querySelector('.modal-auth.show') && !document.querySelector('.modal-auth-login-overlay.show') && !document.querySelector('.modal-cadastro-overlay.show')) {
        document.body.style.overflow = '';
    }
}

function abrirModalAuth(pagina) {
    pagina = pagina || 'login';
    // index.html usa modalAuth com flip, index.html usa overlays separados
    var modalAuth = document.getElementById('modalAuth');
    if (modalAuth) {
        modalAuth.classList.add('show');
        document.body.style.overflow = 'hidden';
        if (pagina === 'cadastro') { flipParaCadastro(); } else { flipParaLogin(); }
    } else {
        if (pagina === 'cadastro') { abrirModalCadastro(); } else { abrirModalLogin(); }
    }
}

function fecharModalAuth() {
    // Fecha todos os tipos de modal
    var modalAuth = document.getElementById('modalAuth');
    if (modalAuth) { modalAuth.classList.remove('show'); }
    
    // Fechar modais específicos se existirem (fallback do outro projeto)
    var modalLogin = document.getElementById('modalLogin');
    if (modalLogin) modalLogin.classList.remove('show');
    
    fecharModalCadastro();
    document.body.style.overflow = '';
}

// Flip functions para index.html (3D modal)
function flipParaCadastro() {
    var flipper = document.getElementById('modalAuthFlipper');
    if (flipper) {
        flipper.classList.add('flipped');
        console.log('Flip para cadastro ativado');
    } else {
        console.error('Flipper não encontrado!');
    }
}

function flipParaLogin() {
    var flipper = document.getElementById('modalAuthFlipper');
    if (flipper) {
        flipper.classList.remove('flipped');
        console.log('Flip para login ativado');
    } else {
        console.error('Flipper não encontrado!');
    }
}


// Fechar ao clicar no backdrop
document.addEventListener('click', function (e) {
    var loginOverlay = document.getElementById('modalLogin');
    if (loginOverlay && e.target === loginOverlay) fecharModalAuth();
    var cadOverlay = document.getElementById('modalCadastro');
    if (cadOverlay && e.target === cadOverlay) fecharModalCadastro();
    var authOverlay = document.getElementById('modalAuth');
    if (authOverlay && e.target === authOverlay) fecharModalAuth();
});


// Multi-step cadastro
var cadPassoTitulos = ['Identidade', 'Dados do Perfil', 'Localiza\u00e7\u00e3o', 'Acesso'];
var cadPassoIcones = ['fa-user-plus', 'fa-id-badge', 'fa-map-marker-alt', 'fa-key'];

function cadIrParaPasso(passo) {
    for (var i = 1; i <= 4; i++) {
        var el = document.getElementById('cad-passo-' + i);
        if (el) el.style.display = 'none';
        var dot = document.querySelector('.cad-step[data-step="' + i + '"]');
        if (dot) { dot.classList.remove('active', 'done'); dot.textContent = i; }
    }
    var pasoEl = document.getElementById('cad-passo-' + passo);
    if (pasoEl) pasoEl.style.display = 'block';
    for (var j = 1; j < passo; j++) {
        var dotJ = document.querySelector('.cad-step[data-step="' + j + '"]');
        if (dotJ) { dotJ.classList.add('done'); dotJ.textContent = '\u2713'; }
    }
    var activeDot = document.querySelector('.cad-step[data-step="' + passo + '"]');
    if (activeDot) { activeDot.classList.add('active'); activeDot.textContent = passo; }
    var titulo = document.getElementById('cad-titulo-texto');
    var icon = document.getElementById('cad-icon');
    if (titulo) titulo.textContent = cadPassoTitulos[passo - 1] || '';
    if (icon) icon.className = 'fa-solid ' + (cadPassoIcones[passo - 1] || 'fa-user-plus');
}

function cadAvancar(passoAtual) {
    if (passoAtual === 1) {
        var nome = document.getElementById('nome');
        if (!nome || !nome.value.trim()) { alert('Por favor, preencha seu nome completo.'); return; }
    }
    if (passoAtual < 4) cadIrParaPasso(passoAtual + 1);
}

function cadVoltar(passoAtual) {
    if (passoAtual > 1) cadIrParaPasso(passoAtual - 1);
}

// Lógica de Cadastro em Passos (3D)
function proximoPassoCadastro(passo) {
    const contents = document.querySelectorAll('.auth-step-content');
    const steps = document.querySelectorAll('.auth-progress-steps .step');
    const progressBar = document.getElementById('authProgressBar');
    const title = document.getElementById('cadastroTitle');
    const sub = document.getElementById('cadastroSub');

    // Esconder todos os passos e remover classes de progresso
    contents.forEach(content => content.classList.remove('active'));
    steps.forEach(step => {
        step.classList.remove('active');
        if (parseInt(step.dataset.step) < passo) {
            step.classList.add('completed');
        } else {
            step.classList.remove('completed');
        }
    });

    // Ativar o passo atual
    const stepContent = document.getElementById('authStep' + passo);
    if (stepContent) stepContent.classList.add('active');

    const stepIndicator = document.querySelector(`.step[data-step="${passo}"]`);
    if (stepIndicator) stepIndicator.classList.add('active');

    // Atualizar Barra de Progresso
    const progress = ((passo - 1) / (contents.length - 1)) * 100;
    progressBar.style.setProperty('--progress', progress + '%');

    // Atualizar Textos de Cabeçalho (Opcional - para dar contexto)
    const titulos = {
        1: ["Identificação Básica", "Conte-nos quem você é"],
        2: ["Perfil de Acesso", "Escolha como deseja usar o portal"],
        3: ["Sua Localização", "Para direcionar você à unidade correta"],
        4: ["Segurança e Contato", "Finalize criando seu acesso"]
    };

    if (titulos[passo]) {
        title.innerText = titulos[passo][0];
        sub.innerText = titulos[passo][1];
    }

    // Scroll para o topo do modal (se for longo)
    const card = document.querySelector('.modal-auth-card.cadastro-wide');
    if (card) card.scrollTop = 0;
}

// Funções para Seleção de Tipo de Cadastro
function mudarTipoCadastro(tipo) {
    var blockTipo = tipo === 'medico_tele' ? 'medico' : tipo;
    var ids = ['campos-paciente', 'campos-medico', 'campos-enfermeiro', 'campos-admin', 'campos-ti'];
    ids.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
    var target = document.getElementById('campos-' + blockTipo);
    if (target) target.style.display = 'block';

    // Ocultar e remover obrigatoriedade do Cartão SUS para Admin
    var susInput = document.getElementById('sus');
    if (susInput) {
        var susBlock = susInput.closest('.form-group-3d');
        if (blockTipo === 'admin' || blockTipo === 'medico' || blockTipo === 'enfermeiro') {
            susInput.required = false;
            // Oculta a caixa do SUS se preferível, ou apenas remove required
            if (susBlock) susBlock.style.display = 'none';
        } else {
            susInput.required = true;
            if (susBlock) susBlock.style.display = 'block';
        }
    }
}

function abrirModalRecuperar() {
    fecharModalAuth();
    fecharModalCadastro();
    const modal = document.getElementById('modalRecuperar');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function fecharModalRecuperar() {
    const modal = document.getElementById('modalRecuperar');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

// Fechar modais ao clicar fora do card (3D Wrapper ou Overlay)
window.addEventListener('click', (e) => {
    const modalAuth = document.getElementById('modalAuth');
    const modalRecuperar = document.getElementById('modalRecuperar');

    // Clique no overlay do modalAuth fecha o modal
    if (e.target === modalAuth) fecharModalAuth();
    if (e.target === modalRecuperar) fecharModalRecuperar();
});

// Lógica de inclinação 3D (Mouse Move)
function initAuth3DTilt() {
    const cards = document.querySelectorAll('.modal-auth-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Sensibilidade: 15 graus de rotação max
            const rotateX = (centerY - y) / 10;
            const rotateY = (x - centerX) / 10;

            card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'rotateX(0deg) rotateY(0deg)';
        });
    });
}


function toggleSenhaLogin(eyeIcon) {
    const input = document.getElementById('login-senha');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
    } else {
        input.type = 'password';
        eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
    }
}

// Máscaras de Input (Executa em todos os campos com as classes específicas)
document.addEventListener('DOMContentLoaded', () => {
    initAuthMasks();
    
    // Remove programaticamente o required nativo para impedir bloqueios silenciosos
    // de campos requeridos que estao ocultos em outras etapas do cadastro.
    const formCadastro = document.getElementById('formCadastro');
    if (formCadastro) {
        console.log('[FormCadastro] Removendo required nativo para suporte a validacao programatica premium...');
        formCadastro.querySelectorAll('[required]').forEach(el => {
            el.removeAttribute('required');
        });
    }
});

function initAuthMasks() {
    // Máscara de CPF
    document.querySelectorAll('.cpf-mask').forEach(input => {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            e.target.value = v;
        });
    });

    // Máscara de Telefone
    document.querySelectorAll('.tel-mask').forEach(input => {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
            v = v.replace(/(\d{5})(\d)/, '$1-$2');
            e.target.value = v;
        });
    });

    // Máscara de Cartão SUS (000 0000 0000 0000)
    document.querySelectorAll('.sus-mask').forEach(input => {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 15) v = v.slice(0, 15);
            v = v.replace(/(\d{3})(\d)/, '$1 $2');
            v = v.replace(/(\d{4})(\d)/, '$1 $2');
            v = v.replace(/(\d{4})(\d)/, '$1 $2');
            e.target.value = v;
        });
    });

    // Máscara de Data (DD/MM/AAAA)
    document.querySelectorAll('.date-mask').forEach(input => {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 8) v = v.slice(0, 8);
            v = v.replace(/(\d{2})(\d)/, '$1/$2');
            v = v.replace(/(\d{2})(\d)/, '$1/$2');
            e.target.value = v;
        });
    });
}


function alternarMascaraDoc(tipo) {
    const inputCpf = document.getElementById('cpf');
    const labelCpf = document.querySelector('label[for="cpf"]');

    inputCpf.value = '';

    if (tipo === 'cnpj') {
        labelCpf.textContent = 'CNPJ';
        inputCpf.placeholder = '00.000.000/0000-00';
        inputCpf.classList.remove('cpf-mask');
        inputCpf.classList.add('cnpj-mask');
        inputCpf.maxLength = 18;
    } else {
        labelCpf.textContent = 'CPF';
        inputCpf.placeholder = '000.000.000-00';
        inputCpf.classList.remove('cnpj-mask');
        inputCpf.classList.add('cpf-mask');
        inputCpf.maxLength = 14;
    }
}


// Auxiliar para padronizar CPF (apenas números)
function limparCPF(valor) {
    return (valor || '').replace(/\D/g, '');
}

// function finalizarLogin... (Integrado com Backend API)
async function finalizarLogin(event) {
    event.preventDefault();

    const cpfInput = document.getElementById('login-cpf');
    const senhaInput = document.getElementById('login-senha');
    const cpfDigitado = limparCPF(cpfInput ? cpfInput.value : '');
    const senhaDigitada = senhaInput ? senhaInput.value : '';

    // ── TENTAR BACKEND API PRIMEIRO ──────────────────────────────
    if (typeof API !== 'undefined') {
        console.log('Tentando login via API para CPF (limpo):', cpfDigitado);
        const resp = await API.login(cpfDigitado, senhaDigitada);
        console.log('Resposta da API:', resp);

        if (resp && resp.sucesso) {
            const u = resp.usuario;
            // Salvar no localStorage para compatibilidade e fallback
            localStorage.setItem('usuarioLogado', 'true');
            localStorage.setItem('usuarioNome', u.nome);
            localStorage.setItem('tipoUsuario', (u.tipo || 'paciente').toLowerCase());
            localStorage.setItem('usuarioCpf', u.cpf);
            localStorage.setItem('usuarioSUS', u.sus || '');
            localStorage.setItem('usuarioId', u.id);
            localStorage.setItem('usuarioTelefone', u.telefone || '');

            Swal.fire({
                icon: 'success',
                title: 'Login Realizado',
                text: 'Bem-vindo(a), ' + u.nome
            });

            console.log("TIPO DETECTADO NO FRONTEND:", u.tipo);

            // LOGICA DE REDIRECIONAMENTO PADRONIZADA
            const tipo = (u.tipo || 'paciente').toLowerCase();
            console.log('PROCESSO DE REDIRECIONAMENTO:', tipo);

            if (tipo === 'admin') {
                localStorage.setItem('adminLogado', 'true');
                window.location.replace('admin.html');
                return;
            }
            if (tipo === 'medico' || tipo === 'medico_tele') {
                localStorage.setItem('medicoRegistrado', JSON.stringify(u));
                if (tipo === 'medico_tele' || u.atende_telemedicina) {
                    window.location.replace('painel_telemedicina.html');
                } else {
                    window.location.replace('medico.html');
                }
                return;
            }
            if (tipo === 'enfermeiro') {
                localStorage.setItem('enfermeiroRegistrado', JSON.stringify(u));
                window.location.replace('enfermeiro.html');
                return;
            }
            if (tipo === 'ti') {
                localStorage.setItem('tiLogado', 'true');
                window.location.replace('ti.html');
                return;
            }
            
            // Default: Paciente
            window.location.replace('perfil.html');
            return;
        }
        // Se o backend respondeu com erro, validamos o erro. 
        // Se for "Senha incorreta", barramos imediatamente para exibir erro correto ao usuário.
        // Se for "CPF não encontrado", deixamos cair no Fallback Local pois pode ser um cadastro offline.
        if (resp && resp.erro) {
            const erroStr = String(resp.erro || '').toLowerCase();
            const detalheStr = String(resp.detalhe || '').toLowerCase();
            
            if (erroStr.includes('senha') || detalheStr.includes('senha') || detalheStr.includes('incorreta')) {
                Swal.fire({ icon: 'error', title: 'Senha Incorreta', text: resp.detalhe || resp.erro });
                return;
            }
            if (erroStr.includes('falha na cone') || detalheStr.includes('falha na cone') || detalheStr.includes('tempo limite')) {
                Swal.fire({ icon: 'error', title: 'Servidor Indisponível', text: (resp.erro || '') + '\nDetalhe: ' + (resp.detalhe || '') });
                return;
            }
            console.warn('Login API falhou (' + resp.erro + '). Tentando fallback local...');
        }
    }

    // ── FALLBACK: LÓGICA ORIGINAL (localStorage) ────────────────
    // 1. Verificação de ADMIN
    const adminRegistradoStr = localStorage.getItem('adminRegistrado');
    let adminRegistrado = null;
    if (adminRegistradoStr) adminRegistrado = JSON.parse(adminRegistradoStr);

    if (adminRegistrado && cpfDigitado === adminRegistrado.cpf) {
        // Validação de senha local (se a senha nâo foi armazenada antes, ignora por compatibilidade legada)
        if (adminRegistrado.senha && senhaDigitada !== adminRegistrado.senha) {
            Swal.fire({ icon: 'error', title: 'Acesso Negado', text: 'Senha incorreta para o Administrador.' });
            return;
        }
        localStorage.setItem('usuarioLogado', 'true');
        localStorage.setItem('usuarioNome', 'Admin ' + adminRegistrado.nome.split(' ')[0]);
        localStorage.setItem('tipoUsuario', 'admin');
        localStorage.setItem('adminLogado', 'true');
        localStorage.setItem('adminFuncao', adminRegistrado.funcao || 'Administrador Geral');
        setTimeout(() => { fecharModalAuth(); window.location.href = 'admin.html'; }, 100);
        return;
    }

    // 1.5 Verificação de TI (Fallback local)
    if (cpfDigitado === '111.111.111-11' && senhaDigitada === 'ti2026') {
        localStorage.setItem('usuarioLogado', 'true');
        localStorage.setItem('usuarioNome', 'TI Admin (Offline)');
        localStorage.setItem('tipoUsuario', 'ti');
        localStorage.setItem('tiLogado', 'true');
        setTimeout(() => { fecharModalAuth(); window.location.href = 'ti.html'; }, 100);
        return;
    }

    // 2. Verificação de MÉDICO (MULTI-USER)
    let dbMedicos = JSON.parse(localStorage.getItem('db_medicos') || '[]');
    const unico = JSON.parse(localStorage.getItem('medicoRegistrado') || 'null');
    if (unico && !dbMedicos.find(m => m.documento === unico.documento)) dbMedicos.push(unico);
    const medicoEncontrado = dbMedicos.find(m => m.documento === cpfDigitado);
    if (medicoEncontrado) {
        if (medicoEncontrado.senha && senhaDigitada !== medicoEncontrado.senha) {
            Swal.fire({ icon: 'error', title: 'Acesso Negado', text: 'Senha incorreta para o Profissional de Saúde.' });
            return;
        }
        localStorage.setItem('usuarioLogado', 'true');
        localStorage.setItem('usuarioNome', 'Dr(a). ' + medicoEncontrado.nome.split(' ')[0]);
        localStorage.setItem('tipoUsuario', 'medico');
        localStorage.setItem('medicoRegistrado', JSON.stringify(medicoEncontrado));
        window.location.replace('/painel-medico');
        return;
    }

    // 3. Verificação de ENFERMEIRO
    let dbEnfermeiros = JSON.parse(localStorage.getItem('db_enfermeiros') || '[]');
    const enfEncontrado = dbEnfermeiros.find(e => limparCPF(e.documento) === cpfDigitado);
    if (enfEncontrado) {
        if (enfEncontrado.senha && senhaDigitada !== enfEncontrado.senha) {
            Swal.fire({ icon: 'error', title: 'Acesso Negado', text: 'Senha incorreta para a Enfermagem.' });
            return;
        }
        localStorage.setItem('usuarioLogado', 'true');
        localStorage.setItem('usuarioNome', 'Enf. ' + enfEncontrado.nome.split(' ')[0]);
        localStorage.setItem('tipoUsuario', 'enfermeiro');
        localStorage.setItem('enfermeiroRegistrado', JSON.stringify(enfEncontrado));
        window.location.replace('/painel-enfermeiro');
        return;
    }

    // 4. Verificação de PACIENTE REAL (MULTI-USER)
    let dbPacientes = JSON.parse(localStorage.getItem('db_pacientes') || '[]');
    const usuarioRegistradoStr = localStorage.getItem('usuarioRegistrado');
    let usuarioRegistrado = null;
    if (usuarioRegistradoStr) usuarioRegistrado = JSON.parse(usuarioRegistradoStr);
    
    // Sincroniza o último registrado para a lista se já não estiver
    if (usuarioRegistrado && !dbPacientes.find(p => p.cpf === usuarioRegistrado.cpf)) {
        dbPacientes.push(usuarioRegistrado);
    }

    const pacienteEncontrado = dbPacientes.find(p => p.cpf === cpfDigitado);

    if (pacienteEncontrado) {
        if (pacienteEncontrado.senha && senhaDigitada !== pacienteEncontrado.senha) {
            Swal.fire({ icon: 'error', title: 'Acesso Negado', text: 'Senha cadastrada não confere.' });
            return;
        }
        localStorage.setItem('usuarioLogado', 'true');
        localStorage.setItem('usuarioNome', pacienteEncontrado.nome);
        localStorage.setItem('usuarioIdade', pacienteEncontrado.idade || '30');
        localStorage.setItem('usuarioSUS', pacienteEncontrado.sus || '');
        localStorage.setItem('usuarioCpf', pacienteEncontrado.cpf);
        localStorage.setItem('tipoUsuario', 'paciente');
        localStorage.setItem('usuarioDoencas', JSON.stringify(pacienteEncontrado.doencas || []));
        localStorage.setItem('usuarioRegistrado', JSON.stringify(pacienteEncontrado));
    } else if (usuarioRegistrado && usuarioRegistrado.cpf === cpfDigitado) {
        localStorage.setItem('usuarioLogado', 'true');
        localStorage.setItem('usuarioNome', usuarioRegistrado.nome);
        localStorage.setItem('usuarioIdade', usuarioRegistrado.idade || '30');
        localStorage.setItem('usuarioSUS', usuarioRegistrado.sus);
        localStorage.setItem('usuarioCpf', usuarioRegistrado.cpf);
        localStorage.setItem('tipoUsuario', 'paciente');
        localStorage.setItem('usuarioDoencas', JSON.stringify([]));
    } else {
        // Se a senha e cpf não combinarem com nenhum registro
        if (cpfDigitado !== '000.000.000-00' && cpfDigitado !== '00000000000') {
            Swal.fire({ 
                icon: 'warning', 
                title: 'Credenciais Inválidas', 
                text: 'Não localizamos este CPF no sistema. Verifique os dados ou realize um novo cadastro.' 
            });
            return;
        }

        localStorage.setItem('usuarioLogado', 'true');
        localStorage.setItem('usuarioNome', 'RICARDO MARCHI (TESTE)');
        localStorage.setItem('usuarioIdade', '28');
        localStorage.setItem('usuarioSUS', '7000.0456.1234.9988');
        localStorage.setItem('usuarioCpf', '00000000000');
        localStorage.setItem('tipoUsuario', 'paciente');
        localStorage.setItem('usuarioDoencas', JSON.stringify(['Diabético', 'Hipertenso', 'Asma']));
    }

    window.location.replace('/dashboard');
}

// function finalizarCadastro... (Integrado com Backend API)
async function finalizarCadastro(event) {
    event.preventDefault();
    console.log("Iniciando finalização de cadastro com validação programática...");
    try {
        const nomeEl = document.getElementById('nome');
        const nome = nomeEl ? nomeEl.value.trim() : '';
        const cpfEl = document.getElementById('cpf');
        const cpf = limparCPF(cpfEl ? cpfEl.value : '');
        const nascEl = document.getElementById('nascimento');
        const nascimento = nascEl ? nascEl.value.trim() : '';
        
        // Obter tipo selecionado
        const tipoCadastroEl = document.querySelector('input[name="tipoCadastro"]:checked');
        if (!tipoCadastroEl) throw new Error("Selecione o tipo de cadastro.");
        const tipoCadastro = tipoCadastroEl.value;

        // Obter senha cadastrada
        const senhaEl = document.getElementById('senha-cadastro') || document.getElementById('senha');
        const senha = senhaEl ? senhaEl.value.trim() : cpf; // fallback: usa CPF como senha

        // 1. Validação Passo 1
        if (!nome) {
            proximoPassoCadastro(1);
            Swal.fire({ icon: 'warning', title: 'Nome Obrigatório', text: 'Por favor, informe seu Nome Completo.' });
            return;
        }
        if (!cpf) {
            proximoPassoCadastro(1);
            Swal.fire({ icon: 'warning', title: 'CPF/CNPJ Obrigatório', text: 'Por favor, informe seu CPF ou CNPJ.' });
            return;
        }
        if (cpf.length !== 11 && cpf.length !== 14) {
            proximoPassoCadastro(1);
            Swal.fire({
                icon: 'error',
                title: 'CPF/CNPJ Inválido',
                text: 'O CPF deve ter 11 dígitos e o CNPJ 14 dígitos.'
            });
            return;
        }
        if (!nascimento) {
            proximoPassoCadastro(1);
            Swal.fire({ icon: 'warning', title: 'Nascimento Obrigatório', text: 'Por favor, informe sua Data de Nascimento.' });
            return;
        }

        // 2. Validação Passo 3 (Apenas para Pacientes, Profissionais de saúde pulam o SUS)
        const cidadeEl = document.getElementById('cidade');
        const cidade = cidadeEl ? cidadeEl.value : '';
        const bairroEl = document.getElementById('bairro');
        const bairro = bairroEl ? bairroEl.value.trim() : '';
        const susEl = document.getElementById('sus');
        const sus = susEl ? susEl.value.trim() : '';

        if (tipoCadastro === 'paciente') {
            if (!cidade) {
                proximoPassoCadastro(3);
                Swal.fire({ icon: 'warning', title: 'Cidade Obrigatória', text: 'Por favor, selecione sua Cidade.' });
                return;
            }
            if (!bairro) {
                proximoPassoCadastro(3);
                Swal.fire({ icon: 'warning', title: 'Bairro Obrigatório', text: 'Por favor, informe seu Bairro.' });
                return;
            }
            if (!sus) {
                proximoPassoCadastro(3);
                Swal.fire({ icon: 'warning', title: 'Cartão SUS Obrigatório', text: 'Por favor, informe seu Cartão SUS.' });
                return;
            }
        }

        // 3. Validação Passo 4
        const telEl = document.getElementById('telefone');
        const telefone = telEl ? telEl.value.trim() : '';
        const emailEl = document.getElementById('email');
        const email = emailEl ? emailEl.value.trim() : '';

        if (!telefone) {
            proximoPassoCadastro(4);
            Swal.fire({ icon: 'warning', title: 'Celular Obrigatório', text: 'Por favor, informe seu número de Celular.' });
            return;
        }
        if (!email) {
            proximoPassoCadastro(4);
            Swal.fire({ icon: 'warning', title: 'E-mail Obrigatório', text: 'Por favor, informe seu endereço de E-mail.' });
            return;
        }
        if (!senha) {
            proximoPassoCadastro(4);
            Swal.fire({ icon: 'warning', title: 'Senha Obrigatória', text: 'Por favor, defina uma Senha de acesso.' });
            return;
        }
        if (senha.length < 6) {
            proximoPassoCadastro(4);
            Swal.fire({ icon: 'warning', title: 'Senha Fraca', text: 'A senha deve conter no mínimo 6 caracteres.' });
            return;
        }

        // Validação Admin
        if (tipoCadastro === 'admin') {
            const chaveEl = document.getElementById('admin-key');
            const chave = chaveEl ? chaveEl.value : '';
            if (chave !== 'ADMIN2026') {
                alert('⛔ Acesso Negado: Chave de Segurança incorreta.');
                return;
            }

            const fEl = document.getElementById('admin-funcao');
            const funcao = fEl ? fEl.value : 'Administrador';
            const metodo2FAEl = document.querySelector('input[name="metodo-2fa"]:checked');
            const metodo2FA = metodo2FAEl ? metodo2FAEl.value : 'email';
            
            const contatoEmail = document.getElementById('email') ? document.getElementById('email').value : '';
            const contatoTel = document.getElementById('telefone') ? document.getElementById('telefone').value : '';
            const contato2FA = contatoEmail || contatoTel; // fallback pra 2FA do novo layout

            if (!contato2FA) {
                alert('⚠️ Por favor, informe um E-mail ou Celular na Etapa 4 para receber o código de validação.');
                return;
            }

            // Armazenar dados pendentes para finalizar depois do 2FA
            adminPendente = { nome: nome.toUpperCase(), cpf, nascimento, funcao, tipo: 'admin', metodo2fa: metodo2FA, contato2fa: contato2FA, senha };

            if (typeof API !== 'undefined') {
                const formData = new FormData();
                formData.append('nome', nome.toUpperCase());
                formData.append('cpf', cpf);
                formData.append('senha', senha);
                formData.append('tipo', tipoCadastro);
                formData.append('funcao', funcao);

                // Tratar imagem
                const tipoFotoEl = document.querySelector('input[name="tipo-foto"]:checked');
                if (tipoFotoEl) {
                    if (tipoFotoEl.value === 'url') {
                        const imgUrlEl = document.getElementById('imagem_url');
                        const imgUrl = imgUrlEl ? imgUrlEl.value : '';
                        if (imgUrl) formData.append('imagem_url', imgUrl);
                    } else if (tipoFotoEl.value === 'arquivo') {
                        const imgFileEl = document.getElementById('imagem_arquivo');
                        const imgFile = (imgFileEl && imgFileEl.files.length > 0) ? imgFileEl.files[0] : null;
                        if (imgFile) formData.append('imagem_arquivo', imgFile);
                    }
                }
                adminPendenteFormData = formData;
            }

            iniciar2FAAdmin(metodo2FA, contato2FA);
            return;
        }

        // ── TENTAR BACKEND API PRIMEIRO ──────────────────────────
        if (typeof API !== 'undefined') {
            const formData = new FormData();
            formData.append('nome', nome.toUpperCase());
            formData.append('cpf', cpf);
            formData.append('senha', senha);
            formData.append('tipo', tipoCadastro);
            formData.append('telefone', telefone);
            formData.append('cidade', cidade);
            formData.append('bairro', bairro);

            // Tratar imagem
            const tipoFotoEl = document.querySelector('input[name="tipo-foto"]:checked');
            if (tipoFotoEl) {
                if (tipoFotoEl.value === 'url') {
                    const imgUrlEl = document.getElementById('imagem_url');
                    const imgUrl = imgUrlEl ? imgUrlEl.value : '';
                    if (imgUrl) formData.append('imagem_url', imgUrl);
                } else if (tipoFotoEl.value === 'arquivo') {
                    const imgFileEl = document.getElementById('imagem_arquivo');
                    const imgFile = (imgFileEl && imgFileEl.files.length > 0) ? imgFileEl.files[0] : null;
                    if (imgFile) formData.append('imagem_arquivo', imgFile);
                }
            }

            // SUS para paciente
            const susEl = document.getElementById('sus');
            if (susEl) formData.append('sus', susEl.value || '');

            // Campos médico
            if (tipoCadastro === 'medico' || tipoCadastro === 'medico_tele') {
                formData.set('tipo', 'medico'); // O backend recebe como base 'medico'
                const crmEl = document.getElementById('crm');
                const especEl = document.getElementById('especialidade');
                if (crmEl) formData.append('crm', crmEl.value || '');
                if (especEl) formData.append('especialidade', especEl.value || '');
                
                if (tipoCadastro === 'medico_tele') {
                    formData.append('tipo_atendimento', 'telemedicina');
                } else {
                    const tipoAtendimentoEl = document.querySelector('input[name="tipo_atendimento"]:checked');
                    formData.append('tipo_atendimento', tipoAtendimentoEl ? tipoAtendimentoEl.value : 'presencial');
                }
            }

            // Campos enfermeiro
            if (tipoCadastro === 'enfermeiro') {
                const corenEl = document.getElementById('coren');
                if (corenEl) formData.append('coren', corenEl.value || '');
                const tipoProfissionalEl = document.querySelector('input[name="tipo_profissional"]:checked');
                formData.append('tipo_profissional', tipoProfissionalEl ? tipoProfissionalEl.value : 'Enfermeiro');
            }

            // (Campos extra de admin não são mais processados aqui, pois Admin já retornou na verificação acima)

            const resp = await API.cadastro(formData);
            if (resp && resp.sucesso) {
                const u = resp.usuario;
                // Sincronizar localStorage
                localStorage.setItem('usuarioLogado', 'true');
                localStorage.setItem('usuarioNome', u.nome);
                localStorage.setItem('tipoUsuario', u.tipo);
                localStorage.setItem('usuarioCpf', u.cpf);
                localStorage.setItem('usuarioId', u.id);
                localStorage.setItem('usuarioImagem', u.imagem || '');

                if (u.tipo === 'medico') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Cadastro Profissional',
                        html: `<i class='fi fi-rr-stethoscope'></i>  Olá, Dr(a). ${nome.split(' ')[0]}!<br>Cadastro realizado com sucesso.<br>Faça login com seu CPF.`
                    });
                } else if (u.tipo === 'enfermeiro') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Cadastro Profissional',
                        html: `<i class='fi fi-rr-hospital'></i>  Olá, ${nome.split(' ')[0]}!<br>Cadastro realizado com sucesso.<br>Faça login com seu CPF.`
                    });
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'Bem-vindo(a)!',
                        html: `<i class='fi fi-rr-party-horn'></i>  Olá, ${nome.split(' ')[0]}!<br>Cadastro realizado com sucesso.<br>Faça login com seu CPF: <b>${cpf}</b>`
                    });
                }

                
                console.log('CADASTRO SUCESSO. REDIRECIONANDO PARA:', u.tipo);
                const tipo = (u.tipo || 'paciente').toLowerCase();
                
                if (tipo === 'admin') window.location.replace('/admin');
                else if (tipo === 'medico') window.location.replace('/painel-medico');
                else if (tipo === 'enfermeiro') window.location.replace('/painel-enfermeiro');
                else if (tipo === 'ti') window.location.replace('/painel-ti');
                else window.location.replace('/dashboard');

                return;
            }
            if (resp && resp.erro) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro no Cadastro',
                    text: resp.erro
                });
                return;
            }
            Swal.fire({
                icon: 'error',
                title: 'Erro de Conexão',
                text: 'Não foi possível estabelecer comunicação com o servidor.'
            });
            // Backend offline — cair no fallback
        }

        // ── FALLBACK: LÓGICA ORIGINAL (localStorage) ────────────
        // (Admin offline block is removed because it is handled entirely at the top of the function)

        if (tipoCadastro === 'medico') {
            const crmEl = document.getElementById('crm');
            const crm = crmEl ? crmEl.value : '';
            const especialidadeEl = document.getElementById('especialidade');
            const especialidade = especialidadeEl ? especialidadeEl.value : '';
            const tipoAtendimentoEl = document.querySelector('input[name="tipo_atendimento"]:checked');
            const tipo_atendimento = tipoAtendimentoEl ? tipoAtendimentoEl.value : 'presencial';
            const atendeTele = (tipo_atendimento === 'telemedicina' || tipo_atendimento === 'ambos');
            const medico = { id: Date.now(), nome: nome.toUpperCase(), documento: cpf, nascimento, crm, especialidade, tipo: 'medico', atendeTelemedicina: atendeTele, tipo_atendimento: tipo_atendimento, senha: senha };
            let dbMedicos = JSON.parse(localStorage.getItem('db_medicos') || '[]');
            if (dbMedicos.find(m => m.documento === cpf)) { alert('Este médico já está cadastrado!'); return; }
            dbMedicos.push(medico);
            localStorage.setItem('db_medicos', JSON.stringify(dbMedicos));
            localStorage.setItem('medicoRegistrado', JSON.stringify(medico));
            Swal.fire({
                icon: 'success',
                title: 'Cadastro Profissional',
                html: `<i class='fi fi-rr-stethoscope'></i>  Olá, Dr(a). ${nome.split(' ')[0]}!<br>Seu cadastro profissional foi realizado com sucesso.<br>Acesse com seu documento: ${cpf}`
            });
        } else if (tipoCadastro === 'enfermeiro') {
            const corenEl = document.getElementById('coren');
            const coren = corenEl ? corenEl.value : '';
            const tProfEl = document.querySelector('input[name="tipo_profissional"]:checked');
            const funcaoEnf = tProfEl ? tProfEl.value : 'Enfermeiro';
            if (!coren || !funcaoEnf) { alert('⚠️ Preencha o COREN e a Função.'); return; }
            const enfermeiro = { id: Date.now(), nome: nome.toUpperCase(), documento: cpf, nascimento, coren, funcao: funcaoEnf, tipo: 'enfermeiro', senha: senha };
            let dbEnfermeiros = JSON.parse(localStorage.getItem('db_enfermeiros') || '[]');
            if (dbEnfermeiros.find(e => e.documento === cpf)) { alert('Este profissional já está cadastrado!'); return; }
            dbEnfermeiros.push(enfermeiro);
            localStorage.setItem('db_enfermeiros', JSON.stringify(dbEnfermeiros));
            localStorage.setItem('enfermeiroRegistrado', JSON.stringify(enfermeiro));
            Swal.fire({
                icon: 'success',
                title: 'Cadastro Realizado',
                html: `<i class='fi fi-rr-hospital'></i>  Olá, ${nome.split(' ')[0]}!<br>Cadastro de ${funcaoEnf} realizado com sucesso.<br>Acesse com seu documento: ${cpf}`
            });
        } else {
            const susEl = document.getElementById('sus');
            const sus = susEl ? susEl.value : '';
            const idadeCalculada = calcularIdade(nascimento);
            const novoUsuario = { nome: nome.toUpperCase(), cpf, nascimento, idade: idadeCalculada, sus, tipo: 'paciente', senha: senha };
            localStorage.setItem('usuarioRegistrado', JSON.stringify(novoUsuario));
            let dbPacientes = JSON.parse(localStorage.getItem('db_pacientes') || '[]');
            if (!dbPacientes.find(p => p.cpf.replace(/\D/g, '') === cpf.replace(/\D/g, ''))) {
                dbPacientes.push(novoUsuario);
                localStorage.setItem('db_pacientes', JSON.stringify(dbPacientes));
            }
            Swal.fire({
                icon: 'success',
                title: 'Bem-vindo(a)!',
                html: `<i class='fi fi-rr-party-horn'></i>  Olá, ${nome.split(' ')[0]}!<br>Cadastro realizado com sucesso.<br>Faça login com seu CPF: <b>${cpf}</b>`
            });
        }

        concluirCadastroUI(cpf);
    } catch (e) {
        console.error(e);
        alert('Erro ao realizar cadastro: ' + e.message);
    }
}

function iniciar2FAAdmin(metodo, contato) {
    // Gerar código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigo2FAEsperado = codigo;

    // Abrir Modal 2FA
    document.getElementById('modal2FA').classList.add('show');

    // Mensagem personalizada baseada na escolha
    const canal = metodo === 'email' ? 'E-MAIL' : 'SMS/WhatsApp';

    // Simular envio (Alert)
    setTimeout(() => {
        alert(`<i class='fi fi-rr-lock'></i>  CÓDIGO DE VERIFICAÇÃO 2FA ENVIADO VIA ${canal} para ${contato}: \n\n${codigo}\n\n(Insira este código na tela para confirmar)`);
    }, 500);
}

let adminPendenteFormData = null; // New variable to store form data across async

async function finalizar2FA(event) {
    event.preventDefault();
    const codigoDigitado = document.getElementById('codigo-2fa').value;

    if (codigoDigitado === codigo2FAEsperado) {
        // Integrado com API
        if (typeof API !== 'undefined' && adminPendenteFormData) {
            try {
                const resp = await API.cadastro(adminPendenteFormData);
                if (resp && resp.sucesso) {
                    const u = resp.usuario;
                    localStorage.setItem('usuarioLogado', 'true');
                    localStorage.setItem('usuarioNome', u.nome);
                    localStorage.setItem('tipoUsuario', u.tipo);
                    localStorage.setItem('usuarioCpf', u.cpf);
                    localStorage.setItem('usuarioId', u.id);
                    localStorage.setItem('usuarioImagem', u.imagem || '');
                    // Manter compatibilidade do LocalStorage offline
                    localStorage.setItem('adminRegistrado', JSON.stringify(adminPendente));

                    alert(`<i class='fi fi-rr-shield'></i>  Administrador Cadastrado com Sucesso!\n\nBem - vindo, ${adminPendente.nome}.`);
                    fecharModal2FA();
                    concluirCadastroUI(adminPendente.cpf);
                    return;
                }
                if (resp && resp.erro) {
                    alert('<i class=\"fi fi-rr-cross-circle\"></i>  ' + resp.erro);
                    return;
                }
            } catch (e) {
                console.error("API falhou no 2FA", e);
            }
        }

        // Fallback localstorage
        localStorage.setItem('adminRegistrado', JSON.stringify(adminPendente));
        alert(`<i class='fi fi-rr-shield'></i>  Administrador Cadastrado com Sucesso!\n\nBem - vindo, ${adminPendente.nome}.`);

        fecharModal2FA();
        concluirCadastroUI(adminPendente.cpf);
    } else {
        alert('<i class=\"fi fi-rr-cross-circle\"></i>  Código incorreto! Tente novamente.');
    }
}

function fecharModal2FA() {
    document.getElementById('modal2FA').classList.remove('show');
    document.getElementById('codigo-2fa').value = '';
    adminPendente = null;
    adminPendenteFormData = null;
    codigo2FAEsperado = null;
}

function concluirCadastroUI(cpf) {
    fecharModalCadastro();
    const form = document.getElementById('formCadastro');
    if (form) form.reset();

    setTimeout(() => {
        abrirModalLogin();
        const cpfLogin = document.getElementById('login-cpf');
        if (cpfLogin) cpfLogin.value = cpf;
    }, 500);
}

function calcularIdade(dataNasc) {
    if (!dataNasc || dataNasc.length !== 10) return 30;
    const partes = dataNasc.split('/');
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const ano = parseInt(partes[2], 10);
    const hoje = new Date();
    const nascimento = new Date(ano, mes, dia);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
    return idade;
}

let emailRecuperacaoTemporario = ''; // Salvar email para o segundo passo

async function finalizarRecuperacao(event) {
    event.preventDefault();

    // Identifica qual passo o formulário atual representa baseado no ID do botão ou input visível
    const divStep1 = document.getElementById('step1-recuperacao');
    const divStep2 = document.getElementById('step2-recuperacao');

    if (divStep1 && divStep1.style.display !== 'none') {
        // --- PASSO 1: SOLICITAR TOKEN TOTVS ---
        const inputContato = document.getElementById('recuperar-contato');
        const contato = inputContato ? inputContato.value.trim() : '';

        if (!contato) { Swal.fire({icon: 'warning', title: 'Atenção', text: 'Informe um E-mail válido.'}); return; }

        if (typeof showHealthLoader === 'function') showHealthLoader('Enviando solicitação...');

        let envioSucesso = false;
        let recebidaData = null;
        if (typeof API !== 'undefined' && API.totvsRecoveryPassword) {
            const resp = await API.totvsRecoveryPassword(contato);
            envioSucesso = resp.sucesso;
            recebidaData = resp.data;

            if (!envioSucesso) {
                if (typeof hideHealthLoader === 'function') hideHealthLoader();

                if (resp.status === 400) {
                    Swal.fire({ icon: 'error', title: 'Formato Inválido', text: 'E-mail não encontrado ou formato inválido.' });
                } else if (resp.status === 404) {
                    Swal.fire({ icon: 'error', title: 'Não Encontrado', text: 'Usuário não encontrado. Verifique o e-mail informado.' });
                } else if (resp.status === 0 || !resp.status) {
                    Swal.fire({ icon: 'warning', title: 'Conexão Bloqueada', text: 'Erro de conexão com a API. Verifique seu firewall ou CORS.' });
                } else {
                    Swal.fire({ icon: 'error', title: 'Erro API', text: `Ocorreu um erro inesperado (Status HTTP ${resp.status}).` });
                }
                return; // Bloqueia o passo 2
            }
        }

        if (typeof hideHealthLoader === 'function') hideHealthLoader();

        emailRecuperacaoTemporario = contato; // Salva para o passo 2

        // Oculta Passo 1 e Mostra Passo 2
        if (divStep1) divStep1.style.display = 'none';
        if (divStep2) divStep2.style.display = 'block';

        const emailExibido = contato.includes('@')
            ? contato.replace(/^(.{2}).+(@.+)$/, '$1***$2')
            : contato;
        let msgAlerta = `Um código de verificação foi enviado para o email corporativo: ${emailExibido}`;
        if (recebidaData && recebidaData.simulated_token) {
            msgAlerta += `\n\n[AMBIENTE DE TESTE]\nUse este Token para prosseguir: ${recebidaData.simulated_token}`;
        }
        Swal.fire({ icon: 'info', title: 'E-mail Enviado', text: msgAlerta });
    } else {
        // --- PASSO 2: APLICAR TOKEN (ChangePasswordWithToken TOTVS) ---
        const tokenInput = document.getElementById('recuperar-token');
        const novaSenhaInput = document.getElementById('recuperar-novasenha');

        const token = tokenInput ? tokenInput.value.trim() : '';
        const novaSenha = novaSenhaInput ? novaSenhaInput.value : '';

        if (!token || !novaSenha) { 
            Swal.fire({ icon: 'warning', title: 'Campos Obrigatórios', text: 'Preencha o Token e a Nova Senha.' });
            return; 
        }

        if (typeof showHealthLoader === 'function') showHealthLoader('Validando token e atualizando senha...');

        let atualizacaoSucesso = false;
        if (typeof API !== 'undefined' && API.totvsChangePasswordWithToken) {
            const resp = await API.totvsChangePasswordWithToken(emailRecuperacaoTemporario, token, novaSenha);
            atualizacaoSucesso = resp.sucesso;
            if (!atualizacaoSucesso) {
                alert('Erro (HTTP ' + resp.status + '): Token inválido, expirado ou senha não cumpre requisitos.');
                if (typeof hideHealthLoader === 'function') hideHealthLoader();
                return;
            }
        } else {
            // Mock Sucesso Local
            atualizacaoSucesso = true;
        }

        if (typeof hideHealthLoader === 'function') hideHealthLoader();

        if (atualizacaoSucesso) {
            Swal.fire({
                icon: 'success',
                title: 'Senha Alterada',
                text: 'Sua senha foi atualizada com sucesso! Você já pode entrar no Portal.'
            });
            fecharModalRecuperar();
            event.target.reset();

            // Retornar formulário para estado inicial para próximas aberturas
            if (divStep1) divStep1.style.display = 'block';
            if (divStep2) divStep2.style.display = 'none';

            setTimeout(abrirModalLogin, 500);
        }
    }
}

// Reset do formulário ao abrir novamente, se o usuário tiver desistido no meio
const originalAbrirModalRecuperar = abrirModalRecuperar;
window.abrirModalRecuperar = function () {
    originalAbrirModalRecuperar();
    const divStep1 = document.getElementById('step1-recuperacao');
    const divStep2 = document.getElementById('step2-recuperacao');
    const form = document.getElementById('formRecuperar');
    if (divStep1) divStep1.style.display = 'block';
    if (divStep2) divStep2.style.display = 'none';
    if (form) form.reset();
    emailRecuperacaoTemporario = '';
}

// Lógica de Sessão e Profile na Navbar
async function verificarSessao() {
    const navAuth = document.querySelector('.nav-auth');
    const navLinks = document.querySelector('.nav-links');

    if (!navAuth) return;

    // 1. Tentar validar sessão real via API
    let sessao = null;
    if (typeof API !== 'undefined') {
        sessao = await API.sessao();
    }

    // 2. Sincronizar LocalStorage com a Sessão Real
    if (sessao && sessao.logado) {
        console.log('Sessão validada pela API:', sessao.usuario.nome);
        localStorage.setItem('usuarioLogado', 'true');
        localStorage.setItem('usuarioNome', sessao.usuario.nome);
        localStorage.setItem('tipoUsuario', sessao.usuario.tipo);
        if (sessao.usuario.tipo === 'admin') localStorage.setItem('adminLogado', 'true');
        if (sessao.usuario.tipo === 'ti') localStorage.setItem('tiLogado', 'true');
    } else if (sessao && !sessao.logado) {
        // A API confirmou explicitamente que NÃO há sessão.
        // Limpamos para que o estado do frontend coincida com o do servidor.
        console.warn('Sessão encerrada no backend. Validando logout no frontend...');
        localStorage.removeItem('usuarioLogado');
        localStorage.removeItem('adminLogado');
        localStorage.removeItem('tiLogado');
        localStorage.removeItem('tipoUsuario');
    }

    const logado = localStorage.getItem('usuarioLogado') === 'true';
    const nome = localStorage.getItem('usuarioNome') || 'Usuário';

    // Limpar conteúdo atual da nav-auth
    navAuth.innerHTML = '';

    // Remover link "Meu Portal Saúde" se já existir (para evitar duplicatas)
    const existingLink = document.getElementById('nav-meu-sus');
    if (existingLink) existingLink.remove();

    // REDIRECIONAMENTO DE ADMIN
    const isAdmin = localStorage.getItem('adminLogado') === 'true';
    if (isAdmin && !window.location.pathname.includes('admin.html') && window.self === window.top) {
        window.location.href = 'admin.html';
        return;
    }

    // REDIRECIONAMENTO DE TI
    const isTI = localStorage.getItem('tiLogado') === 'true';
    if (isTI && !window.location.pathname.includes('ti.html') && window.self === window.top) {
        window.location.href = 'ti.html';
        return;
    }

    if (logado) {
        // 1. Injetar Link "Meu Portal Saúde" na Navbar (Ao lado de Agendamento)
        if (navLinks) {
            const meuSusLink = `
        <a href="perfil.html" id="nav-meu-sus">
                    <i class='fi fi-rr-credit-card'></i>  MEU PORTAL SAÚDE
                </a>
            `;
            navLinks.insertAdjacentHTML('afterbegin', meuSusLink);
        }

        // Link condicional para painéis profissionais
        const tipoUser = (localStorage.getItem('tipoUsuario') || 'paciente').toLowerCase();
        let linkPainelHTML = '';
        if (tipoUser === 'admin') linkPainelHTML = `<a href="admin.html" style="font-size: 0.65rem; color: #ffc107; text-decoration: underline; margin-top: 2px;"><i class="fi fi-rr-apps"></i> Ir para Painel Admin</a>`;
        else if (tipoUser === 'medico' || tipoUser === 'medico_tele') linkPainelHTML = `<a href="medico.html" style="font-size: 0.65rem; color: #4fc3f7; text-decoration: underline; margin-top: 2px;"><i class="fi fi-rr-apps"></i> Ir para Meu Painel</a>`;
        else if (tipoUser === 'enfermeiro') linkPainelHTML = `<a href="enfermeiro.html" style="font-size: 0.65rem; color: #81c784; text-decoration: underline; margin-top: 2px;"><i class="fi fi-rr-apps"></i> Ir para Meu Painel</a>`;
        else if (tipoUser === 'ti') linkPainelHTML = `<a href="ti.html" style="font-size: 0.65rem; color: #ce93d8; text-decoration: underline; margin-top: 2px;"><i class="fi fi-rr-apps"></i> Ir para Painel TI</a>`;

        // 2. Simplificar Perfil no Canto Direito (Apenas Saudação + Logout com Modernização Premium e Dropdown)
        const profileHTML = `
        <div class="profile-dropdown-container">
            <!-- TRIGGER (Pílula que ativa o menu) -->
            <div class="user-profile active">
                <!-- Avatar com Gradiente Premium -->
                <div class="user-avatar-modern">
                    ${nome.charAt(0).toUpperCase()}
                </div>
                <!-- Infos Rápidas -->
                <div class="user-info-modern">
                    <span class="user-welcome-modern">Olá, ${nome.split(' ')[0]}</span>
                    <span class="user-role-badge">${tipoUser === 'paciente' ? 'Paciente' : tipoUser}</span>
                </div>
                <!-- Chevron Animado -->
                <div class="dropdown-chevron-modern">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                </div>
            </div>

            <!-- MENU FLUTUANTE (Dropdown) -->
            <div class="profile-dropdown-menu">
                <!-- Detalhes do Usuário no Cabeçalho do Menu -->
                <div class="dropdown-menu-header">
                    <div class="user-avatar-large">
                        ${nome.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-details-large">
                        <span class="user-name-full">${nome}</span>
                        <span class="user-role-text">
                            <i class="fi fi-rr-shield"></i> ${tipoUser === 'paciente' ? 'Paciente' : tipoUser}
                        </span>
                    </div>
                </div>

                <!-- Links e Ações do Menu -->
                <div class="dropdown-menu-body">
                    <!-- Meu Portal Saúde -->
                    <a href="perfil.html" class="dropdown-menu-item">
                        <i class="fi fi-rr-credit-card"></i>
                        <span>Meu Portal Saúde</span>
                    </a>

                    <!-- Editar Dados Pessoais -->
                    <a href="#" onclick="abrirModalEditarPerfil(event)" class="dropdown-menu-item">
                        <i class="fi fi-rr-edit"></i>
                        <span>Editar Dados Pessoais</span>
                    </a>

                    <!-- Painéis de Acesso Condicional (Profissionais) -->
                    ${linkPainelHTML ? `
                    <div class="dropdown-divider"></div>
                    ${linkPainelHTML}
                    ` : ''}
                </div>

                <!-- Rodapé com Logout Premium -->
                <div class="dropdown-menu-footer">
                    <button onclick="logout()" class="btn-logout-premium">
                        <span class="btn-logout-label">
                            <i class="fi fi-rr-exit"></i>
                            <span>Sair da Conta</span>
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
        `;
        navAuth.insertAdjacentHTML('beforeend', profileHTML);

        // Configurar toggle interativo do dropdown de perfil para dispositivos móveis e cliques
        const dropdownContainer = document.querySelector('.profile-dropdown-container');
        if (dropdownContainer) {
            const trigger = dropdownContainer.querySelector('.user-profile');
            if (trigger) {
                trigger.addEventListener('click', function(e) {
                    e.stopPropagation();
                    dropdownContainer.classList.toggle('show');
                });
            }
            // Fechar ao clicar fora
            document.addEventListener('click', function() {
                dropdownContainer.classList.remove('show');
            });
            // Evitar fechar se clicar dentro do menu, a não ser que seja um link ou botão
            const menu = dropdownContainer.querySelector('.profile-dropdown-menu');
            if (menu) {
                menu.addEventListener('click', function(e) {
                    if (!e.target.closest('a') && !e.target.closest('button')) {
                        e.stopPropagation();
                    }
                });
            }
        }
        
        // Carregar alertas/campanhas apenas após login
        carregarCampanhasHome();
    } else {
        // Criar botões de login/cadastro padrão
        const buttonsHTML = `
            <button class="btn-auth btn-login" onclick="abrirModalLogin()"> LOGIN</button>
        <button class="btn-auth btn-cadastro" onclick="abrirModalCadastro()">CADASTRE-SE</button>
        `;
        navAuth.insertAdjacentHTML('beforeend', buttonsHTML);
    }
}

function logout() {
    console.log('Encerrando sessão...');
    
    const cleaning = () => {
        localStorage.removeItem('usuarioLogado');
        localStorage.removeItem('usuarioNome');
        localStorage.removeItem('tipoUsuario');
        localStorage.removeItem('usuarioCpf');
        localStorage.removeItem('usuarioId');
        localStorage.removeItem('adminLogado');
        localStorage.removeItem('tiLogado');
        
        // Se estiver no perfil, voltar para home
        if (window.location.pathname.includes('perfil.html')) {
            window.location.href = 'index.html';
        } else {
            window.location.reload();
        }
    };

    if (typeof API !== 'undefined') {
        API.logout().finally(cleaning);
    } else {
        cleaning();
    }
}



// ==========================================
// FUNÇÕES DO SLIDER ANIMADO DE NOTÍCIAS (CARTÕES EMPILHADOS)
// ==========================================
function moverSliderNoticia(direcao) {
    if (!noticias || noticias.length <= 1) return;

    // Calcula novo índice com wrap-around infinito
    noticiaAtual = noticiaAtual + direcao;
    if (noticiaAtual >= noticias.length) {
        noticiaAtual = 0;
    } else if (noticiaAtual < 0) {
        noticiaAtual = noticias.length - 1;
    }

    atualizarSliderNoticia();
}

function atualizarSliderNoticia() {
    const slides = document.querySelectorAll('.news-slide-item');
    const total = slides.length;
    if (total === 0) return;

    // Cálculo de escala dinâmica para a responsividade do efeito 3D
    const width = window.innerWidth;
    const isMobile = width < 768;
    const scaleFactor = isMobile ? (width / 1100) : 1; // Ajusta a escala proporcional à tela em dispositivos menores

    slides.forEach((slide, index) => {
        let diff = index - noticiaAtual;
        if (diff > total / 2) diff -= total;
        if (diff < -total / 2) diff += total;

        if (diff === 0) {
            slide.style.transform = `translate3d(-50%, -50%, 180px) translateX(0) rotateY(0deg) scale(1)`;
            slide.style.zIndex = 50;
            slide.style.opacity = 1;
            slide.style.visibility = 'visible';
            slide.style.pointerEvents = 'auto';
            slide.style.filter = 'brightness(1)';
            slide.style.display = 'flex';
        }
        else {
            const direction = diff > 0 ? 1 : -1;
            const distance = Math.abs(diff);
            // Cálculo dinâmico para garantir que a pilha 3D caiba em qualquer tela
            // Compactando a pilha no mobile para evitar cortes laterais (clipping)
            // Ajuste ultra-radical para liberar o texto central em 750px
            const baseTranslateX = isMobile ? 120 : 420; 
            const extraTranslateX = isMobile ? 40 : 80;
            const baseTranslateZ = isMobile ? -150 : -400;
            
            // Cards laterais menores e mais rotacionados
            const scaleFactor = isMobile ? 0.8 : 0.65;
            const opacityFactor = 0.5;

            const translateX = (baseTranslateX * direction) + (distance * extraTranslateX * direction);
            const translateZ = baseTranslateZ * distance;
            const rotateY = -60 * direction; // Rotação acentuada para liberar o centro

            if (distance <= 2) {
                slide.style.transform = `translate3d(-50%, -50%, ${translateZ}px) translateX(${translateX}px) rotateY(${rotateY}deg) scale(${distance === 0 ? 1 : scaleFactor})`;
                slide.style.zIndex = 40 - distance;
                slide.style.opacity = distance === 0 ? 1 : (distance === 1 ? 0.45 : 0.25);
                slide.style.pointerEvents = distance === 0 ? 'auto' : 'none';
                slide.style.filter = `brightness(${1 - (distance * 0.35)}) blur(${distance * 2}px)`;
                slide.style.visibility = 'visible';
                slide.style.display = 'flex';
            } else {
                slide.style.transform = `translate3d(-50%, -50%, -650px) translateX(${300 * direction * scaleFactor}px) rotateY(${rotateY}deg) scale(0.5)`;
                slide.style.zIndex = 0;
                slide.style.opacity = 0;
                slide.style.pointerEvents = 'none';
                slide.style.visibility = 'hidden';
                slide.style.display = 'none';
            }
        }
    });
}


// ==========================================
// MÓDULO: MAPA 3D DO CORPO HUMANO (DOENÇAS)
// ==========================================

// Mapeamento de Coordenadas (Usado agora como um menu de Pinos HUD ao redor do modelo 3D)
const organCoordinates = {
    'Cérebro': { top: '15%', left: '10%' },
    'Pulmão': { top: '30%', left: '10%' },
    'Coração': { top: '45%', left: '10%' },
    'Estômago': { top: '60%', left: '10%' },
    'Intestino': { top: '75%', left: '10%' },
    'Olhos': { top: '82%', left: '10%' },
    'Boca': { top: '89%', left: '10%' },
    'Perna': { top: '96%', left: '10%' }
};

// Mapeamento de Órgãos para Imagens Estilizadas 3D
const organImageModels = {
    'Coração': 'assets/organs/heart_3d_stylized.png',
    'Cérebro': 'assets/organs/brain_3d_stylized.png',
    'Pulmão': 'assets/organs/lungs_3d_stylized.png',
    'Estômago': 'assets/organs/lungs_3d_stylized.png',
    'Intestino': 'assets/organs/lungs_3d_stylized.png',
    'Olhos': 'assets/organs/eyes_3d_stylized.png',
    'Boca': 'assets/organs/mouth_3d_stylized.png',
    'Perna': 'assets/organs/human_body_3d_stylized.png',
    'default': 'assets/organs/human_body_3d_stylized.png'
};

/* ==========================================================================
   CARROSSEL VERTICAL 3D DE DOENÇAS
   ========================================================================== */

let verticalDiseasesData = [];
let verticalCurrentIndex = 0;
let verticalAutoPlayTimer = null;

function startVerticalAutoPlay() {
    stopVerticalAutoPlay();
    verticalAutoPlayTimer = setInterval(() => {
        moveToVerticalSlide(verticalCurrentIndex + 1);
    }, 5000);
}

function stopVerticalAutoPlay() {
    if (verticalAutoPlayTimer) {
        clearInterval(verticalAutoPlayTimer);
        verticalAutoPlayTimer = null;
    }
}

async function initVerticalCarousel() {
    const track = document.getElementById('verticalCarouselTrack');
    const dotsContainer = document.getElementById('verticalDotsContainer');
    if (!track) return;

    const infoCard = document.querySelector('.vertical-disease-info');
    const infoContent = document.getElementById('diseaseInfoContent');

    let doencasFinal = [];

    // 1) Fetch from API (fonte de verdade)
    try {
        if (typeof API !== 'undefined' && typeof API.doencasPublic === 'function') {
            const resp = await API.doencasPublic();
            if (Array.isArray(resp) && resp.length > 0) {
                doencasFinal = resp;
                localStorage.setItem('admin_doencas_corpo', JSON.stringify(resp));
            }
        }
    } catch (e) { console.warn('API de doenças indisponível. Usando cache local.', e); }

    // 2) Fallback: localStorage
    if (doencasFinal.length === 0) {
        try {
            const local = localStorage.getItem('admin_doencas_corpo');
            if (local && !local.includes('hypertension_3d_card')) {
                doencasFinal = JSON.parse(local);
            } else if (local) {
                // Clear old broken cache
                localStorage.removeItem('admin_doencas_corpo');
            }
        } catch (e) { console.warn('Erro ao ler localStorage:', e); }
    }

    // 3) Seed embutido
    if (doencasFinal.length === 0) {
        doencasFinal = [
            { titulo: "Hipertensão", bg_class: "bg-hipertensao", icone: "<i class='fi fi-rr-heart'></i> ", imagem: "assets/organs/heart_3d_stylized.png", gravidade: "Alta", especialista: "Cardiologista", encaminhamento: "Clínico Geral (UBS)", o_que_e: "A pressão alta crônica força o coração a trabalhar muito além do normal." },
            { titulo: "Diabetes", bg_class: "bg-diabetes", icone: "<i class='fi fi-rr-syringe'></i> ", imagem: "assets/organs/human_body_3d_stylized.png", gravidade: "Alta", especialista: "Endocrinologista", encaminhamento: "Clínico Geral para exames de rotina", o_que_e: "Doença crônica de uso inadequado da insulina." },
            { titulo: "Asma", bg_class: "bg-dengue", icone: "<i class='fi fi-rr-lungs'></i> ", imagem: "assets/organs/lungs_3d_stylized.png", gravidade: "Média", especialista: "Pneumologista", encaminhamento: "Clínico Geral", o_que_e: "Inflamação crônica das vias respiratórias." },
            { titulo: "Depressão", bg_class: "bg-mental", icone: "<i class='fi fi-rr-brain'></i> ", imagem: "assets/organs/brain_3d_stylized.png", gravidade: "Alta", especialista: "Psiquiatra", encaminhamento: "UBS para acolhimento", o_que_e: "Distúrbio mental grave e tratável." },
            { titulo: "COVID-19", bg_class: "bg-vacina", icone: "<i class='fi fi-rr-virus'></i> ", imagem: "assets/organs/lungs_3d_stylized.png", gravidade: "Média/Alta", especialista: "Infectologista", encaminhamento: "UPA em caso de falta de ar", o_que_e: "Infecção respiratória que varia de leve a severa." }
        ];
    }

    verticalDiseasesData = doencasFinal;
    if (verticalCurrentIndex >= verticalDiseasesData.length) {
        verticalCurrentIndex = 0;
    }

    track.innerHTML = '';
    if (dotsContainer) dotsContainer.innerHTML = '';

    verticalDiseasesData.forEach((doenca, index) => {
        const card = document.createElement('div');
        const bgClass = doenca.bg_class || doenca.bgClass || 'bg-diabetes';
        const imgSrc  = doenca.imagem   || doenca.img   || '';
        const nome    = doenca.titulo   || doenca.nome  || 'Doença';
        const icone   = doenca.icone    || doenca.icon  || '<i class=\"fi fi-rr-stethoscope\"></i> ';
        card.className = `vertical-card ${bgClass}`;

        let imgHtml = '';
        if (imgSrc) imgHtml = `<img src="${imgSrc}" alt="${nome}" onerror="this.src='https://via.placeholder.com/400x225?text=${encodeURIComponent(nome)}'">`;

        card.innerHTML = `${imgHtml}<div class="overlay-text" style="display:none;">${icone}</div>`;
        card.onclick = () => moveToVerticalSlide(index);
        track.appendChild(card);

        if (dotsContainer) {
            const dot = document.createElement('div');
            dot.className = 'vertical-dot';
            dot.onclick = () => moveToVerticalSlide(index);
            dotsContainer.appendChild(dot);
        }
    });

    const btn = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    btn('verticalNextBtn',       () => moveToVerticalSlide(verticalCurrentIndex - 1));
    btn('verticalPrevBtn',       () => moveToVerticalSlide(verticalCurrentIndex + 1));
    btn('verticalNextBtnMobile', () => moveToVerticalSlide(verticalCurrentIndex - 1));
    btn('verticalPrevBtnMobile', () => moveToVerticalSlide(verticalCurrentIndex + 1));

    setupVerticalDrag(track);
    
    // Auto-Play Interactions
    track.addEventListener('mouseenter', stopVerticalAutoPlay);
    track.addEventListener('mouseleave', startVerticalAutoPlay);
    if (infoCard) {
        infoCard.addEventListener('mouseenter', stopVerticalAutoPlay);
        infoCard.addEventListener('mouseleave', startVerticalAutoPlay);
    }

    if (infoCard) infoCard.classList.remove('switching');
    if (infoContent) infoContent.classList.remove('fade-out');
    
    updateVerticalCarousel();
    startVerticalAutoPlay();
}


function moveToVerticalSlide(index) {
    const total = verticalDiseasesData.length;
    // Circular
    if (index < 0) index = total - 1;
    if (index >= total) index = 0;

    verticalCurrentIndex = index;
    updateVerticalCarousel();
}

function updateVerticalCarousel() {
    const track = document.getElementById('verticalCarouselTrack');
    if (!track) return;
    const cards = track.querySelectorAll('.vertical-card');
    const dotsContainer = document.getElementById('verticalDotsContainer');
    const dots = dotsContainer ? dotsContainer.querySelectorAll('.vertical-dot') : [];
    const total = cards.length;

    cards.forEach(card => {
        card.className = card.className.split(' ').filter(c => !['center', 'up-1', 'up-2', 'down-1', 'down-2', 'hidden'].includes(c)).join(' ');
        card.classList.add('hidden');
    });

    dots.forEach(dot => dot.classList.remove('active'));

    if (total === 0) return;

    // Center
    cards[verticalCurrentIndex].classList.remove('hidden');
    cards[verticalCurrentIndex].classList.add('center');
    dots[verticalCurrentIndex].classList.add('active');

    const assigned = new Set([verticalCurrentIndex]);

    const assign = (idx, cls) => {
        if (!assigned.has(idx)) {
            cards[idx].classList.remove('hidden');
            cards[idx].classList.add(cls);
            assigned.add(idx);
        }
    };

    if (total >= 2) {
        assign((verticalCurrentIndex + 1) % total, 'down-1');
        assign((verticalCurrentIndex - 1 + total) % total, 'up-1');
    }
    if (total >= 4) {
        assign((verticalCurrentIndex + 2) % total, 'down-2');
        assign((verticalCurrentIndex - 2 + total) % total, 'up-2');
    }

    updateVerticalDiseaseInfo(verticalDiseasesData[verticalCurrentIndex]);
}

function updateVerticalDiseaseInfo(doenca) {
    if (!doenca) return;
    const card = document.querySelector('.vertical-disease-info');
    const content = document.getElementById('diseaseInfoContent');
    if (!card) return;

    // Normaliza campos (API: titulo/icone/o_que_e | localStorage: nome/icon/descricao)
    const nome      = doenca.titulo  || doenca.nome      || 'Doença';
    const icone     = (doenca.icone || doenca.icon || '<i class="fi fi-rr-stethoscope"></i> ').trim();
    const descricao = doenca.o_que_e || doenca.descricao || 'Informações em breve...';

    card.classList.add('switching');
    if (content) content.classList.add('fade-out');
    setTimeout(() => {
        const badge            = document.getElementById('verticalIconBadge');
        const title            = document.getElementById('verticalDiseaseTitle');
        const especialistaEl   = document.getElementById('verticalEspecialista');
        const encaminhamentoEl = document.getElementById('verticalEncaminhamento');
        const desc             = document.getElementById('verticalDiseaseDesc');

        if (badge)            badge.innerHTML              = icone;
        if (title)            title.textContent            = nome;
        if (especialistaEl)   especialistaEl.textContent   = doenca.especialista   || 'N/A';
        if (encaminhamentoEl) encaminhamentoEl.textContent = doenca.encaminhamento || 'N/A';
        if (desc)             desc.textContent             = descricao;

        if (content) content.classList.remove('fade-out');
        card.classList.remove('switching');
    }, 500);
}

// Lógica para Drag Vertical
function setupVerticalDrag(track) {
    let startY = 0;
    let isDragging = false;
    let movedY = 0;

    track.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.pageY;
        stopVerticalAutoPlay();
    });

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;

        if (movedY > 50) {
            moveToVerticalSlide(verticalCurrentIndex - 1);
        } else if (movedY < -50) {
            moveToVerticalSlide(verticalCurrentIndex + 1);
        }
        movedY = 0;
    });

    track.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        movedY = e.pageY - startY;
    });

    // Touch events for mobile
    track.addEventListener('touchstart', (e) => {
        startY = e.touches[0].pageY;
        stopVerticalAutoPlay();
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
        // movedY has to be calculated in touchmove
        if (movedY > 50) {
            moveToVerticalSlide(verticalCurrentIndex - 1);
        } else if (movedY < -50) {
            moveToVerticalSlide(verticalCurrentIndex + 1);
        }
        movedY = 0;
    });


    track.addEventListener('touchmove', (e) => {
        movedY = e.touches[0].pageY - startY;
    }, { passive: true });
}

/* ==========================================================================
   MÓDULO: CAMPANHAS ATIVAS (HOME)
   Exibe banners de campanhas do sistema vindas do banco de dados
   ========================================================================== */
async function carregarCampanhasHome() {
    const container = document.getElementById('home-campanhas-alert');
    if (!container) return;

    if (typeof API === 'undefined') return;

    try {
        const campanhas = await API.campanhasPublic();
        if (!campanhas || !Array.isArray(campanhas) || campanhas.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        // Filtra para mostrar apenas a primeira campanha "Ativa" (status 1, 'Ativa' ou 'ativo')
        const c = campanhas.find(x => x.status == 1 || String(x.status).toLowerCase() === 'ativa' || String(x.status).toLowerCase() === 'ativo') || campanhas[0];
        
        container.style.display = 'block';
        container.innerHTML = `
            <div class="home-campanha-banner">
                <div class="home-campanha-icon">📢</div>
                <div class="home-campanha-content">
                    <h4>Campanha Ativa: ${c.titulo || c.nome || 'Campanha de Saúde'}</h4>
                    <p>${c.resumo || c.descricao || 'Fique atento às nossas campanhas de saúde.'}</p>
                </div>
            </div>
        `;
        console.log('Home: Campanha ativa carregada para usuário logado.');

    } catch (err) {
        console.error('Erro ao carregar campanhas na home:', err);
    }
}

// ── MODAL EDIÇÃO DE PERFIL ───────────────────────────────────────
function injetarModalEdicaoPerfil() {
    if (document.getElementById('modalEditarPerfil')) return;

    const modalHTML = `
    <div id="modalEditarPerfil" class="modal-wrapper" style="display: none; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.6); position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2000; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); transition: all 0.3s ease;">
        <div class="modal-auth-card" style="display: flex !important; flex-direction: column !important; align-items: stretch !important; padding: 0 !important; background: white; width: 92%; max-width: 460px; border-radius: 24px; overflow: hidden; position: relative; border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); animation: modalPulse 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">
            
            <!-- CABEÇALHO DO MODAL -->
            <div style="width: 100%; background: linear-gradient(135deg, #0284c7, #0369a1); color: white; padding: 25px 30px; text-align: left; position: relative;">
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 10px; letter-spacing: -0.5px;">
                    <i class="fi fi-rr-edit" style="font-size: 1.35rem; color: #e0f2fe;"></i> Editar Dados Pessoais
                </h3>
                <p style="margin: 5px 0 0 0; font-size: 0.72rem; color: rgba(224, 242, 254, 0.8); font-weight: 500;">Mantenha suas informações sempre atualizadas no portal</p>
                <button type="button" onclick="fecharModalEditarPerfil()" style="position: absolute; top: 22px; right: 22px; width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 255, 255, 0.15); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; line-height: 1; transition: all 0.2s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.25)'; this.style.transform='rotate(90deg)';" onmouseout="this.style.background='rgba(255, 255, 255, 0.15)'; this.style.transform='none';">&times;</button>
            </div>
            
            <!-- CORPO DO MODAL -->
            <div style="width: 100%; padding: 25px 30px 30px 30px; text-align: left;">
                <form id="formEditarPerfil" onsubmit="salvarEdicaoPerfil(event)">
                    
                    <!-- CPF (Somente Leitura) -->
                    <div class="input-group" style="margin-bottom: 18px;">
                        <label style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">CPF (Não alterável)</label>
                        <input type="text" id="edit-perfil-cpf" readonly style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #cbd5e1; background: #f1f5f9; color: #94a3b8; font-size: 0.9rem; cursor: not-allowed; font-weight: 500;">
                    </div>
                    
                    <!-- Nome Completo -->
                    <div class="input-group" style="margin-bottom: 18px;">
                        <label style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">Nome Completo</label>
                        <input type="text" id="edit-perfil-nome" required style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-size: 0.9rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; font-weight: 500;" onfocus="this.style.borderColor='#0284c7'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(2, 132, 199, 0.12)';" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'; this.style.boxShadow='none';">
                    </div>
                    
                    <!-- Data de Nascimento -->
                    <div class="input-group" style="margin-bottom: 18px;">
                        <label style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">Data de Nascimento</label>
                        <input type="date" id="edit-perfil-nasc" style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-size: 0.9rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; font-weight: 500;" onfocus="this.style.borderColor='#0284c7'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(2, 132, 199, 0.12)';" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'; this.style.boxShadow='none';">
                    </div>
                    
                    <!-- Cartão SUS -->
                    <div class="input-group" style="margin-bottom: 18px;">
                        <label style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">Número do Cartão SUS</label>
                        <input type="text" id="edit-perfil-sus" placeholder="Se não possuir, deixe em branco" style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-size: 0.9rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; font-weight: 500;" onfocus="this.style.borderColor='#0284c7'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(2, 132, 199, 0.12)';" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'; this.style.boxShadow='none';">
                    </div>
                    
                    <!-- Senha -->
                    <div class="input-group" style="margin-bottom: 24px;">
                        <label style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">Nova Senha (Opcional)</label>
                        <input type="password" id="edit-perfil-senha" placeholder="Deixe em branco para manter a atual" style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-size: 0.9rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; font-weight: 500;" onfocus="this.style.borderColor='#0284c7'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(2, 132, 199, 0.12)';" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'; this.style.boxShadow='none';">
                    </div>
                    
                    <!-- BOTÕES -->
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="button" onclick="fecharModalEditarPerfil()" style="flex: 1; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.2); color: #ef4444; padding: 14px; border-radius: 12px; font-weight: 600; font-size: 0.92rem; cursor: pointer; transition: all 0.3s ease; display: inline-flex; align-items: center; justify-content: center; gap: 6px;" onmouseover="this.style.background='#ef4444'; this.style.color='white'; this.style.boxShadow='0 8px 20px rgba(239, 68, 68, 0.15)';" onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.color='#ef4444'; this.style.boxShadow='none';">
                            Cancelar
                        </button>
                        <button type="submit" style="flex: 1; background: #0284c7; border: none; color: white; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 0.92rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: inline-flex; align-items: center; justify-content: center; gap: 6px;" onmouseover="this.style.background='#0369a1'; this.style.boxShadow='0 8px 24px rgba(2, 132, 199, 0.25)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#0284c7'; this.style.boxShadow='none'; this.style.transform='none';" onmousedown="this.style.transform='translateY(1px)';" onmouseup="this.style.transform='translateY(-1px)';">
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <!-- Animação do surgimento do modal -->
    <style>
    @keyframes modalPulse {
        from { transform: scale(0.9) translateY(20px); opacity: 0; }
        to { transform: scale(1) translateY(0); opacity: 1; }
    }
    </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.abrirModalEditarPerfil = function(event) {
    if (event) event.preventDefault();
    injetarModalEdicaoPerfil();

    // Carregar dados
    const cpf = localStorage.getItem('usuarioCpf') || '';
    const nome = localStorage.getItem('usuarioNome') || '';
    const sus = localStorage.getItem('usuarioSUS') || '';
    
    // Tentar pegar a data de nascimento do objeto de registro se existir
    let dataNasc = '';
    const objKeys = ['adminRegistrado', 'medicoRegistrado', 'enfermeiroRegistrado', 'pacienteRegistrado']; 
    
    for (const key of objKeys) {
        const str = localStorage.getItem(key);
        if (str) {
            try {
                const obj = JSON.parse(str);
                if (obj.cpf === cpf && obj.dataNascimento) {
                    dataNasc = obj.dataNascimento;
                    break;
                }
            } catch(e) {}
        }
    }
    
    document.getElementById('edit-perfil-cpf').value = cpf;
    document.getElementById('edit-perfil-nome').value = nome;
    document.getElementById('edit-perfil-sus').value = sus;
    document.getElementById('edit-perfil-nasc').value = dataNasc;
    document.getElementById('edit-perfil-senha').value = '';

    document.getElementById('modalEditarPerfil').style.display = 'flex';
}

window.fecharModalEditarPerfil = function() {
    const modal = document.getElementById('modalEditarPerfil');
    if (modal) modal.style.display = 'none';
}

window.salvarEdicaoPerfil = function(event) {
    event.preventDefault();
    
    const novoNome = document.getElementById('edit-perfil-nome').value.trim();
    const novoSus = document.getElementById('edit-perfil-sus').value.trim();
    const novaSenha = document.getElementById('edit-perfil-senha').value.trim();
    const novoNasc = document.getElementById('edit-perfil-nasc').value;
    
    // Atualizar LocalStorage Base
    if (novoNome) localStorage.setItem('usuarioNome', novoNome);
    if (novoSus) localStorage.setItem('usuarioSUS', novoSus);
    
    // Atualizar Objetos de Profissionais se existirem
    const cpfAtivo = localStorage.getItem('usuarioCpf');
    const objKeys = ['adminRegistrado', 'medicoRegistrado', 'enfermeiroRegistrado'];
    
    objKeys.forEach(key => {
        let str = localStorage.getItem(key);
        if (str) {
            try {
                let obj = JSON.parse(str);
                if (obj.cpf === cpfAtivo) {
                    if (novoNome) obj.nome = novoNome;
                    if (novoSus) obj.sus = novoSus;
                    if (novoNasc) obj.dataNascimento = novoNasc;
                    if (novaSenha) obj.senha = novaSenha;
                    localStorage.setItem(key, JSON.stringify(obj));
                }
            } catch(e){}
        }
    });

    fecharModalEditarPerfil();
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Perfil Atualizado',
            text: 'Seus dados foram atualizados com sucesso!'
        }).then(() => {
            // Atualizar o cabeçalho imediatamente
            if (typeof atualizarInterfaceLogin === 'function') {
                atualizarInterfaceLogin();
            }
            // Forçar reload hard se estiver no panel específico
            const path = window.location.pathname;
            if (path.includes('medico.html') || path.includes('enfermeiro.html') || path.includes('admin.html') || path.includes('ti.html') || path.includes('painel_telemedicina.html')) {
                window.location.reload();
            }
        });
    } else {
        alert("Dados atualizados com sucesso!");
        window.location.reload();
    }
}
