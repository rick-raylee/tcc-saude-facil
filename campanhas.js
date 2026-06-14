/* ==========================================================================
   CAMPANHAS.JS - Lógica e Dados das Campanhas de Saúde
   ========================================================================== */

// --- DADOS DAS CAMPANHAS ---
const campanhasData = [
    {
        id: 1,
        titulo: "Outubro Rosa",
        categoria: "prevencao",
        status: "ativo",
        dataInicio: "01/10/2026",
        dataFim: "31/10/2026",
        icone: "<i class='fi fi-rr-stethoscope'></i> ",
        resumo: "Campanha de prevenção ao câncer de mama.",
        descricao: "O Outubro Rosa é um movimento internacional de conscientização para o controle do câncer de mama. O objetivo é compartilhar informações e promover a conscientização sobre a doença; proporcionar maior acesso aos serviços de diagnóstico e de tratamento e contribuir para a redução da mortalidade.",
        publicoAlvo: "Mulheres a partir de 40 anos",
        local: "Todas as Unidades Básicas de Saúde (UBS)",
        documentos: "Cartão SUS, RG e CPF"
    },
    {
        id: 2,
        titulo: "Novembro Azul",
        categoria: "prevencao",
        status: "aguardando",
        dataInicio: "01/11/2026",
        dataFim: "30/11/2026",
        icone: "💙",
        resumo: "Prevenção ao câncer de próstata.",
        descricao: "O Novembro Azul reforça a importância da prevenção e do diagnóstico precoce do câncer de próstata. A doença é o segundo tipo de câncer mais comum entre os homens brasileiros. As maiores vítimas são homens a partir de 50 anos.",
        publicoAlvo: "Homens a partir de 45 anos",
        local: "Clínicas da Família e UBS",
        documentos: "Documento com foto e Cartão SUS"
    },
    {
        id: 3,
        titulo: "Saúde Bucal nas Escolas",
        categoria: "infantil",
        status: "ativo",
        dataInicio: "15/02/2026",
        dataFim: "15/12/2026",
        icone: "🦷",
        resumo: "Atendimento odontológico preventivo para estudantes.",
        descricao: "Programa que visa promover a saúde bucal no ambiente escolar, com palestras educativas, escovação supervisionada e aplicação tópica de flúor.",
        publicoAlvo: "Crianças e adolescentes da rede pública",
        local: "Escolas Municipais e Estaduais",
        documentos: "Autorização dos pais"
    },
    {
        id: 4,
        titulo: "Hipertensão e Diabetes",
        categoria: "cronicos",
        status: "ativo",
        dataInicio: "01/01/2026",
        dataFim: "31/12/2026",
        icone: "<i class='fi fi-rr-heart'></i> ",
        resumo: "Triagem e acompanhamento contínuo.",
        descricao: "Acompanhamento mensal para portadores de hipertensão e diabetes, com entrega de medicação gratuita e verificação de pressão arterial e glicemia.",
        publicoAlvo: "Portadores de doenças crônicas",
        local: "Farmácias Popular e UBS",
        documentos: "Receita médica atualizada e Cartão SUS"
    },
    {
        id: 5,
        titulo: "Vacinação Infantil",
        categoria: "vacinacao",
        status: "ativo",
        dataInicio: "Permanente",
        dataFim: "Permanente",
        icone: "🧒",
        resumo: "Atualização da caderneta de vacinação.",
        descricao: "Manter a vacinação em dia é fundamental para proteger as crianças contra diversas doenças graves. Traga a caderneta de vacinação para conferência.",
        publicoAlvo: "Crianças de 0 a 5 anos",
        local: "Salas de Vacinação das UBS",
        documentos: "Caderneta de Vacinação"
    },
    {
        id: 6,
        titulo: "Janeiro Branco",
        categoria: "mental",
        status: "encerrado",
        dataInicio: "01/01/2026",
        dataFim: "31/01/2026",
        icone: "<i class='fi fi-rr-brain'></i> ",
        resumo: "Conscientização sobre saúde mental.",
        descricao: "O Janeiro Branco é uma campanha dedicada a convidar as pessoas a pensarem sobre suas vidas, o sentido e o propósito das suas existências, a qualidade dos seus relacionamentos e o quanto elas conhecem sobre si mesmas, suas emoções, seus pensamentos e seus comportamentos.",
        publicoAlvo: "População em geral",
        local: "CAPS e Centros de Convivência",
        documentos: "Nenhum documento necessário"
    }
];

// --- DINAMIZAÇÃO E RENDERIZAÇÃO REATIVA ---
let activeCampanhasList = [];

document.addEventListener('DOMContentLoaded', async () => {
    configurarFiltros();
    await carregarCampanhasPaginaCampanhas();
});

function configurarFiltros() {
    const filters = document.querySelectorAll('.filter-btn');
    filters.forEach(btn => {
        btn.addEventListener('click', () => {
            filters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const categoria = btn.dataset.filter;
            renderizarCampanhas(categoria);
        });
    });
}

async function carregarCampanhasPaginaCampanhas() {
    let dados = [];
    let apiOnline = false;
    if (typeof API !== 'undefined') {
        try {
            const resp = await API.campanhasPublic();
            if (resp && !resp.erro) {
                dados = resp;
                apiOnline = true;
            }
        } catch (e) {
            console.error("Erro ao buscar campanhas via API:", e);
        }
    }

    if (apiOnline) {
        localStorage.setItem('admin_campanhas', JSON.stringify(dados));
    } else {
        // Fallback para LocalStorage se a API falhar
        const localData = localStorage.getItem('admin_campanhas');
        if (localData) {
            try {
                dados = JSON.parse(localData);
            } catch (e) {
                console.error("Erro ao parsear campanhas do localStorage:", e);
            }
        }
    }

    // Fallback secundário para array estático
    if (!dados || dados.length === 0 || dados.erro) {
        dados = campanhasData;
    }

    // Normalizar propriedades
    activeCampanhasList = dados.map(c => {
        const statusVal = String(c.status || '').toLowerCase();
        let normalizedStatus = 'ativo';
        if (statusVal === 'aguardando' || statusVal === 'em breve') {
            normalizedStatus = 'aguardando';
        } else if (statusVal === 'encerrado' || statusVal === 'inativa' || statusVal === 'encerrada' || c.status == 0) {
            normalizedStatus = 'encerrado';
        }

        return {
            id: c.id,
            titulo: c.titulo,
            categoria: c.categoria,
            status: normalizedStatus,
            dataInicio: c.data_inicio || c.dataInicio || '---',
            dataFim: c.data_fim || c.dataFim || '---',
            icone: c.icone || '📢',
            imagem: c.imagem || 'https://via.placeholder.com/600x400?text=Campanha',
            resumo: c.resumo || c.descricao || '---',
            descricao: c.descricao || c.resumo || '---',
            publicoAlvo: c.publico_alvo || c.publicoAlvo || 'População em geral',
            local: c.local || 'Unidades de Saúde',
            documentos: c.documentos || 'RG, CPF e Cartão SUS'
        };
    });

    renderizarDestaque();
    renderizarCampanhas('todas');
    renderizarCalendarioDinamico();
}

function renderizarDestaque() {
    const destaqueSection = document.querySelector('.campanha-destaque');
    if (!destaqueSection) return;

    let campDestaque = activeCampanhasList.find(c => c.categoria === 'destaque');
    if (!campDestaque) {
        campDestaque = activeCampanhasList.find(c => c.status === 'ativo');
    }
    if (!campDestaque && activeCampanhasList.length > 0) {
        campDestaque = activeCampanhasList[0];
    }

    if (!campDestaque) {
        destaqueSection.style.display = 'none';
        return;
    }

    destaqueSection.style.display = 'grid';

    let iconeHTML = campDestaque.icone;
    if (!iconeHTML.includes('<') && !iconeHTML.includes('>')) {
        iconeHTML = `<span class="emoji-destaque" style="font-size: 6rem; display: block; filter: drop-shadow(0px 4px 10px rgba(0,0,0,0.15));">${campDestaque.icone}</span>`;
    }

    const badgeText = formatarStatus(campDestaque.status).toUpperCase();
    const badgeClass = campDestaque.status;

    if (campDestaque.imagem && !campDestaque.imagem.includes('placeholder')) {
        destaqueSection.style.background = `linear-gradient(135deg, rgba(0, 75, 130, 0.9) 0%, rgba(0, 191, 165, 0.8) 100%), url('${campDestaque.imagem}') center/cover no-repeat`;
    } else {
        destaqueSection.style.background = `linear-gradient(135deg, #004b82 0%, #00bfa5 100%)`;
    }

    destaqueSection.innerHTML = `
        <div class="destaque-content">
            <span class="badge-destaque ${badgeClass}">CAMPANHA ${badgeText}</span>
            <h2>${campDestaque.titulo}</h2>
            <p>${campDestaque.resumo || campDestaque.descricao}</p>
            <button class="btn-campanha" onclick="abrirDetalhes(${campDestaque.id})">VER DETALHES COMPLETOS</button>
        </div>
        <div class="destaque-image">
            <div class="vaccine-icon">${iconeHTML}</div>
        </div>
    `;
}

function renderizarCampanhas(filtro) {
    const container = document.getElementById('campanhas-grid');
    if (!container) return;

    container.innerHTML = '';

    const campanhasFiltradas = filtro === 'todas'
        ? activeCampanhasList
        : activeCampanhasList.filter(c => c.categoria === filtro);

    if (campanhasFiltradas.length === 0) {
        container.innerHTML = '<p class="no-results">Nenhuma campanha encontrada nesta categoria.</p>';
        return;
    }

    campanhasFiltradas.forEach(campanha => {
        const card = document.createElement('div');
        card.className = 'campanha-card animate-up';
        
        let iconeHTML = campanha.icone;
        if (!iconeHTML.includes('<') && !iconeHTML.includes('>')) {
            iconeHTML = `<span class="card-emoji-icon" style="font-size: 3rem; display: block; margin-bottom: 10px;">${campanha.icone}</span>`;
        }

        card.innerHTML = `
            <div class="card-icon">${iconeHTML}</div>
            <h4>${campanha.titulo}</h4>
            <p>${campanha.resumo}</p>
            <div class="card-footer">
                <span class="card-status ${campanha.status}">
                    ${formatarStatus(campanha.status)}
                </span>
                <button class="btn-detalhes" onclick="abrirDetalhes(${campanha.id})">Saiba Mais</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function formatarStatus(status) {
    switch (status) {
        case 'ativo': return 'Em andamento';
        case 'aguardando': return 'Em breve';
        case 'encerrado': return 'Encerrada';
        default: return status;
    }
}

// --- MODAL DE DETALHES ---
function abrirDetalhes(id) {
    const campanha = activeCampanhasList.find(c => c.id === id);
    if (!campanha) return;

    const modal = document.getElementById('modalDetalhes');
    const content = document.getElementById('detalhesContent');

    let iconeHTML = campanha.icone;
    if (!iconeHTML.includes('<') && !iconeHTML.includes('>')) {
        iconeHTML = `<span class="emoji-details" style="font-size: 3rem;">${campanha.icone}</span>`;
    }

    content.innerHTML = `
        <div class="detalhes-header">
            <div class="detalhes-icon">${iconeHTML}</div>
            <div>
                <h2>${campanha.titulo}</h2>
                <span class="card-status ${campanha.status}">${formatarStatus(campanha.status)}</span>
            </div>
        </div>
        
        <div class="detalhes-body">
            <p class="descricao-longa">${campanha.descricao}</p>
            
            <div class="info-grid">
                <div class="info-item">
                    <strong><i class='fi fi-rr-calendar'></i> Período:</strong>
                    <span>${campanha.dataInicio} a ${campanha.dataFim}</span>
                </div>
                <div class="info-item">
                    <strong>👥 Público-Alvo:</strong>
                    <span>${campanha.publicoAlvo}</span>
                </div>
                <div class="info-item">
                    <strong>📍 Local:</strong>
                    <span>${campanha.local}</span>
                </div>
                <div class="info-item">
                    <strong>📄 Documentos:</strong>
                    <span>${campanha.documentos}</span>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function fecharDetalhes() {
    const modal = document.getElementById('modalDetalhes');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

window.addEventListener('click', (e) => {
    const modal = document.getElementById('modalDetalhes');
    if (e.target === modal) fecharDetalhes();
});

function renderizarCalendarioDinamico() {
    const grid = document.querySelector('.calendario-grid');
    if (!grid) return;

    const mesesNomes = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const mesesCampanhas = Array(12).fill(null).map(() => []);

    // Mapeamento de palavras-chave de meses em português
    const palavrasChaveMeses = [
        ["janeiro", "jan"],
        ["fevereiro", "fev"],
        ["março", "marco", "mar"],
        ["abril", "abr"],
        ["maio", "mai"],
        ["junho", "jun"],
        ["julho", "jul"],
        ["agosto", "ago"],
        ["setembro", "set"],
        ["outubro", "out"],
        ["novembro", "nov"],
        ["dezembro", "dez"]
    ];

    activeCampanhasList.forEach(c => {
        let mesEncontrado = -1;

        // 1. Tentar ler da data de início (AAAA-MM-DD ou DD/MM/AAAA)
        const dataStr = String(c.dataInicio || '').trim();
        if (dataStr.includes('-')) {
            const parts = dataStr.split('-');
            if (parts.length >= 2) {
                const mesVal = parseInt(parts[1], 10);
                if (mesVal >= 1 && mesVal <= 12) {
                    mesEncontrado = mesVal - 1;
                }
            }
        } else if (dataStr.includes('/')) {
            const parts = dataStr.split('/');
            if (parts.length >= 2) {
                const mesVal = parseInt(parts[1], 10);
                if (mesVal >= 1 && mesVal <= 12) {
                    mesEncontrado = mesVal - 1;
                }
            }
        }

        // 2. Se não encontrou por data, tenta por palavra-chave no título (ex: "Outubro Rosa")
        if (mesEncontrado === -1) {
            const tituloLower = String(c.titulo || '').toLowerCase();
            for (let i = 0; i < 12; i++) {
                if (palavrasChaveMeses[i].some(kw => tituloLower.includes(kw))) {
                    mesEncontrado = i;
                    break;
                }
            }
        }

        if (mesEncontrado >= 0 && mesEncontrado < 12) {
            mesesCampanhas[mesEncontrado].push(c.titulo);
        }
    });

    const fallbacksClassicos = {
        0: "Janeiro Branco",
        1: "Carnaval Seguro",
        3: "Abril Azul (Autismo)",
        4: "Maio Amarelo (Trânsito)",
        8: "Setembro Amarelo",
        9: "Outubro Rosa",
        10: "Novembro Azul",
        11: "Dezembro Vermelho"
    };

    grid.innerHTML = mesesNomes.map((mes, idx) => {
        let campanhasDoMes = mesesCampanhas[idx];
        let textoExibicao = "";

        if (campanhasDoMes.length > 0) {
            textoExibicao = [...new Set(campanhasDoMes)].join("<br>");
        } else {
            textoExibicao = fallbacksClassicos[idx] || "Sem campanhas";
        }

        return `
            <div class="mes-card animate-up" style="animation-delay: ${idx * 0.05}s;">
                <div class="mes-numero">${mes}</div>
                <p style="font-size: 0.9rem; font-weight: 600; margin: 0; color: #444; min-height: 40px; display: flex; align-items: center; justify-content: center;">${textoExibicao}</p>
            </div>
        `;
    }).join('');
}
