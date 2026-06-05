// --- ESTADO GLOBAL ---
let wizardState = {
    step: 1,
    specialty: null,
    doctor: null,
    date: null,
    time: null,
    queixa: null,
    consultaId: null
};

document.addEventListener('DOMContentLoaded', async () => {
    await initTelemedicina();
});

async function initTelemedicina() {
    if (typeof API === 'undefined') return;

    // Check session
    const sessao = await API.sessao();
    const root = document.getElementById('telemed-root');

    // Hide all sections first
    document.querySelectorAll('.telemed-section').forEach(s => s.classList.remove('active'));

    // Also check localStorage as fallback for consistency with agendamento.html
    const localLogado = localStorage.getItem('usuarioLogado') === 'true';
    
    // Use API response (logado) or fallback to localStorage
    if (!sessao || !sessao.logado || !localLogado) {
        document.getElementById('section-unauth').classList.add('active');
        return;
    }

    // Determine user type from session or localStorage
    const tipoUsuario = (sessao && sessao.usuario) ? sessao.usuario.tipo : localStorage.getItem('tipoUsuario');
    
    if (tipoUsuario === 'enfermeiro' || tipoUsuario === 'admin' || tipoUsuario === 'ti') {
        Swal.fire({
            icon: 'info',
            title: 'Acesso Restrito',
            text: 'O portal de Telemedicina é exclusivo para Médicos e Pacientes.',
            confirmButtonText: 'Voltar ao meu painel',
            allowOutsideClick: false
        }).then(() => {
            if (tipoUsuario === 'enfermeiro') window.location.href = 'enfermeiro.html';
            else if (tipoUsuario === 'admin') window.location.href = 'admin.html';
            else if (tipoUsuario === 'ti') window.location.href = 'ti.html';
        });
        return;
    }

    if (tipoUsuario === 'medico') {
        document.getElementById('section-medico').classList.add('active');
        document.getElementById('page-subtitle').innerText = "Painel de Atendimento Médico";
        carregarAgendaMedico();
        carregarConfigMedico();
        // Atualização automática a cada 30s
        setInterval(carregarAgendaMedico, 30000);
    } else {
        document.getElementById('section-paciente').classList.add('active');
        carregarConsultasPaciente();
        // Atualização automática a cada 30s
        setInterval(carregarConsultasPaciente, 30000);
    }

    // Check for room parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('sala')) {
        const cid = urlParams.get('id');
        abrirSalaTelemedicina(cid);
    }
}

function switchTab(role, tabId) {
    // Hide all contents in the role section
    const section = document.getElementById(`section-${role}`);
    section.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    section.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // Show selected
    document.getElementById(`${role}-${tabId}`).classList.add('active');

    // Find button and activate
    const btn = Array.from(section.querySelectorAll('.tab-btn')).find(b => b.innerText.toLowerCase().includes(tabId.toLowerCase()) || b.getAttribute('onclick').includes(tabId));
    if (btn) btn.classList.add('active');
}

// --- MÉDICO LOGIC ---

let ultimaQtdConsultas = 0;

async function carregarAgendaMedico() {
    const list = await API.teleConsultas();
    const container = document.getElementById('medico-consultas-list');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = '<div class="glass-neon-card" style="padding:20px; grid-column:1/-1; text-align:center;">Nenhuma consulta agendada.</div>';
        return;
    }

    // Alerta sonoro se houver novas consultas
    if (list.length > ultimaQtdConsultas && ultimaQtdConsultas !== 0) {
        speakText("Atenção doutor, um novo paciente acaba de agendar uma consulta.");
        // Opcional: tocar um som curto
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
        audio.play().catch(e => console.log("Áudio bloqueado pelo navegador"));
    }
    ultimaQtdConsultas = list.length;

    const hoje = new Date().toISOString().split('T')[0];
    const consultasHoje = list.filter(c => c.data === hoje);
    document.getElementById('count-hoje').innerText = consultasHoje.length;
    document.getElementById('count-atendidas').innerText = list.filter(c => c.status === 'finalizada').length;

    container.innerHTML = '';
    list.forEach(c => {
        const card = document.createElement('div');
        card.className = 'consulta-card-neon';
        const dataFmt = c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '--';
        
        // Lógica de tempo para o botão
        const agora = new Date();
        const dataConsulta = new Date(`${c.data}T${c.hora}:00`);
        const diffMs = dataConsulta - agora;
        const diffMin = diffMs / (1000 * 60);
        
        let botaoHtml = '';
        if (c.status === 'finalizada') {
            botaoHtml = '<button class="btn-neon-health" style="opacity:0.5; cursor:default; background:#333;">FINALIZADA</button>';
        } else if (diffMin > 15) {
            botaoHtml = `<button class="btn-neon-health" style="opacity:0.6; cursor:not-allowed; background: #222;" disabled>AGUARDE (${c.hora})</button>`;
        } else {
            botaoHtml = `<button class="btn-neon-health pulse-neon" onclick="abrirSalaTelemedicina(${c.id})">ENTRAR NA SALA</button>`;
        }

        card.innerHTML = `
            <div class="card-header-tele">
                <span class="status-badge status-${c.status}">${c.status.replace('_', ' ')}</span>
                <span style="font-size: 0.8rem; opacity: 0.7;">#${c.id}</span>
            </div>
            <div style="display: flex; gap: 15px; align-items: center;">
                <img src="${c.paciente_foto || 'https://via.placeholder.com/50'}" style="width:50px; height:50px; border-radius:50%; border:2px solid var(--neon-cyan);">
                <div>
                    <h4 style="margin:0;">${c.paciente_nome}</h4>
                    <p style="margin:0; font-size:0.8rem; opacity:0.8;">CPF: ${c.paciente_cpf}</p>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-bottom: 10px;">
                <span><i class='fi fi-rr-calendar'></i>  ${dataFmt}</span>
                <span>⏰ ${c.hora}</span>
            </div>
            ${botaoHtml}
        `;
        container.appendChild(card);
    });
}

async function carregarConfigMedico() {
    // Seria ideal ter uma rota de perfil específica, mas vamos mockar ou usar o que temos
    const sessao = await API.sessao();
    // No backend telemedicina.py criamos o config-perfil, mas precisamos do GET
    // Por enquanto, apenas preenchemos se houver dados na sessao ou deixamos vazio
}

async function salvarConfigTele(event) {
    event.preventDefault();
    const dados = {
        tipo_atendimento: document.getElementById('tele-tipo-atendimento').value,
        unidade_vinculada: document.getElementById('tele-unidade').value,
        horarios_tele_json: document.getElementById('tele-horarios').value
    };

    showHealthLoader('Salvando configurações...');
    const resp = await API.teleConfigPerfil(dados);
    hideHealthLoader();

    if (resp && resp.sucesso) {
        Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Configurações salvas com sucesso!' });
    } else {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao salvar configurações.' });
    }
}

// --- PACIENTE LOGIC ---

async function carregarConsultasPaciente() {
    // Agora buscamos TODAS as consultas (Normal + Telemedicina)
    const list = await API.minhasConsultas();
    const container = document.getElementById('minhas-consultas-list');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = '<div class="glass-neon-card" style="padding:20px; grid-column:1/-1; text-align:center;">Você ainda não possui agendamentos.</div>';
        return;
    }

    container.innerHTML = '';
    list.forEach(c => {
        const card = document.createElement('div');
        card.className = 'consulta-card-neon';
        
        const isTele = c.tipo === 'telemedicina';
        const tipoIcon = isTele ? '<i class="fi fi-rr-laptop"></i> TELE' : '<i class="fi fi-rr-hospital"></i> PRESENCIAL';
        const tipoClass = isTele ? 'badge-tele' : 'badge-presencial';

        const dataFmt = c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '--';
        
        const statusBaixo = (c.status || '').toLowerCase();
        const cancelable = statusBaixo === 'agendado' || statusBaixo === 'confirmado' || statusBaixo === 'confirmada' || statusBaixo === 'aguardando';
        
        let cancelBtnHtml = '';
        if (cancelable) {
            cancelBtnHtml = `<button class="btn-neon-health" style="background:#ff7675; border-color:#d63031; margin-top:8px; width:100%; font-weight:bold; cursor:pointer;" onclick="window.cancelarConsultaPacienteTelemedicina(${c.id})">❌ DESMARCAR CONSULTA</button>`;
        }

        let acaoBotao = '';
        if (isTele && c.status !== 'cancelada') {
            acaoBotao = `
                <button class="btn-neon-health" onclick="abrirSalaTelemedicina(${c.id})">ENTRAR NA SALA</button>
                ${cancelBtnHtml}
            `;
        } else {
            acaoBotao = `
                <button class="btn-neon-health" style="background: rgba(255,255,255,0.1); cursor:default; border:1px solid #444;">VER DETALHES</button>
                ${cancelBtnHtml}
            `;
        }

        card.innerHTML = `
            <div class="card-header-tele">
                <span class="status-badge status-${c.status}">${c.status.toUpperCase()}</span>
                <span class="tipo-badge ${tipoClass}" style="font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; background: rgba(0,255,255,0.1); color: var(--neon-cyan); border: 1px solid var(--neon-cyan);">${tipoIcon}</span>
            </div>
            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px;">
                <img src="${c.medico_foto || 'https://via.placeholder.com/50'}" style="width:50px; height:50px; border-radius:50%; border:2px solid var(--neon-cyan);">
                <div>
                    <h4 style="margin:0;">${c.medico || 'Médico'}</h4>
                    <p style="margin:0; font-size:0.8rem; opacity:0.8;">${c.especialidade || 'Clínico Geral'}</p>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-bottom: 10px;">
                <span>📅 ${dataFmt}</span>
                <span>⏰ ${c.hora}</span>
            </div>
            ${acaoBotao}
        `;
        container.appendChild(card);
    });
}

window.cancelarConsultaPacienteTelemedicina = async function(id) {
    if (typeof API === 'undefined') return;

    const result = await Swal.fire({
        title: 'Desmarcar Consulta?',
        text: 'Você tem certeza que deseja cancelar esta consulta?',
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
            // Sincroniza LocalStorage
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
                text: 'Sua consulta foi desmarcada com sucesso.',
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

// --- FUNÇÕES DE NAVEGAÇÃO DO WIZARD ---
function nextStep() {
    if (!validateStep()) return;

    // Capturar queixa se estiver saindo do passo 3
    if (wizardState.step === 3) {
        const queixaEl = document.getElementById('tele-queixa');
        if (queixaEl) {
            wizardState.queixa = queixaEl.value;
        }
    }

    wizardState.step++;
    updateUI();
    speakStepTitle();
}

function prevStep() {
    if (wizardState.step > 1) {
        wizardState.step--;
        updateUI();
    }
}

function updateUI() {
    // Esconder todos os passos
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));

    // Mostrar passo atual
    const currentStepEl = document.getElementById(`step-${wizardState.step}`);
    if (currentStepEl) {
        currentStepEl.classList.add('active');
    }

    // Atualizar indicadores (bolinhas)
    document.querySelectorAll('.step-dot').forEach((dot, index) => {
        const stepNum = index + 1;
        if (stepNum < wizardState.step) {
            dot.classList.add('completed');
            dot.classList.remove('active');
            dot.innerHTML = '✓';
        } else if (stepNum === wizardState.step) {
            dot.classList.add('active');
            dot.classList.remove('completed');
            dot.innerHTML = stepNum;
        } else {
            dot.classList.remove('active', 'completed');
            dot.innerHTML = stepNum;
        }
    });

    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');

    btnPrev.style.display = wizardState.step === 1 ? 'none' : 'block';

    // Ajustar lógica de botão próximo/final
    if (wizardState.step === 4) {
        btnNext.style.display = 'none';
        btnPrev.style.display = 'none'; // Esconder voltar na confirmação final
    } else {
        btnNext.style.display = 'block';
    }

    // Lógica específica por passo
    if (wizardState.step === 3) {
        renderCalendar(); // Gerar dias ao entrar no passo 3
    }
    if (wizardState.step === 4) {
        generateTicket();
    }
}

function validateStep() {
    if (wizardState.step === 1 && !wizardState.specialty) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, selecione uma especialidade.' });
        return false;
    }
    if (wizardState.step === 2 && !wizardState.doctor) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, selecione um médico da lista.' });
        return false;
    }
    if (wizardState.step === 3 && (!wizardState.date || !wizardState.time)) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, escolha uma data e um horário disponível.' });
        return false;
    }
    // Passo 4 é confirmação, não precisa validar entrada anterior pois Delivery foi removido
    return true;
}

// --- SELEÇÃO DE ESPECIALIDADE ---
function selectSpecialty(specialtyId) {
    wizardState.specialty = specialtyId;

    // Highlight visual
    document.querySelectorAll('.specialty-card').forEach(card => card.style.borderColor = 'transparent');
    event.currentTarget.style.borderColor = '#004b82';

    // Carregar médicos
    renderDoctors(specialtyId);

    // Auto-avanço para idosos (menos cliques)
    setTimeout(nextStep, 500);
}

// --- RENDERIZAR MÉDICOS ---
async function renderDoctors(specialtyId) {
    const container = document.getElementById('doctors-list');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px; text-align:center;">Carregando médicos...</p>';

    let list = [];
    if (typeof API !== 'undefined') {
        list = await API.listarMedicos(specialtyId);
    }

    if (!list || list.length === 0) {
        container.innerHTML = '<p style="padding:20px; text-align:center; color: #888;">Nenhum médico disponível nesta especialidade no momento.</p>';
        return;
    }

    container.innerHTML = '';
    list.forEach(doc => {
        const div = document.createElement('div');
        div.className = 'doctor-card';
        div.innerHTML = `
            <img src="${doc.imagem || 'https://via.placeholder.com/80'}" class="doctor-img" alt="${doc.nome}">
            <div class="doctor-info">
                <h3>${doc.nome}</h3>
                <div class="doctor-rating">⭐️ 4.9 • CRM: ${doc.crm || 'XXXXX'}</div>
                <div style="color: green; font-weight: bold; font-size: 0.85rem;">● Disponível Agora</div>
            </div>
            <button class="btn-select-doctor" onclick="selectDoctor(${doc.id}, '${doc.nome}')">Selecionar</button>
        `;
        container.appendChild(div);
    });
}

function selectDoctor(id, name) {
    wizardState.doctor = { id, name };
    nextStep();
}

// --- LÓGICA DE CALENDÁRIO (PASSO 3) ---
function renderCalendar() {
    const container = document.getElementById('calendar-days');
    // Só renderizar se ainda não tiver feito (evita resetar seleção ao voltar)
    if (container.children.length > 0) return;

    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let today = new Date();

    let html = '';
    // Gerar próximos 7 dias
    for (let i = 0; i < 7; i++) {
        let d = new Date(today);
        d.setDate(today.getDate() + i);

        // Formatar dia e dia da semana
        let dayName = days[d.getDay()];
        let dayNum = d.getDate();
        let fullDate = d.toISOString().split('T')[0]; // YYYY-MM-DD

        html += `
            <div class="calendar-day" onclick="selectDate('${fullDate}', this)">
                <div class="day-week">${dayName}</div>
                <div class="day-number">${dayNum}</div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function selectDate(dateStr, element) {
    wizardState.date = dateStr;
    wizardState.time = null; // Resetar horário ao mudar dia

    // Visual update
    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    // Carregar horários
    renderTimeSlots();
}

function renderTimeSlots() {
    const container = document.getElementById('time-slots');
    container.innerHTML = '';

    // Mock de horários disponíveis
    const slots = ['08:00', '09:00', '09:30', '10:30', '14:00', '15:30', '16:00', '17:00'];

    slots.forEach(time => {
        // Simular alguns horários indisponíveis aleatoriamente
        const isUnavailable = Math.random() > 0.7;

        const div = document.createElement('div');
        div.className = `time-slot ${isUnavailable ? 'unavailable' : ''}`;
        div.innerText = time;

        if (!isUnavailable) {
            div.onclick = () => selectTime(time, div);
        }

        container.appendChild(div);
    });
}

function selectTime(time, element) {
    wizardState.time = time;

    document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    // Auto-avanço opcional
    // setTimeout(nextStep, 500); 
}

// --- SELEÇÃO DE MÉTODO DE ENVIO ---
function selectDelivery(method, element) {
    wizardState.deliveryMethod = method;

    // Visual update
    document.querySelectorAll('.delivery-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

// --- GERAR TICKET FINAL ---
async function generateTicket() {
    const container = document.getElementById('ticket-display');
    if (!container) return;

    // Tentar via API
    if (typeof API !== 'undefined') {
        const resp = await API.agendar({
            medico_id: wizardState.doctor.id,
            especialidade: wizardState.specialty,
            data: wizardState.date,
            hora: wizardState.time,
            tipo: 'telemedicina',
            queixa: wizardState.queixa
        });

        if (resp && resp.sucesso) {
            wizardState.consultaId = resp.id;
            localStorage.setItem('ultima_consulta_id', resp.id);
        }
    }

    const dateFormatted = new Date(wizardState.date + 'T00:00:00').toLocaleDateString('pt-BR');

    const isLogged = localStorage.getItem('usuarioLogado') === 'true';
    let isTime = false;
    let buttonHtml = '';

    if (wizardState.date && wizardState.time) {
        const appointmentTime = new Date(`${wizardState.date}T${wizardState.time}:00`);
        const now = new Date();
        const diffMin = (appointmentTime - now) / (1000 * 60);

        if (diffMin <= 30 && diffMin >= -60) {
            isTime = true;
        }

        if (!isLogged) {
            buttonHtml = `<button onclick="window.location.href='index.html'" class="btn-videochamada" style="background:#e0e0e0; color:#333; cursor:pointer;">Faça LOGIN para entrar</button>`;
        } else if (isTime) {
            buttonHtml = `<button onclick="window.location.href='telemedicina.html?sala=ativa&id=${wizardState.consultaId || ''}'" class="btn-videochamada">ENTRAR NA VIDEOCHAMADA AGORA</button>`;
        } else {
            const diaFmt = appointmentTime.toLocaleDateString('pt-BR');
            buttonHtml = `<button disabled class="btn-videochamada" style="background:#ccc; cursor:not-allowed;">Aguarde ${diaFmt} às ${wizardState.time}</button>`;
        }
    }

    const finalMedicoNome = wizardState.doctor.name;
    const finalEspecialidade = wizardState.specialty;
    const finalData = wizardState.date;
    const finalHora = wizardState.time;
    const finalModalidade = 'telemedicina';
    const finalUnidade = 'Telemedicina Virtual';

    container.innerHTML = `
        <div class="ticket-container">
            <h2><i class='fi fi-rr-party-horn'></i>  Agendado com Sucesso!</h2>
            <div style="background: #e8f4fd; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: left; border: 1px solid #b6d4fe; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div style="background: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"><i class='fi fi-rr-stethoscope'></i> </div>
                    <div>
                        <strong style="color: #004b82; font-size: 1.2rem;">${finalMedicoNome}</strong><br>
                        <span style="color: #555; font-size: 0.95rem;">${finalEspecialidade}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 30px; border-top: 1px solid rgba(0,75,130,0.1); padding-top: 15px;">
                    <div><small style="color: #666; font-weight: 600; text-transform: uppercase; font-size: 0.75rem;"><i class='fi fi-rr-calendar'></i>  Data</small><br><strong style="font-size: 1.1rem; color: #333;">${dateFormatted}</strong></div>
                    <div><small style="color: #666; font-weight: 600; text-transform: uppercase; font-size: 0.75rem;">⏰ Horário</small><br><strong style="font-size: 1.1rem; color: #333;">${finalHora}</strong></div>
                </div>
            </div>
            ${buttonHtml}

            <!-- Integração WhatsApp & Agenda -->
            <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px; text-align: center;">
                <button onclick="notificarWhatsApp('${finalMedicoNome.replace(/'/g, "\\'")}', '${finalEspecialidade.replace(/'/g, "\\'")}', '${finalData}', '${finalHora}', '${finalModalidade}')" style="background: #25d366; color: white; border: none; border-radius: 8px; padding: 12px; font-weight: bold; cursor: pointer; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.2); transition: all 0.2s; width: 100%;">
                    💬 Enviar Confirmação p/ WhatsApp
                </button>
                <div style="display: flex; gap: 10px; width: 100%;">
                    <a href="${gerarLinkGoogleCalendar('Consulta: ' + finalMedicoNome, finalData, finalHora, finalModalidade, finalUnidade)}" target="_blank" style="flex: 1; background: #4285f4; color: white; border-radius: 8px; padding: 12px; font-weight: bold; text-decoration: none; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 10px rgba(66, 133, 244, 0.2); text-align: center;">
                        📅 Google Calendar
                    </a>
                    <button onclick="baixarICS('Consulta: ${finalMedicoNome.replace(/'/g, "\\'")}', '${finalData}', '${finalHora}', '${finalModalidade}', '${finalUnidade}')" style="flex: 1; background: #f1f3f4; color: #3c4043; border: 1px solid #dadce0; border-radius: 8px; padding: 12px; font-weight: bold; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 6px;">
                        📥 Baixar .ICS
                    </button>
                </div>
            </div>
            
            <style>
                @keyframes pulseWarning {
                    0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 193, 7, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
                }
                .tele-warning-card {
                    margin-top: 25px;
                    padding: 18px 20px;
                    background: linear-gradient(145deg, #fffbeb, #fef3c7);
                    color: #92400e;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    text-align: left;
                    border: 1px solid #fcd34d;
                    box-shadow: 0 4px 15px rgba(251, 191, 36, 0.15);
                    animation: pulseWarning 2.5s infinite;
                    display: flex;
                    gap: 15px;
                    align-items: flex-start;
                    line-height: 1.5;
                }
                .tele-warning-icon {
                    font-size: 1.5rem;
                    line-height: 1;
                    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));
                }
                .tele-warning-title {
                    display: block;
                    font-weight: 700;
                    margin-bottom: 4px;
                    color: #b45309;
                    font-size: 1rem;
                }
                .btn-home-link {
                    display: inline-block;
                    margin-top: 25px;
                    padding: 12px 24px;
                    color: #004b82;
                    font-weight: 700;
                    text-decoration: none;
                    border-radius: 8px;
                    transition: all 0.2s ease;
                    background: transparent;
                }
                .btn-home-link:hover {
                    background: #f1f8ff;
                    box-shadow: 0 2px 5px rgba(0,75,130,0.1);
                }
            </style>
            
            <div class="tele-warning-card">
                <div class="tele-warning-icon">⚠️</div>
                <div>
                    <span class="tele-warning-title">Informação Importante para sua Consulta</span>
                    Para entrar nesta videochamada no horário marcado, você precisará <strong>fazer Login</strong> como paciente e acessar a área <strong>Meu Perfil &gt; Minhas Consultas Agendadas</strong>, ou buscar pelo alerta de Próxima Consulta na página inicial.
                </div>
            </div>
            
            <a href="index.html" class="btn-home-link">← Voltar para a Página Inicial</a>
        </div>
    `;
}

// --- UTILITÁRIOS ---
function processDelivery(method, link) {
    if (method === 'whatsapp') {
        const msg = `Olá! Segue o link da sua consulta: ${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } else if (method === 'email') {
        Swal.fire({
            icon: 'info',
            title: 'Simulação de E-mail',
            html: `<i class='fi fi-rr-envelope'></i>  Um e-mail simulado foi enviado para o paciente com o link:<br><br><small>${link}</small>`
        });
    } else if (method === 'sms') {
        Swal.fire({
            icon: 'info',
            title: 'Simulação de SMS',
            html: `<i class='fi fi-rr-smartphone'></i>  Um SMS simulado foi enviado com o link:<br><br><small>${link}</small>`
        });
    } else if (method === 'messenger') {
        window.open(`http://m.me/`, '_blank'); // Link genérico para messenger
    }
}

function formatDeliveryName(method) {
    const names = {
        whatsapp: 'WhatsApp',
        email: 'E-mail',
        sms: 'SMS',
        messenger: 'Facebook Messenger',
        site: 'Tela do Site'
    };
    return names[method] || method;
}

function copyLink(text) {
    navigator.clipboard.writeText(text);
    Swal.fire({ icon: 'success', title: 'Copiado', text: 'Link copiado para a área de transferência!', timer: 2000, showConfirmButton: false });
}

// --- ACESSIBILIDADE ---
let isSoundOn = true;

function toggleContrast() {
    document.body.classList.toggle('high-contrast');
}

function toggleFontSize() {
    document.body.classList.toggle('font-large');
}

function toggleSound() {
    isSoundOn = !isSoundOn;
    const btn = document.getElementById('btn-sound');

    if (isSoundOn) {
        btn.innerHTML = '<i class=\"fi fi-rr-volume\"></i>  Som Ligado';
        // Feedback sonoro ao ligar
        speakText('Voz ativada');
    } else {
        btn.innerHTML = '🔇 Som Desligado';
        window.speechSynthesis.cancel(); // Para de falar imediatamente
    }
}

function speakStepTitle() {
    // Encontrar o título visível atual
    const activeStep = document.querySelector('.step-content.active h2');
    if (activeStep) {
        speakText(activeStep.innerText);
    }
}

function speakText(text) {
    if (!isSoundOn) return;

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Evita sobreposição
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    }
}

function playWelcomeMessage() {
    speakText("Bem vindo a Telemedicina. Escolha o motivo da sua consulta.");
}

// Iniciar com mensagem de boas vindas (se o navegador permitir autoplay)
// setTimeout(playWelcomeMessage, 1000);

// =========================================
// LÓGICA DE SALA DE VÍDEO (PACIENTE)
// =========================================

// --- VIDEO E CHAT (SIMULADO + API) ---
// --- SALA DE TELEMEDICINA (VIDEO / CHAT / DOCS) ---

let currentConsultaId = null;
let currentPacienteId = null;
let teleTimerInterval = null;
let jitsiApi = null;

async function abrirSalaTelemedicina(id) {
    currentConsultaId = id;
    showHealthLoader('Entrando na sala...');

    const sessao = await API.sessao();
    const localLogado = localStorage.getItem('usuarioLogado') === 'true';
    
    // Verificar se está logado
    if (!sessao || !sessao.logado || !localLogado) {
        hideHealthLoader();
        Swal.fire({ icon: 'warning', title: 'Acesso Negado', text: 'Você precisa estar logado para acessar a sala de telemedicina.' }).then(() => {
            window.location.href = 'telemedicina_login.html';
        });
        return;
    }
    
    const list = await API.teleConsultas();
    const consulta = list.find(c => c.id == id);

    if (!consulta) {
        hideHealthLoader();
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Consulta não encontrada.' });
        return;
    }

    // Identificar ID do paciente (se médico) ou do médico (se paciente)
    // Usar fallback para localStorage se API retornar null
    const tipoUsuario = (sessao && sessao.usuario) ? sessao.usuario.tipo : localStorage.getItem('tipoUsuario');
    const usuarioId = (sessao && sessao.usuario) ? sessao.usuario.id : localStorage.getItem('usuarioId');
    
    currentPacienteId = tipoUsuario === 'medico' ? consulta.paciente_id : usuarioId;

    const sala = document.getElementById('sala-telemedicina');
    sala.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // UI Ajustes (Médico vs Paciente)
    if (tipoUsuario === 'medico') {
        document.getElementById('btn-med-tools').style.display = 'flex';
        document.getElementById('btn-finalizar-tele').style.display = 'flex';
        API.teleStatus(id, 'em_atendimento');
    }

    // Inicializar Jitsi Meet
    const domain = 'meet.jit.si';
    const options = {
        roomName: `TCC_CEEP_CONSULTA_${id}`,
        width: '100%',
        height: '100%',
        parentNode: document.getElementById('video-container-remote'),
        userInfo: {
            displayName: (sessao && sessao.usuario) ? sessao.usuario.nome : localStorage.getItem('usuarioNome') || 'Usuário'
        },
        interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: ['microphone', 'camera', 'desktop', 'fullscreen', 'fittowindow', 'chat', 'settings', 'videoquality', 'filmstrip'],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
        },
        configOverwrite: {
            disableDeepLinking: true,
            prejoinPageEnabled: false
        }
    };

    // Limpar container antes de injetar Jitsi
    document.getElementById('video-container-remote').innerHTML = '';
    jitsiApi = new JitsiMeetExternalAPI(domain, options);

    // Esconder PiP local pois o Jitsi já mostra o self-view
    document.getElementById('video-container-local').style.display = 'none';

    startTeleTimer();
    hideHealthLoader();
}

function toggleMedTools() {
    const p = document.getElementById('tele-med-tools');
    const isOpen = p.style.left === '0px';
    p.style.left = isOpen ? '-400px' : '0px';
}

function switchToolTab(tab) {
    document.querySelectorAll('.tool-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('#tele-med-tools .tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`tool-${tab}`).style.display = 'block';
    document.getElementById(`tab-${tab}`).classList.add('active');
}

async function gerarAtestadoTele() {
    const dados = {
        tipo: 'atestado',
        consulta_id: currentConsultaId,
        paciente_id: currentPacienteId,
        dias: document.getElementById('doc-dias').value,
        cid_code: document.getElementById('doc-cid').value,
        texto: document.getElementById('doc-motivo').value
    };

    showHealthLoader('Emitindo Atestado com Assinatura Digital...');
    const resp = await API.teleGerarDoc(dados);
    hideHealthLoader();

    if (resp && resp.sucesso) {
        Swal.fire({
            icon: 'success',
            title: 'Documento Emitido',
            html: `Atestado emitido e assinado!<br>Token Digital: <b>${resp.token}</b><br>O paciente já pode baixar o documento.`
        });
        toggleMedTools();
    }
}

async function gerarPrescricaoTele() {
    const dados = {
        tipo: 'prescricao',
        consulta_id: currentConsultaId,
        paciente_id: currentPacienteId,
        medicamento: document.getElementById('doc-med').value,
        dosagem: document.getElementById('doc-dose').value,
        frequencia: document.getElementById('doc-freq').value,
        obs: 'Emitido via Telemedicina'
    };

    showHealthLoader('Emitindo Prescrição...');
    const resp = await API.teleGerarDoc(dados);
    hideHealthLoader();

    if (resp && resp.sucesso) {
        Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Prescrição emitida com sucesso!' });
        toggleMedTools();
    }
}

async function gerarDeclaracaoTele() {
    const dados = {
        tipo: 'declaracao',
        consulta_id: currentConsultaId,
        paciente_id: currentPacienteId
    };

    showHealthLoader('Emitindo Declaração de Comparecimento...');
    const resp = await API.teleGerarDoc(dados);
    hideHealthLoader();

    if (resp && resp.sucesso) {
        Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Declaração emitida com sucesso! O paciente já pode baixar o documento.' });
        toggleMedTools();
    }
}

async function finalizarConsultaTele() {
    if (confirm("Registrar finalização do atendimento?")) {
        showHealthLoader('Finalizando...');
        await API.teleStatus(currentConsultaId, 'finalizada');
        hideHealthLoader();
        sairDaChamada();
    }
}

function sairDaChamada() {
    document.getElementById('sala-telemedicina').style.display = 'none';
    document.body.style.overflow = 'auto';
    clearInterval(teleTimerInterval);
    
    // Encerrar Jitsi
    if (jitsiApi) {
        jitsiApi.dispose();
        jitsiApi = null;
    }

    initTelemedicina();
}

// --- AUXILIARY VIDEO & TIMER ---

function startFakeVideo() {
    const video = document.querySelector('.video-pip video');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                video.srcObject = stream;
                video.play();
            })
            .catch(err => console.log("Webcam não detectada/autorizada:", err));
    }
}

function stopFakeVideo() {
    const video = document.querySelector('.video-pip video');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
}

function startTeleTimer() {
    let seg = 0;
    const display = document.getElementById('tele-timer');
    teleTimerInterval = setInterval(() => {
        seg++;
        const h = Math.floor(seg / 3600);
        const m = Math.floor((seg % 3600) / 60);
        const s = seg % 60;
        display.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}

function toggleMute(btn) {
    btn.classList.toggle('active');
    btn.innerHTML = btn.classList.contains('active') ? '🔇' : '<i class=\"fi fi-rr-microphone\"></i> ';
}

function toggleCam(btn) {
    btn.classList.toggle('active');
    btn.innerHTML = btn.classList.contains('active') ? '<i class=\"fi fi-rr-camera\"></i> ' : '<i class=\"fi fi-rr-camera\"></i> '; // Simulado
}

function toggleChat() {
    document.getElementById('tele-chat').classList.toggle('open');
}
async function syncChat(usuario) {
    if (typeof API === 'undefined' || !currentConsultaId) return;
    const chatData = await API.listarMsgs(currentConsultaId);
    if (!chatData || chatData.erro) return;

    const chatArea = document.querySelector('.chat-area');
    if (!chatArea) return;

    const currentCount = chatArea.querySelectorAll('.chat-msg').length;
    if (chatData.length > currentCount) {
        chatArea.innerHTML = '';
        chatData.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'chat-msg';
            const isMe = msg.tipo === 'paciente'; // remetente no backend é o nome, tipo ajuda
            div.style = `padding:8px; margin:5px; border-radius:5px; max-width:80%; word-wrap:break-word; ${isMe ? 'background:#dcf8c6; margin-left:auto;' : 'background:#fff; border:1px solid #ddd;'}`;

            // Check if it's a file attachment
            if (msg.mensagem.startsWith('[ANEXO]')) {
                const parts = msg.mensagem.split('|');
                const fileUrl = parts[1];
                const fileName = parts[2] || 'Arquivo Anexado';
                const isImage = fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) != null || fileUrl.startsWith('data:image');

                if (isImage) {
                    div.innerHTML = `<strong>${isMe ? 'Eu' : msg.remetente}:</strong><br>
                                     <a href="${fileUrl}" target="_blank">
                                        <img src="${fileUrl}" style="max-width:100%; border-radius:4px; margin-top:5px; border:1px solid #ccc;">
                                     </a>`;
                } else {
                    div.innerHTML = `<strong>${isMe ? 'Eu' : msg.remetente}:</strong><br>
                                     <a href="${fileUrl}" target="_blank" style="display:inline-block; margin-top:5px; color:#004b82; text-decoration:none; background:#e3f2fd; padding:5px 10px; border-radius:4px; border:1px solid #b6d4fe;">
                                        <i class='fi fi-rr-clip'></i>  ${fileName}
                                     </a>`;
                }
            } else {
                div.innerHTML = `<strong>${isMe ? 'Eu' : msg.remetente}:</strong> ${msg.mensagem}`;
            }

            chatArea.appendChild(div);
        });
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

async function enviarMensagemChat(usuario) {
    const input = document.querySelector('.chat-input-area input[type="text"]');
    if (!input || !input.value.trim() || !currentConsultaId) return;

    if (typeof API !== 'undefined') {
        const resp = await API.enviarMsg(currentConsultaId, input.value.trim());
        if (resp && resp.sucesso) {
            input.value = '';
            syncChat(usuario);
        }
    }
}

async function enviarArquivoChat(usuario) {
    const fileInput = document.getElementById('chat-file-input-paciente');
    const file = fileInput.files[0];
    if (!file || !currentConsultaId) return;

    if (typeof API === 'undefined') return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        let fileData = e.target.result;

        if (file.size > 2 * 1024 * 1024) {
            fileData = 'blob:mocked-url-for-large-file';
        }

        const msgTexto = `[ANEXO]|${fileData}|${file.name}`;

        const resp = await API.enviarMsg(currentConsultaId, msgTexto);
        if (resp && resp.sucesso) {
            fileInput.value = '';
            syncChat(usuario);
        }
    };

    reader.readAsDataURL(file);
}

// Inicializar listener de enter no chat
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.querySelector('.chat-input-area input[type="text"]');
    const chatBtn = document.querySelector('.chat-input-area button:last-of-type');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') enviarMensagemChat('paciente');
        });
    }
    if (chatBtn) chatBtn.onclick = () => enviarMensagemChat('paciente');
});

function toggleChat() {
    const chat = document.getElementById('tele-chat');
    // Alternar visibilidade (simples toggling de display ou classe)
    if (chat.style.display === 'none' || !chat.style.display) {
        chat.style.display = 'flex';
    } else {
        chat.style.display = 'none';
    }
}

// Reuso das funções de toggleMute e toggleCam se já existirem ou criar novas
// Como as do medico.js são globais lá, aqui precisamos garantir que existam para o paciente

// Sobrescrevendo ou garantindo funções de controle para o contexto do paciente
window.toggleMute = function (btn) {
    if (!patientStream) return;
    const audioTrack = patientStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    btn.classList.toggle('active');
    btn.innerHTML = audioTrack.enabled ? '<i class=\"fi fi-rr-microphone\"></i> ' : '🔇';
}

window.toggleCam = function (btn) {
    if (!patientStream) return;
    const videoTrack = patientStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    btn.classList.toggle('active');
    btn.innerHTML = videoTrack.enabled ? '<i class=\"fi fi-rr-camera\"></i> ' : '🚫';
}

window.toggleVideoLayout = function () {
    const mainContainer = document.getElementById('video-container-remote');
    const pipContainer = document.getElementById('video-container-local');

    if (!mainContainer || !pipContainer) return;

    // Salvar referências dos elementos
    const mainChildren = Array.from(mainContainer.children);
    const pipChildren = Array.from(pipContainer.children);

    // Encontrar o botão de swap, remover temporariamente para não perder contexto
    const swapBtn = pipContainer.querySelector('.btn-swap');
    if (swapBtn) swapBtn.remove();

    // Limpar containers (seguro pois temos as referências na memória)
    mainContainer.innerHTML = '';
    pipContainer.innerHTML = '';

    // Inverter anexação
    // O que estava no PIP (menos o botão que removemos) vai para o Main
    pipChildren.forEach(child => {
        if (!child.classList.contains('btn-swap')) {
            mainContainer.appendChild(child);
        }
    });

    // O que estava no Main vai para o PIP
    mainChildren.forEach(child => {
        pipContainer.appendChild(child);
    });

    // Devolver o botão para o PIP em sua nova configuração
    if (swapBtn) pipContainer.appendChild(swapBtn);
}

// ── ENCERRAR CHAMADA PELO PACIENTE ────────────────────────────
window.sairDaChamada = function () {
    if (!confirm("Deseja realmente sair da chamada?")) return;

    // Parar câmera e microfone
    if (patientStream) {
        patientStream.getTracks().forEach(track => track.stop());
        patientStream = null;
    }

    clearInterval(patientInterval);
    localStorage.setItem('tele_paciente_online', 'false');

    // Fechar a tela de sala e redirecionar
    document.getElementById('sala-telemedicina').style.display = 'none';
    alert("Você saiu da consulta de telemedicina.");
    window.location.href = 'perfil.html';
}

// ── UTILS PARA CALENDÁRIO E NOTIFICAÇÃO ───────────────────────
function gerarLinkGoogleCalendar(titulo, dataStr, horaStr, tipo, local) {
    const d = dataStr.replace(/-/g, '');
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

function baixarICS(titulo, dataStr, horaStr, tipo, local) {
    const d = dataStr.replace(/-/g, '');
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
    link.setAttribute('download', 'consulta_agendada.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function notificarWhatsApp(nomeMedico, especialidade, dataStr, horaStr, tipo) {
    const tel = localStorage.getItem('usuarioTelefone') || '';
    const cleanTel = tel.replace(/\D/g, '');
    const dataFmt = dataStr.split('-').reverse().join('/');
    
    const msg = `Olá! Sua consulta no Portal Saúde Fácil está confirmada!
🏥 Especialidade: ${especialidade}
👨‍⚕️ Profissional: ${nomeMedico}
📅 Data: ${dataFmt}
⏰ Horário: ${horaStr}
📍 Modalidade: ${tipo === 'telemedicina' ? 'Remota (Telemedicina)' : 'Presencial'}
Obrigado por utilizar o Portal Saúde Digital!`;

    const encoded = encodeURIComponent(msg);
    const url = cleanTel ? `https://wa.me/55${cleanTel}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
}
