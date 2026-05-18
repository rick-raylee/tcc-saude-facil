// 1. CONFIGURAÇÕES INICIAIS AO CARREGAR A PÁGINA
document.addEventListener('DOMContentLoaded', () => {
    configurarCalendario();
    carregarHistorico();
});

// 2. BLOQUEIO DE AGENDAMENTO RETROATIVO
function configurarCalendario() {
    const inputData = document.getElementById('dataConsulta');
    if (inputData) {
        // Pega a data de hoje no formato YYYY-MM-DD
        const hoje = new Date().toISOString().split('T')[0];
        inputData.setAttribute('min', hoje);
    }
}

// 3. SISTEMA DE HISTÓRICO (Simulando Banco de Dados)
let historicoAgendamentos = [
    { especialidade: 'Clínico Geral', data: '10/02/2026', hora: '14:30', status: 'Concluído' },
    { especialidade: 'Pediatria', data: '15/02/2026', hora: '09:00', status: 'Agendado' }
];

function confirmarAgendamento() {
    const especialidade = document.querySelector('select').value;
    const dataRaw = document.getElementById('dataConsulta').value;
    const hora = document.querySelector('input[type="time"]').value;

    if (!dataRaw || !hora) {
        alert("⚠️ Por favor, preencha a data e o horário corretamente.");
        return;
    }

    // Formatar data de YYYY-MM-DD para DD/MM/YYYY
    const dataFormatada = dataRaw.split('-').reverse().join('/');

    // Adicionar ao Histórico
    const novoAgendamento = {
        especialidade: especialidade,
        data: dataFormatada,
        hora: hora,
        status: 'Agendado'
    };

    historicoAgendamentos.unshift(novoAgendamento); // Adiciona no início da lista
    alert(`<i class='fi fi-rr-check-circle'></i>  Sucesso! Consulta de ${especialidade} agendada para ${dataFormatada} às ${hora}.`);

    // Atualiza a interface (se você criar uma seção de histórico no HTML)
    carregarHistorico();
}

// 5. LÓGICA DE LOGIN (Removido - Gerenciado por home.js)

// 6. FUNÇÃO PARA RENDERIZAR O HISTÓRICO NO HTML (Opcional)
function carregarHistorico() {
    // Caso você adicione uma div id="listaHistorico" no seu HTML
    const lista = document.getElementById('listaHistorico');
    if (lista) {
        lista.innerHTML = historicoAgendamentos.map(item => `
            <div style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
                <div>
                    <strong>${item.especialidade}</strong><br>
                    <small>${item.data} às ${item.hora}</small>
                </div>
                <span style="color: ${item.status === 'Agendado' ? 'green' : '#666'}">${item.status}</span>
            </div>
        `).join('');
    }
}
