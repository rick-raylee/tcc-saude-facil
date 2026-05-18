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

// --- RENDERIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    configurarFiltros();
    renderizarCampanhas('todas');
});

function configurarFiltros() {
    const filters = document.querySelectorAll('.filter-btn');
    filters.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover classe ativa de todos
            filters.forEach(b => b.classList.remove('active'));
            // Adicionar ao clicado
            btn.classList.add('active');

            const categoria = btn.dataset.filter;
            renderizarCampanhas(categoria);
        });
    });
}

function renderizarCampanhas(filtro) {
    const container = document.getElementById('campanhas-grid');
    if (!container) return;

    container.innerHTML = '';

    const campanhasFiltradas = filtro === 'todas'
        ? campanhasData
        : campanhasData.filter(c => c.categoria === filtro);

    if (campanhasFiltradas.length === 0) {
        container.innerHTML = '<p class="no-results">Nenhuma campanha encontrada nesta categoria.</p>';
        return;
    }

    campanhasFiltradas.forEach(campanha => {
        const card = document.createElement('div');
        card.className = 'campanha-card animate-up';
        card.innerHTML = `
            <div class="card-icon">${campanha.icone}</div>
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
    const campanha = campanhasData.find(c => c.id === id);
    if (!campanha) return;

    const modal = document.getElementById('modalDetalhes');
    const content = document.getElementById('detalhesContent');

    content.innerHTML = `
        <div class="detalhes-header">
            <div class="detalhes-icon">${campanha.icone}</div>
            <div>
                <h2>${campanha.titulo}</h2>
                <span class="badg ${campanha.status}">${formatarStatus(campanha.status)}</span>
            </div>
        </div>
        
        <div class="detalhes-body">
            <p class="descricao-longa">${campanha.descricao}</p>
            
            <div class="info-grid">
                <div class="info-item">
                    <strong><i class='fi fi-rr-calendar'></i>  Período:</strong>
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
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// Fechar modal ao clicar fora
window.addEventListener('click', (e) => {
    const modal = document.getElementById('modalDetalhes');
    if (e.target === modal) fecharDetalhes();
});
