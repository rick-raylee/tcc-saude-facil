async function initMedico() {
    console.log("Médico: Inicializando painel...");
    // Sincronizar sessão com API antes de carregar
    if (typeof API !== 'undefined') {
        const sessao = await API.sessao();
        if (sessao && sessao.logado) {
            localStorage.setItem('usuarioLogado', 'true');
            localStorage.setItem('usuarioNome', sessao.usuario?.nome || sessao.nome);
            localStorage.setItem('tipoUsuario', sessao.usuario?.tipo || sessao.tipo);
        } else if (sessao && !sessao.logado && localStorage.getItem('usuarioLogado') === 'true') {
            // Se a API diz que não está logado, mas o local acha que sim, limpa e redireciona
            console.warn("Sessão expirada na API. Limpando acesso.");
            localStorage.removeItem('usuarioLogado');
            window.location.replace('/');
            return;
        }
    }

    verificarAcessoMedico();
    carregarDashboard();
    carregarResumo();
    carregarAgendamentos();

    // Auto-refresh the dashboard queue every 10 seconds
    setInterval(() => {
        carregarDashboard();
        carregarResumo();
        carregarAgendamentos();
    }, 10000);
}

// Inicialização robusta
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMedico);
} else {
    initMedico();
}

async function carregarAgendamentos() {
    const lista = document.getElementById('lista-agendamentos');
    if (!lista) return;

    let agendamentos = [];
    if (typeof API !== 'undefined') {
        agendamentos = await API.agendaMedico();
    }

    if (!agendamentos || agendamentos.length === 0) {
        agendamentos = JSON.parse(localStorage.getItem('agendamentos') || '[]');
    }

    // Filtrar apenas agendamentos ativos (não cancelados)
    const ativos = agendamentos.filter(a => {
        const s = (a.status || '').toLowerCase();
        return s !== 'cancelada' && s !== 'cancelado';
    });

    lista.innerHTML = '';
    if (ativos.length === 0) {
        lista.innerHTML = '<li class="empty-state" style="padding:10px; color:#999;">Nenhum agendamento futuro.</li>';
        return;
    }

    ativos.forEach(ag => {
        const item = document.createElement('li');
        item.className = 'agendamento-item';
        item.style = 'padding:10px; border-bottom:1px solid #eee; cursor:pointer; background:#e3f2fd; border-radius:6px; margin-bottom:5px;';

        item.onclick = () => {
            const pac = {
                nome: ag.paciente_nome || ag.paciente?.nome || ag.paciente || 'Paciente',
                cpf: ag.paciente_cpf || ag.paciente?.cpf || ag.cpf || '',
                sus: ag.paciente_sus || ag.paciente?.sus || '',
                queixa: ag.queixa,
                tipo: ag.tipo
            };
            carregarFichaPaciente(pac);
        };

        const tipoIcon = (ag.tipo || '').toLowerCase() === 'telemedicina' ? '📹' : '<i class="fi fi-rr-hospital"></i> ';
        const tituloConsulta = `Consulta: ${ag.paciente_nome || ag.paciente?.nome || ag.paciente || 'Paciente'}`;
        const localConsulta = (ag.tipo || '').toLowerCase() === 'telemedicina' ? 'Telemedicina Virtual' : 'Consultório Médico - Portal Saúde Digital';
        
        // Google Calendar & ICS links
        const googleLink = gerarLinkGoogleCalendar(tituloConsulta, ag.data, ag.hora, ag.tipo, localConsulta);

        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${ag.data}</strong>
                <span style="font-size:0.8rem; background:#fff; padding:2px 6px; border-radius:4px;">${ag.hora}</span>
            </div>
            <div style="font-size:0.9rem; color:#004b82; margin-top:4px;">
                ${tipoIcon} ${ag.paciente_nome || ag.paciente?.nome || ag.paciente || 'Paciente'}
            </div>
            <div style="font-size:0.8rem; color:#666; margin-bottom: 8px;">${ag.especialidade}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px dashed #ccc; padding-top: 8px; margin-top: 8px;" onclick="event.stopPropagation()">
                <div style="display:flex; gap:4px;">
                    <a href="${googleLink}" target="_blank" style="font-size:0.7rem; padding:4px 8px; border:1px solid #4285f4; color:#4285f4; text-decoration:none; font-weight:bold; border-radius:4px; background:white;">
                        📅 Google
                    </a>
                    <button onclick="window.baixarICSMedico('${tituloConsulta.replace(/'/g, "\\'")}', '${ag.data}', '${ag.hora}', '${ag.tipo}', '${localConsulta.replace(/'/g, "\\'")}')" style="font-size:0.7rem; padding:4px 8px; border:1px solid #888; color:#333; border-radius:4px; background:white; cursor:pointer;">
                        📥 .ICS
                    </button>
                </div>
                <button onclick="window.cancelarConsultaMedico(${ag.id})" style="font-size:0.7rem; padding:4px 8px; border:1px solid #dc3545; color:#dc3545; background:#fff5f5; font-weight:bold; cursor:pointer; border-radius:4px;">
                    ❌ Desmarcar
                </button>
            </div>
        `;
        lista.appendChild(item);
    });
}

// Helpers para calendário do médico
function formatToISODate(dateStr) {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
        return dateStr;
    }
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }
    return dateStr;
}

function gerarLinkGoogleCalendar(titulo, dataStr, horaStr, tipo, local) {
    const isoData = formatToISODate(dataStr);
    const d = isoData.replace(/-/g, '');
    const h = horaStr.replace(/:/g, '');
    const start = `${d}T${h}00`;
    
    const parts = horaStr.split(':');
    let hour = parseInt(parts[0]);
    let min = parseInt(parts[1]) + 30;
    if (min >= 60) {
        min -= 60;
        hour += 1;
    }
    const endHour = String(hour).padStart(2, '0');
    const endMin = String(min).padStart(2, '0');
    const end = `${d}T${endHour}${endMin}00`;
    
    const details = encodeURIComponent(`Consulta agendada pelo Portal Saúde Digital.\nModalidade: ${tipo === 'telemedicina' ? 'Remota (Telemedicina)' : 'Presencial'}\nLocal: ${local}`);
    const title = encodeURIComponent(titulo);
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${encodeURIComponent(local)}`;
}

function baixarICSMedico(titulo, dataStr, horaStr, tipo, local) {
    const isoData = formatToISODate(dataStr);
    const d = isoData.replace(/-/g, '');
    const h = horaStr.replace(/:/g, '');
    const start = `${d}T${h}00`;
    
    const parts = horaStr.split(':');
    let hour = parseInt(parts[0]);
    let min = parseInt(parts[1]) + 30;
    if (min >= 60) {
        min -= 60;
        hour += 1;
    }
    const endHour = String(hour).padStart(2, '0');
    const endMin = String(min).padStart(2, '0');
    const end = `${d}T${endHour}${endMin}00`;
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Portal Saude Digital//NONSGML v1.0//PT
BEGIN:VEVENT
UID:${Date.now()}@saudefacil.com
DTSTAMP:${start}
DTSTART:${start}
DTEND:${end}
SUMMARY:${titulo}
DESCRIPTION:Consulta agendada pelo Portal Saúde Digital.\\nModalidade: ${tipo === 'telemedicina' ? 'Remota' : 'Presencial'}\\nLocal: ${local}
LOCATION:${local}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'consulta_medico.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.gerarLinkGoogleCalendar = gerarLinkGoogleCalendar;
window.baixarICSMedico = baixarICSMedico;

window.cancelarConsultaMedico = async function(id) {
    if (typeof API === 'undefined') return;

    const result = await Swal.fire({
        title: 'Desmarcar Consulta?',
        text: 'Você tem certeza que deseja cancelar esta consulta agendada?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, Desmarcar',
        cancelButtonText: 'Não, manter agendamento'
    });

    if (!result.isConfirmed) return;

    try {
        const resp = await API.cancelarConsulta(id);
        if (resp && resp.sucesso) {
            // Atualizar cópia local do localStorage se existir
            try {
                const localS = JSON.parse(localStorage.getItem('agendamentos') || '[]');
                const updated = localS.map(a => {
                    if (a.id == id || a.dataRaw === id) {
                        a.status = 'cancelada';
                    }
                    return a;
                });
                localStorage.setItem('agendamentos', JSON.stringify(updated));
            } catch (e) {
                console.warn("Erro ao atualizar localStorage na desmarcação:", e);
            }

            Swal.fire({
                icon: 'success',
                title: 'Cancelada!',
                text: 'A consulta foi desmarcada com sucesso.',
                confirmButtonText: 'Ok'
            }).then(() => {
                window.location.reload();
            });
        } else {
            throw new Error(resp.erro || 'Falha ao desmarcar consulta.');
        }
    } catch (err) {
        console.error(err);
        Swal.fire({
            icon: 'error',
            title: 'Erro ao desmarcar',
            text: err.message || 'Ocorreu um erro ao tentar desmarcar a consulta.'
        });
    }
};

function verificarAcessoMedico() {
    const isLogado = localStorage.getItem('usuarioLogado') === 'true';
    const tipo = localStorage.getItem('tipoUsuario');

    if (!isLogado || (tipo !== 'medico' && tipo !== 'medico_tele')) {
        Swal.fire({
            icon: 'error',
            title: 'Acesso Restrito',
            text: 'Acesso permitido apenas para profissionais de saúde devidamente logados.'
        }).then(() => {
            window.location.href = 'index.html';
        });
        return;
    }

    const nome = localStorage.getItem('usuarioNome') || 'Médico';
    const medicoData = JSON.parse(localStorage.getItem('medicoRegistrado') || '{}');

    // Suporte ao novo layout de perfil dropdown premium com iniciais
    const cleanName = nome.replace(/^(Dr\(a\)\.\s+|Dr\.\s+|Dra\.\s+)/i, '');
    const initials = (function(name) {
        if (!name) return 'MD';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    })(cleanName);

    const triggerAvatar = document.getElementById('medico-avatar-trigger');
    const largeAvatar = document.getElementById('medico-avatar-large');
    const welcomeModern = document.getElementById('medico-welcome-message-modern');
    const nameFull = document.getElementById('medico-name-full');
    const roleBadge = document.getElementById('medico-role-badge');
    const roleBadgeSmall = document.getElementById('medico-role-badge-small');

    if (triggerAvatar) triggerAvatar.textContent = initials;
    if (largeAvatar) largeAvatar.textContent = initials;
    if (welcomeModern) {
        const first = cleanName.trim().split(/\s+/)[0];
        welcomeModern.textContent = `Dr(a). ${first}`;
    }
    if (nameFull) {
        nameFull.textContent = nome.startsWith('Dr') ? nome : `Dr(a). ${nome}`;
    }
    if (roleBadge) {
        roleBadge.innerHTML = `<i class="fi fi-rr-doctor"></i> CRM: ${medicoData.crm || '---'}`;
    }
    if (roleBadgeSmall) {
        roleBadgeSmall.textContent = medicoData.especialidade || 'Médico';
    }

    // Fallback para o caso de elementos antigos
    const oldNome = document.getElementById('nome-medico');
    if (oldNome) oldNome.textContent = nome;
    const oldCrm = document.getElementById('crm-medico');
    if (oldCrm) oldCrm.textContent = `CRM: ${medicoData.crm || '---'} | ${medicoData.especialidade || ''}`;

    // Popular encaminhamento dinamicamente a partir das especialidades cadastradas
    const selectEncaminh = document.getElementById('encaminh-especialidade');
    if (selectEncaminh && typeof API !== 'undefined') {
        try {
            const config = await API.settingsPublic();
            if (config && config.portal_especialidades) {
                const especialidades = JSON.parse(config.portal_especialidades);
                if (especialidades && especialidades.length > 0) {
                    selectEncaminh.innerHTML = '';
                    especialidades.forEach(esp => {
                        const option = document.createElement('option');
                        option.value = esp.nome;
                        option.textContent = esp.nome;
                        selectEncaminh.appendChild(option);
                    });
                }
            }
        } catch (e) {
            console.error("Falha ao carregar especialidades para encaminhamento:", e);
        }
    }
}

async function buscarPaciente() {
    const cpfInput = document.getElementById('busca-cpf').value;
    const cpfLimpo = cpfInput.replace(/\D/g, '');

    if (cpfLimpo.length < 11) {
        Swal.fire({ icon: 'warning', title: 'CPF Inválido', text: 'Por favor, digite um CPF válido com 11 dígitos para realizar a busca.' });
        return;
    }

    // Tentar via API
    if (typeof API !== 'undefined') {
        const resp = await API.buscarPacienteMed(cpfLimpo);
        if (resp && !resp.erro) {
            carregarFichaPaciente(resp);
            return;
        }
    }

    // Fallback Local
    const dbPacientes = JSON.parse(localStorage.getItem('db_pacientes') || '[]');
    const encontrado = dbPacientes.find(p => p.cpf.replace(/\D/g, '') === cpfLimpo);
    if (encontrado) {
        carregarFichaPaciente(encontrado);
        return;
    }

    Swal.fire({ icon: 'info', title: 'Não Encontrado', text: 'Paciente não encontrado na base de dados do Portal Saúde Digital.' });
}

function carregarFichaPaciente(paciente) {
    // Esconde dashboard e mostra ficha
    const dash = document.getElementById('dashboard-medico');
    if (dash) dash.style.display = 'none';
    const empty = document.getElementById('empty-state-atendimento');
    if (empty) empty.style.display = 'none';

    document.getElementById('ficha-atendimento').style.display = 'block';

    // Preenche dados
    document.getElementById('paciente-nome').textContent = paciente.nome;
    document.getElementById('paciente-idade').textContent = (paciente.idade || '--') + ' anos';
    document.getElementById('paciente-sus').textContent = paciente.sus;

    // Salva paciente atual na sessão (apenas para contexto)
    sessionStorage.setItem('pacienteEmAtendimento', JSON.stringify(paciente));

    // Carregar observações e condições
    carregarObservacoes();
    carregarCondicoes();

    // Carregar triagem da enfermagem (pode vir no objeto do paciente da API)
    // Carregar triagem da enfermagem
    if (paciente.triagem) {
        exibirTriagem(paciente.triagem);
    } else if (paciente.queixa && (paciente.tipo || '').toLowerCase() === 'telemedicina') {
        // Se não tem triagem mas tem queixa direta (Telemedicina), exibe a queixa
        exibirTriagem({
            queixa: paciente.queixa,
            prioridade: 'verde',
            enfermeiro: 'Sistema (Telemedicina)',
            data: 'Solicitação Direta'
        });
    } else {
        carregarTriagemEnfermagem(paciente.cpf);
    }
    carregarHistoricoPaciente(paciente.cpf);

    // Injetar Botão de Telemedicina dinamicamente
    const actionsDiv = document.querySelector('.paciente-actions');
    const oldBtn = document.getElementById('btn-start-tele');
    if (oldBtn) oldBtn.remove();

    const btnTele = document.createElement('button');
    btnTele.id = 'btn-start-tele';
    btnTele.className = 'btn-salvar-atendimento';
    btnTele.style.marginTop = '0';
    btnTele.style.background = '#6c5ce7';
    btnTele.style.marginLeft = '10px';
    btnTele.innerHTML = '📹 Iniciar Telemedicina';
    btnTele.onclick = iniciarTelemedicina;

    actionsDiv.appendChild(btnTele);
}

// Exibir dados de triagem da enfermagem no painel do médico
async function carregarTriagemEnfermagem(cpfPaciente) {
    if (typeof API !== 'undefined') {
        const triagens = await API.triagensDoP(cpfPaciente);
        if (triagens && triagens.length > 0) {
            exibirTriagem(triagens[0]); // Mais recente
            return;
        }
    }

    const container = document.getElementById('triagem-enfermagem');
    if (!container) return;

    const dbTriagens = JSON.parse(localStorage.getItem('db_triagens') || '[]');
    // Buscar a triagem mais recente deste paciente
    const triagens = dbTriagens.filter(t => t.pacienteCpf === cpfPaciente);

    if (triagens.length === 0) {
        container.style.display = 'none';
        return;
    }

    const ultima = triagens[triagens.length - 1]; // Mais recente
    exibirTriagem(ultima);
}

function exibirTriagem(ultima) {
    const container = document.getElementById('triagem-enfermagem');
    if (!container) return;

    container.style.display = 'block';

    // Badge de risco
    const riscoBadge = document.getElementById('triagem-risco-badge');
    const prioridade = (ultima.prioridade || 'verde').toLowerCase();
    riscoBadge.textContent = prioridade.toUpperCase();
    riscoBadge.className = 'risco-badge ' + prioridade;

    // Sinais vitais
    const grid = document.getElementById('triagem-sinais-grid');
    grid.innerHTML = `
        <div class="ts-item"><span class="ts-label">Peso</span><span class="ts-valor">${ultima.peso || '---'} kg</span></div>
        <div class="ts-item"><span class="ts-label">Altura</span><span class="ts-valor">${ultima.altura || '---'} cm</span></div>
        <div class="ts-item"><span class="ts-label">IMC</span><span class="ts-valor">${ultima.imc || '---'}</span></div>
        <div class="ts-item"><span class="ts-label">Pressão</span><span class="ts-valor">${ultima.pressao || '---'}</span></div>
        <div class="ts-item"><span class="ts-label">FC</span><span class="ts-valor">${ultima.fc || ultima.freqCardiaca || '---'} bpm</span></div>
        <div class="ts-item"><span class="ts-label">Temp.</span><span class="ts-valor">${ultima.temperatura || '---'} °C</span></div>
        <div class="ts-item"><span class="ts-label">SpO₂</span><span class="ts-valor">${ultima.saturacao || '---'}%</span></div>
        <div class="ts-item"><span class="ts-label">Data</span><span class="ts-valor">${ultima.data || '---'}</span></div>
    `;

    // Queixa
    const queixaBox = document.getElementById('triagem-queixa-medico');
    queixaBox.innerHTML = `<strong><i class='fi fi-rr-messages'></i>  Queixa:</strong> ${ultima.queixa}<br><small>Enfermeiro(a): ${ultima.enfermeiro || '---'}</small>`;

    // Auto-preencher queixa no formulário do médico
    const queixaInput = document.getElementById('queixa');
    if (queixaInput && !queixaInput.value) {
        queixaInput.value = ultima.queixa;
    }
}

let chartPressaoInstance = null;
let chartPesoInstance = null;

async function carregarHistoricoPaciente(cpf) {
    const timeline = document.getElementById('historico-atendimentos-lista');
    if (!timeline) return;

    let triagens = [];
    if (typeof API !== 'undefined') {
        const resp = await API.triagensDoP(cpf);
        if (resp && !resp.erro) {
            triagens = resp;
        }
    }

    if (triagens.length === 0) {
        timeline.innerHTML = '<p class="empty-msg">Nenhum histórico anterior encontrado para este paciente.</p>';
        return;
    }

    // Ordenar por data mais antiga primeiro para o gráfico, mas manter decrescente para a timeline
    const triagensAsc = [...triagens].reverse();

    // 1. Renderizar Linha do Tempo
    timeline.innerHTML = '';
    // Pegamos a lista decrescente para a timeline
    triagens.forEach(t => {
        const div = document.createElement('div');
        div.style = 'border-left: 3px solid var(--sus-blue-light); padding-left: 15px; margin-bottom: 20px; position: relative;';

        let pressaoHtml = t.pressao ? `<span style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">PA: ${t.pressao}</span>` : '';
        let imcHtml = t.imc ? `<span style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">IMC: ${t.imc}</span>` : '';

        div.innerHTML = `
            <div style="width: 12px; height: 12px; background: var(--sus-blue-dark); border-radius: 50%; position: absolute; left: -8px; top: 5px;"></div>
            <strong style="color: #333;">${t.data || 'Data Desconhecida'}</strong>
            <div style="margin-top: 5px; color: #555; font-size: 0.9rem;">
                <b>Queixa:</b> ${t.queixa || 'Não relatada'} (Enf: ${t.enfermeiro || '---'})<br>
                <div style="margin-top: 8px; display: flex; gap: 8px;">
                    ${pressaoHtml}
                    ${imcHtml}
                </div>
            </div>
        `;
        timeline.appendChild(div);
    });

    // 2. Preparar dados para Gráficos (Ordem Cronológica ASC)
    const labels = triagensAsc.map(t => {
        if (!t.data) return '?';
        const spl = t.data.split(' '); // "YYYY-MM-DD HH:MM:SS" ou "DD/MM/YYYY"
        return spl[0].includes('-') ? spl[0].split('-').reverse().join('/') : spl[0];
    });

    // Gráfico de Pressão
    const sistolicas = [];
    const diastolicas = [];
    triagensAsc.forEach(t => {
        if (t.pressao && (t.pressao.includes('x') || t.pressao.includes('X') || t.pressao.includes('/'))) {
            const splitChar = t.pressao.includes('x') ? 'x' : (t.pressao.includes('X') ? 'X' : '/');
            const p = t.pressao.split(splitChar);
            sistolicas.push(parseInt(p[0]) || null);
            diastolicas.push(parseInt(p[1]) || null);
        } else {
            sistolicas.push(null);
            diastolicas.push(null);
        }
    });

    const ctxPressao = document.getElementById('chartPressao');
    if (ctxPressao) {
        if (chartPressaoInstance) chartPressaoInstance.destroy();
        chartPressaoInstance = new Chart(ctxPressao, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Sistólica', data: sistolicas, borderColor: '#e74c3c', fill: false, tension: 0.1 },
                    { label: 'Diastólica', data: diastolicas, borderColor: '#3498db', fill: false, tension: 0.1 }
                ]
            },
            options: { responsive: true, scales: { y: { min: 30, max: 220 } } }
        });
    }

    // Gráfico de Peso
    const pesos = triagensAsc.map(t => parseFloat(t.peso) || null);

    const ctxPeso = document.getElementById('chartPeso');
    if (ctxPeso) {
        if (chartPesoInstance) chartPesoInstance.destroy();
        chartPesoInstance = new Chart(ctxPeso, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Peso (kg)', data: pesos, borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.2)', fill: true, tension: 0.3 }
                ]
            },
            options: { responsive: true }
        });
    }
}

async function salvarAtendimento(e) {
    if (e) e.preventDefault();

    const paciente = JSON.parse(sessionStorage.getItem('pacienteEmAtendimento'));
    const dados = {
        paciente_cpf: paciente.cpf,
        queixa: document.getElementById('queixa').value,
        diagnostico: document.getElementById('diagnostico-doenca').value,
        tratamento: document.getElementById('tratamento').value,
        estado: document.getElementById('estado-paciente').value,
        tem_cura: document.getElementById('tem-cura').value === 'sim'
    };

    if (typeof API !== 'undefined') {
        const resp = await API.salvarAtendimento(dados);
        if (resp && resp.sucesso) {
            Swal.fire({ icon: 'success', title: 'Atendimento Salvo', text: 'Os dados do atendimento foram registrados com sucesso no sistema.' });
            // Reset UI
            document.getElementById('form-diagnostico')?.reset();
            document.getElementById('ficha-atendimento').style.display = 'none';
            const dash = document.getElementById('dashboard-medico');
            if (dash) dash.style.display = 'block';
            await carregarDashboard();
            return;
        }
    }

    // Fallback
    let historico = JSON.parse(localStorage.getItem('historicoAtendimentos') || '[]');
    historico.unshift({ ...dados, data: new Date().toLocaleDateString(), medico: localStorage.getItem('usuarioNome') });
    localStorage.setItem('historicoAtendimentos', JSON.stringify(historico));
    Swal.fire({ icon: 'info', title: 'Modo Offline', text: 'Atendimento salvo localmente no dispositivo.' });
    carregarResumo();
}

async function carregarResumo() {
    const lista = document.getElementById('lista-recentes');
    if (!lista) return;

    let historico = JSON.parse(localStorage.getItem('historicoAtendimentos') || '[]');

    lista.innerHTML = '';
    if (historico.length === 0) {
        lista.innerHTML = '<li class="empty-state" style="padding:10px; color:#999;">Nenhum atendimento realizado.</li>';
        return;
    }

    historico.forEach(atd => {
        const item = document.createElement('li');
        item.style = 'padding:10px; border-bottom:1px solid #eee; margin-bottom:5px;';

        // Verifica se é telemedicina para permitir ler o chat anterior
        const isTele = ((atd.tipo || '').toLowerCase() === 'telemedicina' || (atd.tipo_atendimento || '').toLowerCase() === 'telemedicina');
        const btnChat = (isTele && atd.id) ? `<button onclick="abrirChatHistorico(${atd.id}, '${atd.paciente_nome || atd.pacienteCpf || 'Paciente'}')" style="margin-top: 5px; padding: 4px 8px; font-size: 0.75rem; border: none; border-radius: 4px; background: #e3f2fd; color: #004b82; cursor: pointer; font-weight: bold;"><i class='fi fi-rr-messages'></i>  Ver Chat da Telemedicina</button>` : '';

        item.innerHTML = `
            <div><strong>${atd.data}</strong> - <span style="color:#004b82">${atd.diagnostico}</span></div>
            <div style="font-size:0.8rem; color:#666; margin-bottom: 2px;">Status: ${atd.estado} | ${atd.paciente_nome || 'Paciente'}</div>
            ${btnChat}
        `;
        lista.appendChild(item);
    });
}

// ==========================================
// DASHBOARD MEDICO
// ==========================================
let chartEvolucaoInstance = null;
let senhasChamadasMock = 1;

async function carregarDashboard() {
    const dashElement = document.getElementById('dashboard-medico');
    if (!dashElement) return;

    let dados = {
        tipo_atendimento: localStorage.getItem('medicoRegistrado') ? JSON.parse(localStorage.getItem('medicoRegistrado')).tipo_atendimento || 'presencial' : 'presencial',
        consultasHoje: 0,
        confirmadas: 0,
        aguardando: 0,
        faltas: 0,
        doencas_frequentes: [
            { nome: 'Hipertensão', pct: '40%' },
            { nome: 'Diabetes', pct: '25%' },
            { nome: 'Ansiedade', pct: '20%' },
        ]
    };

    if (typeof API !== 'undefined') {
        const resp = await API.resumoMedico();
        if (resp && !resp.erro) {
            dados = { ...dados, ...resp };
        }
    }

    // Atualizar UI Cards
    document.getElementById('dash-tipo-atendimento').textContent = dados.tipo_atendimento.toUpperCase();
    document.getElementById('dash-total').textContent = dados.consultasHoje;
    document.getElementById('dash-confirmadas').textContent = dados.confirmadas;
    document.getElementById('dash-aguardando').textContent = dados.aguardando;
    document.getElementById('dash-faltas').textContent = dados.faltas;
    
    const triagensEl = document.getElementById('dash-triagens');
    if (triagensEl) triagensEl.textContent = dados.triagens_hoje || 0;

    // Atualizar Switch de Presença
    const checkPresenca = document.getElementById('check-presenca-presencial');
    const labelPresenca = document.getElementById('label-presenca-status');
    if (checkPresenca) {
        checkPresenca.checked = !!dados.presencial_ativo;
        if (labelPresenca) {
            if (dados.presencial_ativo) {
                labelPresenca.textContent = 'PRESENTE';
                labelPresenca.style.color = '#28a745';
            } else {
                labelPresenca.textContent = 'AUSENTE';
                labelPresenca.style.color = '#dc3545';
            }
        }
    }

    // Atualizar Doenças
    const listaDoencas = document.getElementById('dash-doencas-lista');
    if (listaDoencas && dados.doencas_frequentes) {
        listaDoencas.innerHTML = '';
        dados.doencas_frequentes.forEach(d => {
            listaDoencas.innerHTML += `<li style="padding: 5px 0; border-bottom: 1px dotted #ccc; display: flex; justify-content: space-between;">${d.nome} <b>${d.pct}</b></li>`;
        });
    }

    // Configuração de Visualização (Presencial vs Telemedicina)
    const moduloPresencial = document.getElementById('modulo-presencial-fila');
    const moduloTele = document.getElementById('modulo-telemedicina-fila');

    if (dados.tipo_atendimento === 'telemedicina') {
        if (moduloPresencial) moduloPresencial.style.display = 'none';
        if (moduloTele) {
            moduloTele.style.display = 'flex';
            carregarFilaTelemedicina();
        }
        dashElement.querySelector('.dash-cards-grid > div:nth-child(4)').style.display = 'none'; // esconde "faltas" se não fizer sentido
    } else {
        if (moduloPresencial) moduloPresencial.style.display = 'flex';
        if (moduloTele) moduloTele.style.display = 'none';
    }

    // Renderizar ChartJS
    const ctx = document.getElementById('chartAtendimentos');
    if (ctx) {
        if (chartEvolucaoInstance) chartEvolucaoInstance.destroy();
        chartEvolucaoInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
                datasets: [{
                    label: 'Atendimentos por Dia',
                    data: [12, 19, 15, 17, dados.consultasHoje || 10],
                    borderColor: '#0056AC',
                    backgroundColor: 'rgba(0, 86, 172, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

async function carregarFilaTelemedicina() {
    const container = document.getElementById('lista-fila-telemedicina');
    const totalEl = document.getElementById('total-tele-aguardando');
    if (!container) return;

    let agendamentos = [];
    if (typeof API !== 'undefined') {
        agendamentos = await API.agendaMedico();
    }

    // Filtrar apenas telemedicina e para hoje
    const hoje = new Date().toISOString().split('T')[0];
    const filaHoje = agendamentos.filter(ag => 
        (ag.tipo || '').toLowerCase() === 'telemedicina' && 
        ag.data === hoje && 
        (ag.status === 'confirmada' || ag.status === 'agendada' || ag.status === 'em_atendimento')
    );

    if (totalEl) totalEl.textContent = filaHoje.length;

    container.innerHTML = '';
    if (filaHoje.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum paciente agendado para hoje via Telemedicina.</div>';
        return;
    }

    filaHoje.forEach(ag => {
        const item = document.createElement('div');
        item.className = 'tele-queue-card';
        item.style = 'background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 10px;';
        
        const queixaFmt = ag.queixa ? `<div style="background: #f0f7ff; padding: 8px; border-radius: 4px; font-size: 0.85rem; color: #004b82;"><b>Sintomas:</b> ${ag.queixa}</div>` : '<div style="color: #999; font-size: 0.8rem;">Sem descrição de sintomas.</div>';
        
        // Objeto para ver prontuário
        const pac = {
            nome: ag.paciente,
            cpf: ag.cpf,
            queixa: ag.queixa,
            tipo: 'telemedicina'
        };

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h4 style="margin: 0; color: #333;">${ag.paciente}</h4>
                    <span style="font-size: 0.8rem; color: #666;">CPF: ${ag.cpf || '---'}</span>
                </div>
                <span style="background: #6c5ce7; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">${ag.hora}</span>
            </div>
            ${queixaFmt}
            <div style="display: flex; gap: 10px; margin-top: 5px;">
                <button onclick="carregarFichaPaciente(${JSON.stringify(pac).replace(/"/g, '&quot;')})" class="btn-atender-tele" style="flex: 1; padding: 8px; background: #6c5ce7; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Ver Prontuário</button>
                <button onclick="iniciarTelemedicinaContexto(${ag.id}, '${ag.paciente}')" class="btn-video-tele" style="padding: 8px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;"><i class="fi fi-rr-video-camera"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
}

function iniciarTelemedicinaContexto(id, nome) {
    // Definir paciente atual no sessionStorage para a sala de telemedicina
    const pac = { id, nome };
    sessionStorage.setItem('pacienteEmAtendimento', JSON.stringify(pac));
    if (typeof iniciarTelemedicina === 'function') {
        iniciarTelemedicina();
    } else {
        // Fallback se a função não existir no contexto atual
        window.location.href = `telemedicina.html?sala=ativa&id=${id}`;
    }
}

async function chamarProximoFila() {
    const senhaAtualEl = document.getElementById('senha-atual');
    const pacienteSenhaEl = document.getElementById('paciente-senha-atual');

    if (!senhaAtualEl) return;

    if (typeof API !== 'undefined') {
        const resp = await API.proximoFila();
        if (resp && resp.senha) {
            // Animação visual rápida
            senhaAtualEl.style.transform = 'scale(1.2)';
            senhaAtualEl.style.color = '#e74c3c';
            setTimeout(() => {
                senhaAtualEl.style.transform = 'scale(1)';
                senhaAtualEl.style.color = 'var(--sus-blue-dark)';
            }, 300);

            senhaAtualEl.innerText = resp.senha;
            pacienteSenhaEl.innerText = resp.paciente_nome;

            // Sons de chamada (opcional - simulação)
            if ('speechSynthesis' in window) {
                const msg = new SpeechSynthesisUtterance(`Senha ${resp.senha}. Paciente ${resp.paciente_nome}. Consultório 01.`);
                msg.lang = 'pt-BR';
                window.speechSynthesis.speak(msg);
            }

            // Carregar ficha do paciente automaticamente
            const pac = await API.buscarPacienteMed(resp.paciente_cpf);
            if (pac && !pac.erro) {
                setTimeout(() => carregarFichaPaciente(pac), 2000); // 2 segundos para o médico ver o nome
            }

            // Atualiza contagem da fila no background
            carregarDashboard();
        } else {
            Swal.fire({ icon: 'info', title: 'Fila Vazia', text: 'Não há pacientes aguardando na fila no momento.' });
        }
    } else {
        // Fallback layout visual original se sem API
        let aguardandoEl = document.getElementById('dash-aguardando');
        let aguardando = parseInt(aguardandoEl.innerText) || 0;
        const senhaFormatada = 'P-' + String(senhasChamadasMock).padStart(3, '0');
        // Animação visual rápida
        senhaAtualEl.style.transform = 'scale(1.2)';
        senhaAtualEl.style.color = '#e74c3c';
        setTimeout(() => {
            senhaAtualEl.style.transform = 'scale(1)';
            senhaAtualEl.style.color = 'var(--sus-blue-dark)';
        }, 300);

        senhaAtualEl.innerText = senhaFormatada;
        pacienteSenhaEl.innerText = "Dirija-se ao Consultório 01";

        senhasChamadasMock++;
        if (aguardando > 0) {
            aguardandoEl.innerText = aguardando - 1;
        }

        // Sons de chamada (opcional - simulação)
        if ('speechSynthesis' in window) {
            const msg = new SpeechSynthesisUtterance(`Senha ${senhaFormatada}. Consultório 01.`);
            msg.lang = 'pt-BR';
            window.speechSynthesis.speak(msg);
        }
    }
}

function mudarTab(tabName) {
    // Esconder todos os conteúdos
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

    // Remover active dos botões
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // Mostrar o selecionado
    document.getElementById(`tab-${tabName}`).style.display = 'block';

    // Ativar botão (precisa pegar o botão clicado, mas aqui faremos via seletor para simplificar)
    // Na prática, o onclick passa o evento ou o elemento, mas vamos simplificar
    const buttons = document.querySelectorAll('.tab-btn');
    if (tabName === 'diagnostico') buttons[0].classList.add('active');
    if (tabName === 'historico') buttons[1].classList.add('active');
    if (tabName === 'exames') buttons[2].classList.add('active');
    if (tabName === 'observacoes') buttons[3].classList.add('active');
}

function processarArquivos(input) {
    const arquivos = input.files;
    const lista = document.getElementById('lista-exames-anexados');

    // Array para armazenar metadados dos exames
    let examesTemp = JSON.parse(sessionStorage.getItem('tempExamesAnexados') || '[]');

    for (let i = 0; i < arquivos.length; i++) {
        const file = arquivos[i];

        // Adicionar visualmente
        const item = document.createElement('div');
        item.className = 'exame-item';
        item.style.padding = '10px';
        item.style.background = '#f0f7ff';
        item.style.border = '1px solid #cce5ff';
        item.style.margin = '5px 0';
        item.style.borderRadius = '4px';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';

        item.innerHTML = `
            <span>📄 ${file.name}</span>
            <span style="color:var(--medico-blue); font-weight:bold;">Carregado</span>
        `;
        lista.appendChild(item);

        // Adicionar aos dados (Simulando upload real guardando nome e data)
        examesTemp.push({
            nomeArquivo: file.name,
            tipo: file.type,
            dataUpload: new Date().toLocaleDateString()
        });
    }

    sessionStorage.setItem('tempExamesAnexados', JSON.stringify(examesTemp));
}

// LÓGICA DE OBSERVAÇÕES E CONDIÇÕES

// --- CONDIÇÕES ---
function carregarCondicoes() {
    const paciente = JSON.parse(sessionStorage.getItem('pacienteEmAtendimento'));
    const lista = document.getElementById('lista-condicoes');
    const todasCondicoes = JSON.parse(localStorage.getItem('condicoes_paciente') || '{}');
    const condicoesPaciente = todasCondicoes[paciente.cpf] || [];

    lista.innerHTML = '';
    condicoesPaciente.forEach(cond => {
        const tag = document.createElement('span');
        tag.style.background = '#ffc107';
        tag.style.color = '#333';
        tag.style.padding = '5px 10px';
        tag.style.borderRadius = '15px';
        tag.style.fontSize = '0.9rem';
        tag.style.fontWeight = 'bold';
        tag.style.display = 'flex';
        tag.style.alignItems = 'center';
        tag.style.gap = '5px';

        tag.innerHTML = `${cond} <span onclick="removerCondicao('${cond}')" style="cursor:pointer; opacity:0.6;">✕</span>`;
        lista.appendChild(tag);
    });
}

function adicionarCondicao() {
    const input = document.getElementById('nova-condicao');
    const condicao = input.value.trim();
    if (!condicao) return;

    const paciente = JSON.parse(sessionStorage.getItem('pacienteEmAtendimento'));
    let todasCondicoes = JSON.parse(localStorage.getItem('condicoes_paciente') || '{}');

    if (!todasCondicoes[paciente.cpf]) {
        todasCondicoes[paciente.cpf] = [];
    }

    // Evitar duplicatas
    if (!todasCondicoes[paciente.cpf].includes(condicao)) {
        todasCondicoes[paciente.cpf].push(condicao);
        localStorage.setItem('condicoes_paciente', JSON.stringify(todasCondicoes));
        input.value = '';
        carregarCondicoes();
    } else {
        Swal.fire({ icon: 'warning', title: 'Duplicata', text: 'Esta condição já foi registrada para este paciente.' });
    }
}

function removerCondicao(condicao) {
    if (!confirm(`Remover a condição "${condicao}"?`)) return;

    const paciente = JSON.parse(sessionStorage.getItem('pacienteEmAtendimento'));
    let todasCondicoes = JSON.parse(localStorage.getItem('condicoes_paciente') || '{}');

    if (todasCondicoes[paciente.cpf]) {
        todasCondicoes[paciente.cpf] = todasCondicoes[paciente.cpf].filter(c => c !== condicao);
        localStorage.setItem('condicoes_paciente', JSON.stringify(todasCondicoes));
        carregarCondicoes();
    }
}


// --- OBSERVAÇÕES MÉDICAS ---
function salvarObservacao() {
    const input = document.getElementById('obs-texto');
    const texto = input.value.trim();
    if (!texto) return;

    const paciente = JSON.parse(sessionStorage.getItem('pacienteEmAtendimento'));
    const medicoNome = localStorage.getItem('usuarioNome');

    const novaObs = {
        id: Date.now(),
        medico: medicoNome,
        texto: texto,
        data: new Date().toLocaleString()
    };

    // Estrutura: { 'CPF_PACIENTE': [ {obs1}, {obs2} ] }
    let todasObs = JSON.parse(localStorage.getItem('observacoes_medicas') || '{}');

    if (!todasObs[paciente.cpf]) {
        todasObs[paciente.cpf] = [];
    }

    todasObs[paciente.cpf].push(novaObs);
    localStorage.setItem('observacoes_medicas', JSON.stringify(todasObs));

    input.value = '';
    carregarObservacoes();
}

function carregarObservacoes() {
    const paciente = JSON.parse(sessionStorage.getItem('pacienteEmAtendimento'));
    const areaDiv = document.getElementById('lista-observacoes');
    let todasObs = JSON.parse(localStorage.getItem('observacoes_medicas') || '{}');
    const obsPaciente = todasObs[paciente.cpf] || [];

    if (obsPaciente.length === 0) {
        areaDiv.innerHTML = '<p class="empty-msg" style="color:#999; text-align:center; padding:20px;">Nenhuma observação registrada.</p>';
        return;
    }

    areaDiv.innerHTML = '';
    obsPaciente.forEach(obs => {
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        div.style.padding = '10px';
        div.style.background = '#e3f2fd';
        div.style.borderLeft = '3px solid var(--medico-blue)';
        div.style.borderRadius = '4px';
        div.style.fontSize = '0.9rem';

        div.innerHTML = `
            <strong>${obs.medico}:</strong> ${obs.texto} 
            <br><small style="color:#777; font-size:0.75rem;">${obs.data}</small>
        `;
        areaDiv.appendChild(div);
    });

    areaDiv.scrollTop = areaDiv.scrollHeight;
}

function logoutMedico() {
    if (typeof API !== 'undefined') {
        API.logout().finally(() => {
            localStorage.removeItem('usuarioLogado');
            localStorage.removeItem('tipoUsuario');
            localStorage.removeItem('usuarioNome');
            window.location.replace('/');
        });
    } else {
        localStorage.removeItem('usuarioLogado');
        localStorage.removeItem('tipoUsuario');
        localStorage.removeItem('usuarioNome');
        window.location.replace('/');
    }
}
// ... (Existing code)

// =========================================
// LÓGICA DE TELEMEDICINA
// =========================================

let teleInterval;
let teleSeconds = 0;
let localStream;

function iniciarTelemedicina() {
    // 1. Verificar se tem paciente selecionado
    const paciente = JSON.parse(sessionStorage.getItem('pacienteEmAtendimento'));
    if (!paciente) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Selecione um paciente para iniciar a telemedicina.' });
        return;
    }

    // 2. Mostrar Sala
    document.getElementById('sala-telemedicina').style.display = 'flex';
    document.getElementById('tele-paciente-nome').textContent = paciente.nome;

    // 3. Iniciar Câmera
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            const videoEl = document.getElementById('local-video');
            videoEl.srcObject = stream;
            videoEl.style.display = 'block';
            // Esconder fallback se existir
            const fallback = document.getElementById('cam-fallback');
            if (fallback) fallback.style.display = 'none';
        })
        .catch(err => {
            console.error("Erro ao acessar câmera:", err);
            // Mostrar fallback visual no PIP ao invés de apenas alert
            const pip = document.querySelector('.video-pip');
            const videoEl = document.getElementById('local-video');
            if (videoEl) videoEl.style.display = 'none';

            let fallback = document.getElementById('cam-fallback');
            if (!fallback) {
                fallback = document.createElement('div');
                fallback.id = 'cam-fallback';
                fallback.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1a1a1a;color:#888;text-align:center;padding:10px;';
                fallback.innerHTML = `
                    <div style="font-size:2rem;margin-bottom:8px;"><i class='fi fi-rr-camera'></i> </div>
                    <p style="font-size:0.75rem;line-height:1.3;">Câmera bloqueada.<br>
                    <small>Use um servidor local<br>(Live Server) para<br>acessar a câmera.</small></p>
                `;
                pip.insertBefore(fallback, pip.firstChild);
            }
        });

    // 4. Iniciar Timer
    teleSeconds = 0;
    document.getElementById('tele-timer').textContent = "00:00";
    // --- INICIAR TIMER E SINCRONIA ---
    let seconds = 0;

    // Marcar como online
    localStorage.setItem('tele_medico_online', 'true');

    teleInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        document.getElementById('tele-timer').textContent = `${mins}:${secs}`;

        // --- SINCRONIA DE PROXIMIDADE ---
        const pacienteOnline = localStorage.getItem('tele_paciente_online') === 'true';
        const mainVideo = document.querySelector('.video-main');
        let overlay = document.getElementById('overlay-aguardando-paciente');

        if (!pacienteOnline) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'overlay-aguardando-paciente';
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.background = 'rgba(0,0,0,0.85)';
                overlay.style.color = 'white';
                overlay.style.display = 'flex';
                overlay.style.flexDirection = 'column';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';
                overlay.style.zIndex = '10';
                overlay.innerHTML = `
                    <div style="font-size: 3rem; margin-bottom: 20px;"><i class='fi fi-rr-user'></i> </div>
                    <h3>Aguardando Paciente...</h3>
                    <p>O paciente ainda não entrou na sala.</p>
                `;
                mainVideo.appendChild(overlay);
            }
        } else {
            if (overlay) overlay.remove();
        }

        // --- SYNC CHAT ---
        syncChatMedico();

    }, 1000);
}

function mudarTabTele(tab) {
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.panel-tab[onclick="mudarTabTele('${tab}')"]`).classList.add('active');

    if (tab === 'prontuario') {
        document.getElementById('panel-prontuario').style.display = 'block';
        document.getElementById('panel-chat').style.display = 'none';

        // Ajustar layout flex se necessário, mas block funciona
    } else {
        document.getElementById('panel-prontuario').style.display = 'none';
        const chatPanel = document.getElementById('panel-chat');
        chatPanel.style.display = 'flex';
        // Force scroll to bottom
        const chatArea = chatPanel.querySelector('.chat-area');
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

async function syncChatMedico() {
    const paciente = JSON.parse(sessionStorage.getItem('pacienteEmAtendimento'));
    if (!paciente || typeof API === 'undefined') return;

    // Buscar a consulta ativa/última para este paciente
    const consultas = await API.minhasConsultas();
    const ativa = consultas.find(c => (c.paciente_cpf === paciente.cpf || c.paciente === paciente.nome) && c.status !== 'cancelada');
    if (!ativa) return;

    const chatData = await API.listarMsgs(ativa.id);
    if (!chatData || chatData.erro) return;

    const chatArea = document.querySelector('#panel-chat .chat-area');
    if (!chatArea) return;

    const currentCount = chatArea.querySelectorAll('.chat-msg').length;
    if (chatData.length > currentCount) {
        chatArea.innerHTML = '';
        chatData.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'chat-msg';
            const isMe = msg.tipo === 'medico';
            div.style = `padding:8px; margin:5px 0; border-radius:5px; max-width:85%; word-wrap:break-word; ${isMe ? 'background:#dcf8c6; margin-left:auto;' : 'background:#f0f0f0;'}`;

            // Check if it's a file attachment
            if (msg.mensagem.startsWith('[ANEXO]')) {
                const parts = msg.mensagem.split('|');
                const fileUrl = parts[1];
                const fileName = parts[2] || 'Arquivo Anexado';
                const isImage = fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) != null || fileUrl.startsWith('data:image');

                if (isImage) {
                    div.innerHTML = `<strong>${isMe ? 'Você' : msg.remetente}:</strong><br>
                                     <a href="${fileUrl}" target="_blank">
                                        <img src="${fileUrl}" style="max-width:100%; border-radius:4px; margin-top:5px; border:1px solid #ccc;">
                                     </a>`;
                } else {
                    div.innerHTML = `<strong>${isMe ? 'Você' : msg.remetente}:</strong><br>
                                     <a href="${fileUrl}" target="_blank" style="display:inline-block; margin-top:5px; color:#004b82; text-decoration:none; background:#e3f2fd; padding:5px 10px; border-radius:4px; border:1px solid #b6d4fe;">
                                        <i class='fi fi-rr-clip'></i>  ${fileName}
                                     </a>`;
                }
            } else {
                div.innerHTML = `<strong>${isMe ? 'Você' : msg.remetente}:</strong> ${msg.mensagem}`;
            }

            chatArea.appendChild(div);
        });
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

async function enviarMensagemChat(usuario) {
    const input = document.querySelector('#panel-chat input[type="text"]');
    const texto = input.value.trim();
    if (!texto) return;

    const paciente = JSON.parse(sessionStorage.getItem('pacienteEmAtendimento'));
    const consultas = await API.minhasConsultas();
    const ativa = consultas.find(c => (c.paciente_cpf === paciente.cpf || c.paciente === paciente.nome) && c.status !== 'cancelada');

    if (ativa && typeof API !== 'undefined') {
        const resp = await API.enviarMsg(ativa.id, texto);
        if (resp && resp.sucesso) {
            input.value = '';
            syncChatMedico();
        }
    }
}

async function enviarArquivoChat(usuario) {
    const fileInput = document.getElementById('chat-file-input');
    const file = fileInput.files[0];
    if (!file) return;

    const paciente = JSON.parse(sessionStorage.getItem('pacienteEmAtendimento'));
    const consultas = await API.minhasConsultas();
    const ativa = consultas.find(c => (c.paciente_cpf === paciente.cpf || c.paciente === paciente.nome) && c.status !== 'cancelada');

    if (!ativa || typeof API === 'undefined') return;

    // Simulate file upload by converting smaller files to Base64 (or sending a mock URL if large)
    const reader = new FileReader();
    reader.onload = async function (e) {
        let fileData = e.target.result;

        // Se for muito grande, enviaremos apenas uma tag mockada para preservação de localStorage/BD
        if (file.size > 2 * 1024 * 1024) {
            fileData = 'blob:mocked-url-for-large-file'; // Simples mock para evitar crachar quota LocalStorage
        }

        const msgTexto = `[ANEXO]|${fileData}|${file.name}`;

        const resp = await API.enviarMsg(ativa.id, msgTexto);
        if (resp && resp.sucesso) {
            fileInput.value = ''; // clear input
            syncChatMedico();
        }
    };

    // Ler como bas64 para armazenar no chat
    reader.readAsDataURL(file);
}

// Inicializar listeners do painel de telemedicina
document.addEventListener('DOMContentLoaded', () => {
    // Escutar tecla Enter no chat do médico
    const chatInput = document.querySelector('#panel-chat input[type="text"]');
    if (chatInput) {
        // Exibir notificações de fila
        window.addEventListener('load', () => {
            // Código existente placeholder
        });

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') enviarMensagemChat('medico');
        });
    }
});

function toggleTelePanel() {
    const panel = document.getElementById('tele-panel');
    if (panel) {
        panel.classList.toggle('open');
    }
}

function encerrarTelemedicina() {
    if (!confirm("Encerrar chamada de vídeo com o paciente? O prontuário continuará aberto para finalização.")) return;

    // 1. Parar Timer e Câmera
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    clearInterval(teleInterval);

    // Ficar offline
    localStorage.setItem('tele_medico_online', 'false');

    // 2. Salvar Dados Preliminares (Se houver algo digitado no painel da videochamada)
    salvarTeleData();

    // 3. Fechar Sala
    document.getElementById('sala-telemedicina').style.display = 'none';

    // 4. Limpar Tela de Fundo (Cam)
    const videoEl = document.getElementById('local-video');
    if (videoEl) {
        videoEl.srcObject = null;
    }

    // 5. Acionar Modal de Conclusão Padrão do Médico
    // O modal final de atendimento já existe via botão "Salvar Atendimento" 
    // Vamos mapear os dados do PIP para o formulário principal e abri-lo

    document.getElementById('form-diagnostico').value = document.getElementById('tele-diagnostico')?.value || '';
    document.getElementById('form-prescricao').value = document.getElementById('tele-prescricao')?.value || '';

    // Mostra o formulário de finalização (Simula o clique em "Salvar Atendimento")
    carregarPreAtendimento();
}

function toggleMute(btn) {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    btn.classList.toggle('active');
    btn.innerHTML = audioTrack.enabled ? '<i class=\"fi fi-rr-microphone\"></i> ' : '🔇';
}

function toggleCam(btn) {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    btn.classList.toggle('active');
    btn.innerHTML = videoTrack.enabled ? '<i class=\"fi fi-rr-camera\"></i> ' : '🚫';
}



function salvarTeleData() {
    const queixa = document.getElementById('tele-queixa')?.value || '';
    const diagnostico = document.getElementById('tele-diagnostico')?.value || '';
    const prescricao = document.getElementById('tele-prescricao')?.value || '';

    if (!queixa && !diagnostico && !prescricao) {
        // Nada a salvar visivelmente como feedback
        return;
    }

    // Transferir dados do painel lateral (Telemedicina) para o painel principal (Diagnóstico)
    const mainQueixa = document.getElementById('queixa');
    const mainDiagnostico = document.getElementById('diagnostico-doenca');
    const mainTratamento = document.getElementById('tratamento');
    const mainFormDiag = document.getElementById('form-diagnostico');
    const mainFormPresc = document.getElementById('form-prescricao');

    if (mainQueixa) mainQueixa.value = queixa;
    if (mainDiagnostico) mainDiagnostico.value = diagnostico;
    if (mainTratamento) mainTratamento.value = prescricao;

    // Sincronizar também com o modal de finalização de atendimento, por garantia
    if (mainFormDiag) mainFormDiag.value = diagnostico;
    if (mainFormPresc) mainFormPresc.value = prescricao;

    // Feedback visual sutil (ao invés de alert)
    const btn = document.querySelector('.btn-salvar-tele');
    if (btn) {
        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class=\"fi fi-rr-check-circle\"></i>  Salvo no Prontuário Principal';
        btn.style.background = '#28a745';
        setTimeout(() => {
            btn.innerHTML = txtOriginal;
            btn.style.background = ''; // Volta ao CSS padrão
        }, 2500);
    }
}

// ── DOCUMENTOS OFICIAIS (Atestado e Receita) ──────────────────────
async function gerarDocumento(tipo) {
    const cpfPaciente = document.querySelector('#ficha-atendimento #paciente-sus')?.textContent || '';
    const pacienteNome = document.querySelector('#ficha-atendimento #paciente-nome')?.textContent || '';

    if (!pacienteNome) {
        alert('⚠️ Selecione um paciente primeiro para gerar o documento.');
        return;
    }

    const medicoNome = localStorage.getItem('usuarioNome') || 'Dr(a). Médico';
    const crm = 'CRM 12345/PR'; // Mock ou pegar do bd
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    let corpoHTML = '';
    let titulo = '';

    if (tipo === 'atestado') {
        titulo = 'ATESTADO MÉDICO';
        const dias = document.getElementById('atestado-dias').value || 1;
        const motivo = document.getElementById('atestado-motivo').value || '';
        const cid = document.getElementById('atestado-cid').value || '';

        if (!motivo) return alert('⚠️ Informe o motivo do afastamento.');

        // Hora atual
        const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dataRepouso = new Date();
        dataRepouso.setDate(dataRepouso.getDate());
        const dataRepousoStr = dataRepouso.toLocaleDateString('pt-BR');

        corpoHTML = `
            <p style="font-size: 1.05rem; line-height: 2; text-align: justify; margin-top: 10px;">
                Atesto para os devidos fins que o Sr.(a) <strong style="border-bottom: 1px solid #000;">&nbsp;&nbsp;${pacienteNome}&nbsp;&nbsp;</strong>
                portador do RG: <span style="border-bottom: 1px solid #000;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                e do CPF: <span style="border-bottom: 1px solid #000;">&nbsp;&nbsp;${cpfPaciente || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}&nbsp;&nbsp;</span>.
                Foi atendido no consultório médico no dia <span style="border-bottom: 1px solid #000;">&nbsp;&nbsp;${dataAtual}&nbsp;&nbsp;</span>
                às <span style="border-bottom: 1px solid #000;">&nbsp;&nbsp;${horaAtual}&nbsp;&nbsp;</span> horas,
                necessitando de <span style="border-bottom: 1px solid #000;">&nbsp;&nbsp;${dias}&nbsp;&nbsp;</span> dia(s) de repouso
                a partir de <span style="border-bottom: 1px solid #000;">&nbsp;&nbsp;${dataRepousoStr}&nbsp;&nbsp;</span>, por motivo de doença.
            </p>
            ${cid ? `<p style="margin-top:18px; font-size: 0.95rem; color: #555;"><strong>CID-10:</strong> ${cid}</p>` : ''}
        `;

    } else if (tipo === 'receita') {
        titulo = 'RECEITUÁRIO';
        const texto = document.getElementById('receita-texto').value || '';

        if (!texto) return alert('⚠️ Informe os medicamentos e a posologia.');

        // Convert newlines to <br> for HTML rendering
        const textoHTML = texto.replace(/\n/g, '<br><br>');

        corpoHTML = `
            <div style="font-size: 1.2rem; margin-bottom: 20px;">
                <strong>Para:</strong> ${pacienteNome}<br>
                <small style="color: #555;">CPF/SUS: ${cpfPaciente || 'Não informado'}</small>
            </div>
            <div style="margin-top: 30px; font-size: 1.2rem; line-height: 1.6; min-height: 250px;">
                ${textoHTML}
            </div>
        `;

    } else if (tipo === 'exame') {
        titulo = 'PEDIDO DE EXAMES';
        const lista    = document.getElementById('exame-lista').value || '';
        const urgencia = document.getElementById('exame-urgencia').value || 'Rotina';
        const diag     = document.getElementById('exame-diagnostico').value || '';
        const obs      = document.getElementById('exame-obs').value || '';

        if (!lista) return alert('⚠️ Informe pelo menos um exame solicitado.');

        const examesHTML = lista.split('\n').filter(e => e.trim()).map((e, i) =>
            `<tr style="background:${i%2===0?'#fff':'#f9f9f9'}">
                <td style="padding:8px 12px; border:1px solid #ddd; font-size:1rem;">${e.trim()}</td>
             </tr>`
        ).join('');

        corpoHTML = `
            <div style="margin-bottom: 20px; display:flex; gap:20px;">
                <div style="flex:1; background:#fff8e1; border:1px solid #ffe082; border-radius:8px; padding:14px;">
                    <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#e65100; margin-bottom:4px;">Paciente</div>
                    <div style="font-size:1rem; font-weight:600;">${pacienteNome}</div>
                    <div style="font-size:0.85rem; color:#666;">CPF: ${cpfPaciente || 'Não informado'}</div>
                </div>
                <div style="background:#fff8e1; border:1px solid #ffe082; border-radius:8px; padding:14px; text-align:center; min-width:140px;">
                    <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#e65100; margin-bottom:4px;">Urgência</div>
                    <div style="font-size:1.1rem; font-weight:900; color:${urgencia==='Rotina'?'#2e7d32':urgencia==='Urgente'?'#c62828':'#e65100'};">${urgencia}</div>
                </div>
            </div>
            ${diag ? `<div style="background:#f1f8e9; border-left:4px solid #558b2f; padding:10px 15px; border-radius:6px; margin-bottom:20px; font-size:0.95rem;"><strong>Diagnóstico Presumido:</strong> ${diag}</div>` : ''}
            <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
                <thead>
                    <tr style="background:#e65100; color:white;">
                        <th style="padding:10px 12px; text-align:left; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px;">Exame Solicitado</th>
                    </tr>
                </thead>
                <tbody>${examesHTML}</tbody>
            </table>
            ${obs ? `<div style="background:#f5f5f5; padding:12px 15px; border-radius:6px; font-size:0.9rem; color:#555;"><strong>Obs. Clínicas:</strong> ${obs}</div>` : ''}
        `;

    } else if (tipo === 'encaminhamento') {
        titulo = 'ENCAMINHAMENTO MÉDICO';
        const especialidade = document.getElementById('encaminh-especialidade').value || '';
        const prioridade    = document.getElementById('encaminh-prioridade').value || 'Eletivo';
        const motivo        = document.getElementById('encaminh-motivo').value || '';
        const historia      = document.getElementById('encaminh-historia').value || '';

        if (!motivo) return alert('⚠️ Informe o motivo do encaminhamento.');

        const corPrioridade = prioridade === 'Eletivo' ? '#2e7d32' : prioridade === 'Prioritário' ? '#e65100' : '#c62828';

        corpoHTML = `
            <div style="display:flex; gap:16px; margin-bottom:24px; flex-wrap:wrap;">
                <div style="flex:1; min-width:180px; background:#f3e5f5; border:1px solid #ce93d8; border-radius:8px; padding:14px;">
                    <div style="font-size:0.72rem; text-transform:uppercase; font-weight:700; color:#6a1b9a; margin-bottom:4px;">Paciente</div>
                    <div style="font-size:1rem; font-weight:700;">${pacienteNome}</div>
                    <div style="font-size:0.82rem; color:#666;">CPF: ${cpfPaciente || 'Não informado'}</div>
                </div>
                <div style="flex:1; min-width:180px; background:#f3e5f5; border:1px solid #ce93d8; border-radius:8px; padding:14px;">
                    <div style="font-size:0.72rem; text-transform:uppercase; font-weight:700; color:#6a1b9a; margin-bottom:4px;">Especialidade de Destino</div>
                    <div style="font-size:1.05rem; font-weight:900; color:#4a148c;">${especialidade}</div>
                </div>
                <div style="min-width:120px; background:#f3e5f5; border:1px solid #ce93d8; border-radius:8px; padding:14px; text-align:center;">
                    <div style="font-size:0.72rem; text-transform:uppercase; font-weight:700; color:#6a1b9a; margin-bottom:4px;">Prioridade</div>
                    <div style="font-size:1.05rem; font-weight:900; color:${corPrioridade};">${prioridade}</div>
                </div>
            </div>

            <div style="background:#fce4ec; border-left:4px solid #c62828; padding:14px 18px; border-radius:8px; margin-bottom:20px;">
                <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#b71c1c; margin-bottom:6px;">Hipótese Diagnóstica / Motivo do Encaminhamento</div>
                <div style="font-size:1rem; line-height:1.6;">${motivo}</div>
            </div>

            ${historia ? `
            <div style="background:#f9f9f9; border:1px solid #e0e0e0; padding:14px 18px; border-radius:8px; margin-bottom:20px;">
                <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#555; margin-bottom:6px;">História Clínica Resumida</div>
                <div style="font-size:0.95rem; line-height:1.7; color:#333;">${historia.replace(/\n/g, '<br>')}</div>
            </div>` : ''}

            <div style="background:#e8f5e9; border:1px solid #a5d6a7; padding:12px 18px; border-radius:8px; font-size:0.88rem; color:#1b5e20;">
                <strong>Médico Solicitante:</strong> ${medicoNome} &nbsp;|&nbsp; Data: ${dataAtual}
            </div>
        `;
    }


    // Busca CRM do médico logado (se disponível)
    let crmMedico = 'CRM 12345/PR';
    try {
        const usuarioId = localStorage.getItem('usuarioId');
        if (typeof API !== 'undefined' && usuarioId) {
            const perfil = await API.perfilMedico?.();
            if (perfil && perfil.crm) crmMedico = perfil.crm;
        }
    } catch(e) {}

    const logoSrc = window.location.protocol === 'file:' 
        ? 'logo-saude-facil.png' 
        : (window.location.origin + '/logo-saude-facil.png');

    const docLayout = `
        <div class="pdf-container" style="background: #fff; width: 100%; max-width: 750px; margin: 0 auto; box-sizing: border-box; font-family: 'Arial', sans-serif; color: #000; position: relative; padding: 40px 50px;">
            
            <!-- HEADER INSTITUCIONAL NO ESTILO DO MODELO -->
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <img src="logo-saude-facil.png" alt="Saúde Fácil" style="height: 55px; object-fit: contain;" onerror="this.style.display='none'">
                    <div>
                        <div style="font-weight: 900; font-size: 1rem; color: #004b82; letter-spacing: 0.5px;">Portal Saúde Fácil</div>
                        <div style="font-size: 0.78rem; color: #444; line-height: 1.5;">
                            Unidade de Atendimento — CEEP Cascavel<br>
                            Cascavel/PR &nbsp;|&nbsp; Tel: (45) 3000-0000
                        </div>
                    </div>
                </div>
                <div style="font-size: 0.72rem; color: #777; text-align: right;">
                    Emitido em: ${dataAtual}<br>
                    Portal de Saúde Digital
                </div>
            </div>

            <!-- TÍTULO PRINCIPAL -->
            <h2 style="text-align: center; font-size: 1.3rem; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; margin: 30px 0 40px 0; color: #000;">
                ${titulo}
            </h2>

            <!-- CORPO DO DOCUMENTO -->
            <div style="min-height: 320px;">
                ${corpoHTML}
            </div>

            <!-- ÁREA DE ASSINATURA (ESTILO DO MODELO) -->
            <div style="margin-top: 80px; display: flex; justify-content: space-between; align-items: flex-end;">
                <!-- DATA / LOCAL -->
                <div style="text-align: center; width: 220px;">
                    <div style="border-top: 1.5px solid #000; padding-top: 8px; font-size: 0.85rem; font-weight: 600; letter-spacing: 1px;">DATA / LOCAL</div>
                </div>

                <!-- ASSINATURA MÉDICO -->
                <div style="text-align: center; width: 250px;">
                    <div style="font-weight: 900; font-size: 1rem; margin-bottom: 3px;">${medicoNome}</div>
                    <div style="font-size: 0.82rem; color: #555;">Médico(a) - ${crmMedico}</div>
                    <div style="border-top: 1.5px solid #000; padding-top: 8px; margin-top: 10px; font-size: 0.85rem; font-weight: 600; letter-spacing: 1px;">MÉDICO</div>
                </div>
            </div>

            <!-- RODAPÉ -->
            <div style="margin-top: 30px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 0.72rem; color: #888; text-align: center;">
                Este documento é de uso exclusivo para fins médicos e legais. Portal Saúde Fácil — Cascavel/PR.
            </div>
            
        </div>
    `;


    // Render Preview
    document.getElementById('preview-conteudo').innerHTML = docLayout;
    document.getElementById('preview-documento').style.display = 'block';

    // Set Print Area (Only visible during @media print)
    const printArea = document.getElementById('area-impressao-documento');
    if (printArea) {
        printArea.innerHTML = docLayout;
        printArea.style.display = 'block';
    }

    // --- SALVAR PARA O PACIENTE VER NO PERFIL ---
    try {
        let docs = JSON.parse(localStorage.getItem('documentos_paciente') || '{}');
        if (!docs[cpfPaciente]) docs[cpfPaciente] = [];
        docs[cpfPaciente].push({
            id: Date.now(),
            tipo: tipo === 'atestado' ? 'Atestado Médico' : 'Receituário',
            data: dataAtual + ' ' + new Date().toLocaleTimeString(),
            medico: medicoNome,
            html: docLayout
        });
        localStorage.setItem('documentos_paciente', JSON.stringify(docs));
    } catch (e) { console.error("Erro ao salvar doc:", e); }
}

function fecharPreview() {
    document.getElementById('preview-documento').style.display = 'none';
    const printArea = document.getElementById('area-impressao-documento');
    if (printArea) printArea.style.display = 'none';
}

function imprimirDocumento() {
    window.print();
    fecharPreview();
}

// ── TELEMEDICINA - PIP SWAP ROBUSTO ───────────────────────────
window.toggleVideoLayout = function () {
    const mainContainer = document.getElementById('video-container-remote');
    const pipContainer = document.getElementById('video-container-local');

    if (!mainContainer || !pipContainer) return;

    // Salvar referências dos elementos
    const mainChildren = Array.from(mainContainer.children);
    const pipChildren = Array.from(pipContainer.children);

    // Encontrar o botão de swap, remover temporariamente
    const swapBtn = pipContainer.querySelector('.btn-swap');
    if (swapBtn) swapBtn.remove();

    // Limpar containers
    mainContainer.innerHTML = '';
    pipContainer.innerHTML = '';

    // Inverter anexação
    pipChildren.forEach(child => {
        if (!child.classList.contains('btn-swap')) {
            mainContainer.appendChild(child);
        }
    });

    mainChildren.forEach(child => {
        pipContainer.appendChild(child);
    });

    // Devolver o botão para o PIP em sua nova configuração
    if (swapBtn) pipContainer.appendChild(swapBtn);
}

// ── PRESCRIÇÃO ENFERMAGEM (FASE 4) ─────────────────────────────
async function salvarPrescricaoEnfe(event) {
    event.preventDefault();

    if (!pacienteEmAtendimento) {
        alert('Nenhum paciente selecionado.');
        return;
    }

    const med = document.getElementById('presc-medicamento').value;
    const dos = document.getElementById('presc-dosagem').value;
    const via = document.getElementById('presc-via').value;
    const freq = document.getElementById('presc-frequencia').value;
    const obs = document.getElementById('presc-obs').value;

    const dados = {
        paciente_cpf: pacienteEmAtendimento.cpf,
        medicamento: med,
        dosagem: dos,
        frequencia: freq,
        via: via,
        observacoes: obs
    };

    if (typeof API !== 'undefined') {
        const resp = await API.prescreverEnfermagem(dados);
        if (resp && resp.sucesso) {
            alert('<i class=\"fi fi-rr-medicine\"></i>  Prescrição enviada para o Painel da Enfermagem com sucesso!');

            // Adicionar ao histórico visual da tela
            adicionarPrescricaoVisual(med, dos, via, freq);

            // Limpa form
            document.getElementById('form-prescricao-enf').reset();
            return;
        }
        alert('<i class=\"fi fi-rr-cross-circle\"></i>  Erro ao enviar prescrição: ' + (resp ? resp.erro : 'Offine'));
    } else {
        alert('<i class=\"fi fi-rr-cross-circle\"></i>  Sistema Operando Offline. Funcionalidade indisponível.');
    }
}

function adicionarPrescricaoVisual(med, dos, via, freq) {
    const hist = document.getElementById('historico-prescricoes-atual');
    if (!hist) return;

    if (hist.innerHTML.includes('Nenhuma prescrição enviada ainda.')) {
        hist.innerHTML = '';
    }

    const item = document.createElement('div');
    item.style = 'border-bottom: 1px solid #ddd; padding: 10px 0; font-size: 0.95rem;';
    item.innerHTML = `
        <span style="color: #c0392b; font-weight: bold;">${med}</span> - ${dos} <br>
        <small style="color: #666;">Via: ${via} | Frequência: ${freq}</small>
    `;
    hist.appendChild(item);
}


// ── TELEMEDICINA DO MÉDICO ──────────────────────────────
window.salvarConfigTeleMini = async function() {
    const isAtivo = document.getElementById('toggle-telemed').checked;
    const link = document.getElementById('link-sala-padrao').value;
    if (typeof API === 'undefined') return;
    try {
        const resp = await API.teleConfigPerfil({ tipo_atendimento: isAtivo ? 'ambos' : 'presencial', link_sala_padrao: link });
        if(resp && resp.sucesso) { console.log('Configurações de telemedicina salvas com sucesso!'); }
    } catch(err) { console.error(err); }
};

// ── CONTROLE DE PRESENÇA PRESENCIAL REAL-TIME ────────────────────
window.togglePresencaPresencial = async function(checkbox) {
    const label = document.getElementById('label-presenca-status');
    const isChecked = checkbox.checked;
    
    if (label) {
        if (isChecked) {
            label.textContent = 'PRESENTE';
            label.style.color = '#28a745';
        } else {
            label.textContent = 'AUSENTE';
            label.style.color = '#dc3545';
        }
    }
    
    if (typeof API !== 'undefined') {
        try {
            const resp = await API.atualizarPresencaMedico(isChecked);
            if (resp && resp.sucesso) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2500,
                    timerProgressBar: true,
                    background: '#0f172a',
                    color: '#f8fafc',
                    customClass: {
                        popup: 'swal-premium-toast'
                    },
                    title: isChecked 
                        ? `<div style="display: flex; align-items: center; gap: 8px; font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 600;">
                             <i class="fi fi-rr-check-circle" style="color: #00ff88; font-size: 1.15rem; display: flex; align-items: center;"></i>
                             <span>Presença confirmada na clínica!</span>
                           </div>`
                        : `<div style="display: flex; align-items: center; gap: 8px; font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 600;">
                             <i class="fi fi-rr-cross-circle" style="color: #ff7675; font-size: 1.15rem; display: flex; align-items: center;"></i>
                             <span>Status alterado para Ausente.</span>
                           </div>`
                });
            } else {
                throw new Error(resp.erro || 'Falha ao atualizar.');
            }
        } catch (err) {
            console.error(err);
            // Reverter em caso de falha
            checkbox.checked = !isChecked;
            if (label) {
                label.textContent = !isChecked ? 'PRESENTE' : 'AUSENTE';
                label.style.color = !isChecked ? '#28a745' : '#dc3545';
            }
            Swal.fire({
                icon: 'error',
                title: 'Erro de Conexão',
                text: 'Não foi possível atualizar seu status de presença no servidor.'
            });
        }
    }
};
