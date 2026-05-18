const fs = require('fs');

const repairStr = `        const step = 360 / slides3D.length;
        // Ajustar o ângulo para ser o mais próximo do atual (evitar giros bruscos)
        const currentRot = Math.round(carousel3dAngle / 360) * 360;
        carousel3dAngle = currentRot - (index * step);
        spinner.style.transition = 'transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
        spinner.style.transform = \`translateZ(var(--tz, -425px)) rotateY(\${carousel3dAngle}deg)\`;
        atualizarDots3D();
        startAutoPlay();
    };

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
        spinner.style.transform = \`translateZ(var(--tz, -425px)) rotateY(\${carousel3dAngle + diff}deg)\`;
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
            spinner.style.transform = \`translateZ(var(--tz, -425px)) rotateY(\${carousel3dAngle}deg)\`;
            atualizarDots3D();
        }
        startAutoPlay();
    });
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
    countSpan.innerText = \`\${index + 1} de \${slides3D.length}\`;
}

// --- VERIFICAR AGENDAMENTOS ---
async function checkAppointments() {
    const container = document.getElementById('home-appointment-alert');
    if (!container) return;

    let agendamentos = [];
    if (typeof API !== 'undefined') {
        agendamentos = await API.minhasConsultas();
    }

    if (!agendamentos || agendamentos.length === 0) {
        agendamentos = JSON.parse(localStorage.getItem('agendamentos') || '[]');
    }

    if (agendamentos.length === 0) return;

    const meuCpf = localStorage.getItem('usuarioCpf') || JSON.parse(localStorage.getItem('usuarioRegistrado') || '{}').cpf;
    const isLogged = localStorage.getItem('usuarioLogado') === 'true';

    // Pegar o mais recente pendente
    let pendentes = agendamentos.filter(a => (a.status === 'Agendado' || a.status === 'Confirmado' || a.status === 'confirmada'));
    if (pendentes.length === 0) return;

    // Para o alerta da home, pegamos o proximo
    const ultimo = pendentes[0];

    // Calcular se esta no horario (30 min antes ate 1h depois)
    let isTime = false;
    let buttonHtml = '';

    if (ultimo.data && ultimo.hora) {
        const appointmentTime = new Date(\`\${ultimo.data}T\${ultimo.hora}:00\`);
        const now = new Date();
        const diffMin = (appointmentTime - now) / (1000 * 60);

        if (diffMin <= 30 && diffMin >= -60) {
            isTime = true;
        }

        if (!isLogged) {
            buttonHtml = \`<button onclick="abrirModalLogin()" class="btn-enter-video" style="background:var(--primary-color); border:none; cursor:pointer;">Faça LOGIN para entrar</button>\`;
        } else if (isTime) {
            buttonHtml = \`<a href="telemedicina.html?sala=ativa&id=\${ultimo.id}" class="btn-enter-video">ENTRAR NA SALA DE ESPERA</a>\`;
        } else {
            const diaFmt = appointmentTime.toLocaleDateString('pt-BR');
            buttonHtml = \`<button class="btn-enter-video" disabled style="background:#ccc; cursor:not-allowed; border:none; color:#666;">Aguarde \${diaFmt} às \${ultimo.hora}</button>\`;
        }
    }

    container.innerHTML = \`
        <div class="appointment-alert-card">
            <div class="appointment-info">
                <h3>📅 Próxima Consulta: \${ultimo.medico || ultimo.medicoNome || 'Médico'}</h3>
                <p>\${ultimo.especialidade} • \${ultimo.data} às \${ultimo.hora}</p>
                <small>Realize sua consulta de onde estiver.</small>
            </div>
            \${buttonHtml}
        </div>
    \`;
}

// ====================================================================
// MODAL DE NOTÍCIAS
// ====================================================================

let hashCarrossel = "";
let hashNoticias = "";
let hashStats = "";
let slides3D = []; // Array do Carrossel 3D Administrativo

// --- CONFIGURAÇÃO DINÂMICA (ADMIN) ---
// Ler dados do localStorage ou usar padrão (se ainda não foi salvo pelo Admin)
function carregarDadosDinamicos() {
    carregarCarouselDinamico();
    carregarNoticiasDinamicas();
    carregarStatsDinamicos();
    carregarCampanhasPublicas();
}

async function carregarCarouselDinamico() {
    const spinner = document.getElementById('carousel3dSpinner');
    if (!spinner) return;

    let slidesAPI = [];
    let noticiasAPI = [];
    if (typeof API !== 'undefined' && typeof API.carrosselPublic === 'function') {
        const respC = await API.carrosselPublic();
        if (respC && !respC.erro) slidesAPI = respC;
        
        if (typeof API.noticiasPublic === 'function') {
            const respN = await API.noticiasPublic();
            if (respN && !respN.erro) noticiasAPI = respN;
        }
    }

    let slidesLocal = JSON.parse(localStorage.getItem('admin_carrossel') || '[]');
    let noticiasLocal = JSON.parse(localStorage.getItem('admin_noticias') || '[]');
    
    let todasNoticias = [...noticiasAPI];
    noticiasLocal.forEach(nl => { if(!todasNoticias.find(n => n.id === nl.id)) todasNoticias.push(nl); });

    let destaquesNoticias = todasNoticias.filter(n => parseInt(n.destaque_carrossel) === 1).map(n => ({
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

    if (slides3D.length === 0) {
        spinner.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-weight: bold; transform: translateZ(300px); font-size: 1.5rem;">Nenhum destaque ativo.<br><span style="font-size: 0.9rem;">(Acesse o Painel Admin para adicionar imagens ao carrossel)</span></div>';
        return;
    }

`;

const buf = Buffer.from(repairStr).toString('base64');
const content = fs.readFileSync('home.js', 'utf8');

// I will find exact string "        const step = 360 / slides3D.length;"
const idxStart = content.indexOf("        const step = 360 / slides3D.length;");
if (idxStart === -1) { console.error("Could not find start index"); process.exit(1); }

// I will find where `    if (dotsContainer) dotsContainer.innerHTML = '';` is. Actually, I want to find where `if (slides3D.length === 0)` ENDS.
// My mistake in `home.js` currently looks like:
/*
    window.girarParaSlide3D = function (index) {
        if (!slides3D || slides3D.length === 0) return;
        stopAutoPlay();
        const step = 360 / slides3D.length;
    if (dotsContainer) dotsContainer.innerHTML = '';
*/

const searchLine = "    if (dotsContainer) dotsContainer.innerHTML = '';";
const idxSearch = content.indexOf(searchLine, idxStart);
if (idxSearch === -1) { console.error("Could not find search line"); process.exit(1); }

// Wait, the block continues with:
/*
    // Criar Cartões 3D baseados nos Slides Administrativos
    slides3D.forEach((slide, index) => {
*/
// It doesn't have `const novoHash` anymore!
// Wait! `carregarDadosDinamicos` DOES NOT have `spinner.innerHTML = '';` or `dotsContainer.innerHTML = '';` before my replacement!
// My replacement text has:
/*
    if (slides3D.length === 0) {
        ...
        return;
    }
*/
// I will just append `    const novoHash = JSON.stringify(slides3D.map(n => n.id)); // Hash simplificado para evitar re-render constante\n    if (novoHash === hashCarrossel) return;\n    hashCarrossel = novoHash;\n    spinner.innerHTML = '';\n` right before `if (dotsContainer) dotsContainer.innerHTML = '';`!

const fullRepairStr = Buffer.from(buf, 'base64').toString('utf8') + `    const novoHash = JSON.stringify(slides3D.map(n => n.id)); // Hash simplificado para evitar re-render constante
    if (novoHash === hashCarrossel) return;
    hashCarrossel = novoHash;

    spinner.innerHTML = '';
`;

const finalCode = content.substring(0, idxStart) + fullRepairStr + content.substring(idxSearch);
fs.writeFileSync('home.js', finalCode, 'utf8');

console.log("SUCCESS!");
