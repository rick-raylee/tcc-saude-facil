async function initPerfil() {
    console.log("Perfil: Inicializando painel...");
    // ── TENTAR BACKEND API PRIMEIRO ──────────────────────────────
    if (typeof API !== 'undefined') {
        const p = await API.sessao();
        if (p && p.logado) {
            // Se autenticado, carregar tudo via API
            await carregarDadosPerfilAPI();
            return;
        }
    }

    // ── FALLBACK: LÓGICA LOCALSTORAGE (RICARDO MARCHI) ───────────
    carregarDadosPerfil();
    carregarVacinas();
    carregarObservacoesPaciente();
    carregarExamesUsuario();
    renderizarCondicoesHeader();
    carregarProximaTeleconsulta();
}

// Inicialização robusta
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPerfil);
} else {
    initPerfil();
}

// ── VERSÃO API (MySQL) ──────────────────────────────────────────
async function carregarDadosPerfilAPI() {
    const perfil = await API.perfil();
    if (!perfil || perfil.erro) return;

    // 1. Preencher Header
    setTextIfElement('user-name-display', perfil.nome);
    const idade = perfil.data_nascimento ? calcularIdade(perfil.data_nascimento) : '--';
    setTextIfElement('user-age-display', `${idade} anos`);
    setTextIfElement('user-sus-display', `CNS: ${perfil.sus || 'Não informado'}`);

    const avatarEl = document.getElementById('user-avatar-display');
    if (avatarEl && perfil.imagem) {
        // Se a imagem for um caminho local (começa com uploads/), ajusta a URL
        if (perfil.imagem.startsWith('uploads/')) {
            avatarEl.src = 'backend/' + perfil.imagem;
        } else {
            avatarEl.src = perfil.imagem;
        }
    }

    // Update booklet names
    setTextIfElement('booklet-name', perfil.nome.toUpperCase());
    setTextIfElement('booklet-sus', perfil.sus);
    setTextIfElement('booklet-name-small', perfil.nome.toUpperCase());
    setTextIfElement('booklet-sus-small', perfil.sus);

    // 2. Condições / Doenças
    const doencas = await API.listarDoencas();
    const tagsContainer = document.getElementById('health-tags-display');
    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        if (doencas && doencas.length > 0) {
            doencas.forEach(d => {
                const tag = document.createElement('span');
                tag.className = 'health-tag warning';
                tag.textContent = `⚠️ ${d.nome}`;
                tagsContainer.appendChild(tag);
            });
        } else {
            tagsContainer.innerHTML = '<span class="health-tag success"><i class="fi fi-rr-check-circle"></i>  Nenhuma condição crônica registrada</span>';
        }
    }

    // 3. Vacinas
    const listRealizadas = document.getElementById('booklet-list-realizadas');
    const listPendentes = document.getElementById('booklet-list-pendentes');
    if (!listRealizadas || !listPendentes) return;

    listRealizadas.innerHTML = '';
    listPendentes.innerHTML = '';

    // Buscar CPF para filtrar LocalStorage
    const meuCpf = perfil.cpf || localStorage.getItem('usuarioCpf') || '';
    const cpfLimpo = meuCpf.replace(/\D/g, '');

    // Carregar Online
    let minhasVacinas = await API.minhasVacinas() || [];
    
    // Carregar Offline (Locais pendentes)
    const dbV = JSON.parse(localStorage.getItem('db_vacinas_paciente') || '[]');
    const vacinasLocais = dbV.filter(v => (v.paciente_cpf && v.paciente_cpf.replace(/\D/g, '') === cpfLimpo) || (v.pacienteCpf && v.pacienteCpf.replace(/\D/g, '') === cpfLimpo));

    // Deduplicar para não mostrar a mesma vacina duas vezes se ela já subiu
    const nomesJaNaAPI = new Set(minhasVacinas.map(v => `${v.vacina || v.vacina_nome}-${v.dose}`));
    const pendentesSync = vacinasLocais.filter(v => !nomesJaNaAPI.has(`${v.vacina_nome || v.vacina}-${v.dose}`));

    // Mesclar as listas
    const todasRealizadas = [
        ...minhasVacinas.map(v => ({...v, status: 'oficial'})),
        ...pendentesSync.map(v => ({
            vacina: v.vacina_nome || v.vacina,
            data: v.data,
            local: v.local_aplicacao || v.local,
            dose: v.dose,
            lote: v.lote,
            status: 'local'
        }))
    ];

    const idsTomadosRaw = todasRealizadas.map(v => v.vacina);
    const idsTomados = new Set(idsTomadosRaw);

    // -- Renderizar Realizadas --
    todasRealizadas.forEach(v => {
        const row = document.createElement('div');
        row.className = 'booklet-row taken';
        if (v.status === 'local') row.style.borderLeft = '4px solid #f39c12';
        
        row.innerHTML = `
            <div class="row-date">${v.data || '--/--/----'}</div>
            <div class="row-info">
                <strong>${v.vacina} ${v.status === 'local' ? '<small style="color:#e67e22;">(Sincronização pendente)</small>' : ''}</strong>
                <small>${v.local || 'Não informado'} • ${v.dose} • Lote: ${v.lote || 'N/A'}</small>
            </div>
            <div class="row-stamp"><i class='fi fi-rr-${v.status === 'local' ? 'time-past' : 'syringe'}'></i> </div>
        `;
        listRealizadas.appendChild(row);
    });

    // -- Renderizar Pendentes (SUS) --
    vacinasSUS.forEach(v => {
        if (!idsTomados.has(v.nome) && !idsTomados.has(v.id)) {
            const row = document.createElement('div');
            row.className = 'booklet-row pending';
            row.innerHTML = `
                <div class="row-date">--/--</div>
                <div class="row-info">
                    <strong>${v.nome}</strong>
                    <small>Disponível na UBS • ${v.dose}</small>
                </div>
                <div class="row-stamp">🕒</div>
            `;
            listPendentes.appendChild(row);
        }
    });

    // 4. Histórico / Prontuário
    const historico = await API.historico();
    const historyList = document.getElementById('history-list');
    if (historyList && historico) {
        historyList.innerHTML = '';
        if (historico.length === 0) {
            historyList.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">Nenhum atendimento registrado.</div>';
        } else {
            historico.forEach(atd => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.style.marginBottom = '15px'; item.style.padding = '15px';
                item.style.background = 'white'; item.style.borderRadius = '8px';
                item.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)'; item.style.borderLeft = '4px solid #004b82';
                item.innerHTML = `
                    <h4 style="margin:0 0 5px 0; color:#004b82;">${atd.diagnostico || 'Consulta Realizada'}</h4>
                    <div style="font-size:0.9rem; color:#444; margin-bottom:5px;">
                        <strong>Médico:</strong> ${atd.medico || 'N/A'} • <strong>Data:</strong> ${atd.data}
                    </div>
                    <div style="font-size:0.85rem; color:#666; margin-bottom: 5px;">
                        Status: <strong>${atd.status}</strong><br>
                        Queixa: ${atd.queixa || '--'}
                    </div>
                    ${(atd.tipo && atd.tipo.toLowerCase() === 'telemedicina') ? `<button onclick="abrirChatHistorico(${atd.id}, '${atd.medico || ''}')" style="margin-top: 5px; padding: 5px 10px; font-size: 0.8rem; border: none; border-radius: 4px; background: #e3f2fd; color: #004b82; cursor: pointer; font-weight: bold;"><i class='fi fi-rr-messages'></i>  Ver Chat da Telemedicina</button>` : ''}
                `;
                historyList.appendChild(item);
            });
        }
    }

    // 5. Minhas Consultas Agendadas
    const consultas = await API.minhasConsultas();
    if (consultas) {
        renderizarMinhasConsultas(consultas);
    }

    // 6. Histórico de Medicações / Prescrições
    await carregarMedicacoesPacienteAPI();

    // 7. Resumo de Saúde (Última Triagem)
    await carregarResumoSaudeAPI();
}

// ── ANTIGA LÓGICA (MANTIDA COMO FALLBACK) ───────────────────────

function renderizarMinhasConsultas(consultas) {
    const pendentes = consultas.filter(c => {
        const s = (c.status || '').toLowerCase();
        return s === 'agendado' || s === 'confirmado' || s === 'confirmada' || s === 'em_atendimento' || s === 'aguardando';
    });
    const card = document.getElementById('card-minhas-consultas');
    const container = document.getElementById('lista-minhas-consultas');

    if (!card || !container) return;

    if (pendentes.length > 0) {
        card.style.display = 'block';
        container.innerHTML = '';

        pendentes.forEach(c => {
            let actionHtml = '';

            if (c.tipo && c.tipo.toLowerCase() === 'telemedicina') {
                const isLogged = localStorage.getItem('usuarioLogado') === 'true';
                let isTime = false;
                if (c.data && c.hora) {
                    const appointmentTime = new Date(`${c.data}T${c.hora}:00`);
                    const now = new Date();
                    const diffMin = (appointmentTime - now) / (1000 * 60);

                    if (diffMin <= 30 && diffMin >= -60) {
                        isTime = true;
                    }

                    if (!isLogged) {
                        actionHtml = `<button onclick="window.location.href='index.html'" style="width:100%; padding:10px; margin-top:10px; background:#e0e0e0; color:#333; border:none; border-radius:6px; cursor:pointer;">Faça LOGIN para entrar</button>`;
                    } else if (isTime) {
                        actionHtml = `<button onclick="window.location.href='telemedicina.html?sala=ativa&id=${c.id}'" style="width:100%; padding:10px; margin-top:10px; background:#6c5ce7; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">📹 Entrar na Videochamada</button>`;
                    } else {
                        const diaFmt = appointmentTime.toLocaleDateString('pt-BR');
                        actionHtml = `<button disabled style="width:100%; padding:10px; margin-top:10px; background:#ccc; color:#666; border:none; border-radius:6px; cursor:not-allowed;">Aguarde ${diaFmt} às ${c.hora}</button>`;
                    }
                }
            } else {
                // Atendimento Presencial
                let isToday = false;
                if (c.data) {
                    const today = new Date();
                    const dd = String(today.getDate()).padStart(2, '0');
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const yyyy = today.getFullYear();
                    const todayISO = `${yyyy}-${mm}-${dd}`;
                    const todayBR = `${dd}/${mm}/${yyyy}`;
                    
                    if (c.data === todayISO || c.data === todayBR) {
                        isToday = true;
                    }
                }
                
                const cStatus = (c.status || '').toLowerCase();
                
                if (isToday && (cStatus === 'confirmada' || cStatus === 'confirmado' || cStatus === 'agendada' || cStatus === 'agendado')) {
                    actionHtml = `
                        <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                            <div style="padding:10px; background:#e3f2fd; color:#004b82; border-radius:6px; text-align:center; font-size:0.9rem;"><i class="fi fi-rr-hospital"></i>📍 Atendimento Presencial</div>
                            <button id="btn-checkin-${c.id}" onclick="realizarAutoCheckin(${c.id})" style="width:100%; padding:12px; background:#28a745; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.95rem; box-shadow: 0 4px 10px rgba(40, 167, 69, 0.2); transition: all 0.3s; display:flex; align-items:center; justify-content:center; gap:8px;">
                                🎫 Ativar Fila (Auto Check-in)
                            </button>
                        </div>
                    `;
                } else if (cStatus === 'aguardando') {
                    const senhaFila = c.senha_fila || '---';
                    actionHtml = `
                        <div style="margin-top:10px; padding:12px; background:#e8f5e9; border: 1px solid #c8e6c9; border-radius:8px; text-align:center;">
                            <div style="font-size:0.85rem; color:#2e7d32; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:5px;"><i class="fi fi-rr-check"></i>📍 PRESENÇA CONFIRMADA</div>
                            <div style="font-size:1.8rem; font-weight:900; color:#2e7d32; margin: 5px 0; letter-spacing:1px;">${senhaFila}</div>
                            <div style="font-size:0.8rem; color:#555;">Sua senha na fila do médico. Aguarde ser chamado no painel!</div>
                        </div>
                    `;
                } else {
                    actionHtml = `<div style="margin-top:10px; padding:10px; background:#e3f2fd; color:#004b82; border-radius:6px; text-align:center; font-size:0.9rem;">📍 Atendimento Presencial</div>`;
                }
            }

            // Normalizando formato de data caso venha algo como yyyy-mm-dd
            let diaFmt = c.data;
            if (diaFmt.includes('-')) {
                diaFmt = diaFmt.split('-').reverse().join('/');
            }

            const item = document.createElement('div');
            item.style.cssText = 'padding: 15px; background: white; border-radius: 8px; border: 1px solid #e9ecef; box-shadow: 0 2px 4px rgba(0,0,0,0.02);';
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color:#004b82; font-size:1.1rem;"><i class='fi fi-rr-stethoscope'></i>  ${c.medico || c.medicoNome || 'Dr.'}</strong>
                    <span class="badge-status em-atendimento" style="font-size:0.7rem; padding:4px 8px;">${c.status}</span>
                </div>
                <div style="font-size:0.9rem; color:#666; margin-bottom: 8px;"><i class='fi fi-rr-clipboard-list'></i>  ${c.especialidade || 'Consulta Médica'} • ${c.tipo}</div>
                <div style="display: flex; gap: 20px; margin-bottom: 10px; font-size: 0.95rem; background:#f4f7f6; padding:8px; border-radius:6px;">
                    <div><i class='fi fi-rr-calendar'></i>  <strong>${diaFmt}</strong></div>
                    <div>⏰ <strong>${c.hora || ''}</strong></div>
                </div>
                ${actionHtml}
            `;
            container.appendChild(item);
        });
    } else {
        card.style.display = 'none';
        container.innerHTML = '';
    }
}

function carregarProximaTeleconsulta() {
    const todosAgendamentos = JSON.parse(localStorage.getItem('agendamentos') || '[]');
    const meuCpf = localStorage.getItem('usuarioCpf') || JSON.parse(localStorage.getItem('usuarioRegistrado') || '{}').cpf;

    const minhasConsultasFallback = todosAgendamentos.filter(a => {
        const cpf = a.pacienteCpf || (a.paciente && a.paciente.cpf);
        return (cpf === meuCpf || cpf === '000.000.000-00');
    });

    renderizarMinhasConsultas(minhasConsultasFallback);
}

// Funçoes de Câmera do Perfil removidas pois foram tiradas da UI e tele consulta tem sua propria
function testarCameraPerfil() {
    console.log("Teste de camera foi movido direto para a sala de espera/telemedicina.");
}
function pararCameraPerfil() {
    console.log("Camera de perfil não é mais renderizada localmente fora da sala de telemedicina.");
}

let perfilStream = null;

function testarCameraPerfil() {
    const videoEl = document.getElementById('perfil-local-video');
    const placeholder = document.getElementById('perfil-cam-placeholder');
    if (!videoEl) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
            perfilStream = stream;
            videoEl.srcObject = stream;
            videoEl.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        })
        .catch(err => {
            console.error('Erro ao acessar câmera no perfil:', err);
            if (placeholder) {
                placeholder.innerHTML = `<div style="font-size: 2rem; margin-bottom: 8px;">🚫</div><p style="font-size: 0.8rem; color: #f44336;">Câmera bloqueada</p>`;
            }
        });
}

function pararCameraPerfil() {
    if (perfilStream) { perfilStream.getTracks().forEach(t => t.stop()); perfilStream = null; }
    const videoEl = document.getElementById('perfil-local-video');
    const placeholder = document.getElementById('perfil-cam-placeholder');
    if (videoEl) { videoEl.srcObject = null; videoEl.style.display = 'none'; }
    if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = `<div style="font-size: 3rem; margin-bottom: 8px;"><i class='fi fi-rr-camera'></i> </div><p style="font-size: 0.85rem;">Clique em "Testar Câmera" para verificar</p>`;
    }
}

// --- DADOS DAS VACINAS (CALENDÁRIO NACIONAL SUS) ---
const vacinasSUS = [
    { id: 'bcg', nome: 'BCG (Bacilo Calmette-Guérin)', dose: 'Dose Única', prevencao: 'Formas graves de Tuberculose' },
    { id: 'hepb_nasc', nome: 'Hepatite B', dose: 'Ao nascer', prevencao: 'Hepatite B' },
    { id: 'penta_1', nome: 'Pentavalente (DTP+Hib+HepB)', dose: '1ª Dose', prevencao: 'Difteria, Tétano, Coqueluche, Meningite, Hepatite B' },
    { id: 'vip_1', nome: 'VIP (Poliomielite Inativada)', dose: '1ª Dose', prevencao: 'Paralisia Infantil' },
    { id: 'pneumo_1', nome: 'Pneumocócica 10 Valente', dose: '1ª Dose', prevencao: 'Pneumonia, Otite, Meningite' },
    { id: 'rota_1', nome: 'Rotavírus Humano', dose: '1ª Dose', prevencao: 'Diarreia por Rotavírus' },
    { id: 'meningo_c_1', nome: 'Meningocócica C', dose: '1ª Dose', prevencao: 'Meningite C' },
    { id: 'penta_2', nome: 'Pentavalente', dose: '2ª Dose', prevencao: 'Reforço' },
    { id: 'vip_2', nome: 'VIP (Poliomielite)', dose: '2ª Dose', prevencao: 'Reforço' },
    { id: 'pneumo_2', nome: 'Pneumocócica 10V', dose: '2ª Dose', prevencao: 'Reforço' },
    { id: 'rota_2', nome: 'Rotavírus Humano', dose: '2ª Dose', prevencao: 'Reforço' },
    { id: 'meningo_c_2', nome: 'Meningocócica C', dose: '2ª Dose', prevencao: 'Reforço' },
    { id: 'penta_3', nome: 'Pentavalente', dose: '3ª Dose', prevencao: 'Reforço' },
    { id: 'vip_3', nome: 'VIP (Poliomielite)', dose: '3ª Dose', prevencao: 'Reforço' },
    { id: 'febre_amarela', nome: 'Febre Amarela', dose: 'Dose Inicial', prevencao: 'Febre Amarela' },
    { id: 'triplice_viral_1', nome: 'Tríplice Viral', dose: '1ª Dose', prevencao: 'Sarampo, Caxumba, Rubéola' },
    { id: 'pneumo_ref', nome: 'Pneumocócica 10V', dose: 'Reforço', prevencao: 'Reforço' },
    { id: 'meningo_c_ref', nome: 'Meningocócica C', dose: 'Reforço', prevencao: 'Reforço' },
    { id: 'dtp_ref_1', nome: 'DTP (Tríplice Bacteriana)', dose: '1º Reforço', prevencao: 'Difteria, Tétano, Coqueluche' },
    { id: 'tetraviral', nome: 'Tetraviral', dose: 'Dose Única', prevencao: 'Sarampo, Caxumba, Rubéola, Varicela' },
    { id: 'hep_a', nome: 'Hepatite A', dose: 'Dose Única', prevencao: 'Hepatite A' },
    { id: 'vop_ref_1', nome: 'VOP (Poliomielite Oral)', dose: '1º Reforço', prevencao: 'Paralisia Infantil' },
    { id: 'dtp_ref_2', nome: 'DTP (Tríplice Bacteriana)', dose: '2º Reforço', prevencao: 'Reforço' },
    { id: 'vop_ref_2', nome: 'VOP (Poliomielite Oral)', dose: '2º Reforço', prevencao: 'Reforço' },
    { id: 'varicela', nome: 'Varicela', dose: '2ª Dose', prevencao: 'Catapora' },
    { id: 'hpv', nome: 'HPV Quadrivalente', dose: '2 Doses', prevencao: 'Câncer de Colo de Útero, Pênis, Ânus' },
    { id: 'meningo_acwy', nome: 'Meningocócica ACWY', dose: 'Dose Única', prevencao: 'Meningite A, C, W, Y' },
    { id: 'dt_adulto', nome: 'Dupla Adulto (dT)', dose: 'Reforço a cada 10 anos', prevencao: 'Difteria e Tétano' },
    { id: 'febre_amarela_ref', nome: 'Febre Amarela', dose: 'Reforço', prevencao: 'Se necessário' },
    { id: 'hepatite_b_adulto', nome: 'Hepatite B', dose: '3 Doses', prevencao: 'Se não vacinado anteriormente' },
    { id: 'influenza', nome: 'Influenza (Gripe)', dose: 'Anual', prevencao: 'Gripe (Campanha)' },
    { id: 'covid', nome: 'Covid-19', dose: 'Periódica', prevencao: 'Coronavírus (Campanha)' },
    { id: 'pneumo_23', nome: 'Pneumocócica 23V', dose: 'Campanha', prevencao: 'Pneumonia (Idosos/Indígenas)' }
];

const vacinasTomadasSimuladas = [
    { id: 'bcg', data: '12/05/1996', local: 'Maternidade' },
    { id: 'hepb_nasc', data: '12/05/1996', local: 'Maternidade' },
    { id: 'penta_1', data: '15/07/1996', local: 'UBS Centro' },
    { id: 'vip_1', data: '15/07/1996', local: 'UBS Centro' },
    { id: 'pneumo_1', data: '15/07/1996', local: 'UBS Centro' },
    { id: 'rota_1', data: '15/07/1996', local: 'UBS Centro' },
    { id: 'febre_amarela', data: '10/02/1997', local: 'UBS Periolo' },
    { id: 'triplice_viral_1', data: '12/05/1997', local: 'UBS Centro' },
    { id: 'dt_adulto', data: '20/05/2016', local: 'UBS Coqueiral' },
    { id: 'influenza', data: '15/04/2025', local: 'Campanha 2025' },
    { id: 'covid', data: '20/01/2025', local: 'Campanha Bivalente' }
];

function carregarDadosPerfil() {
    const nome = localStorage.getItem('usuarioNome') || 'RICARDO MARCHI';
    const idade = localStorage.getItem('usuarioIdade') || '28';
    const doencas = JSON.parse(localStorage.getItem('usuarioDoencas') || '["Diabético", "Hipertenso"]');
    const sus = localStorage.getItem('usuarioSUS') || '7000.0456.1234.9988';

    setTextIfElement('user-name-display', nome);
    setTextIfElement('user-age-display', `${idade} anos`);
    setTextIfElement('user-sus-display', `CNS: ${sus}`);

    const avatarEl = document.getElementById('user-avatar-display');
    const imagem = localStorage.getItem('usuarioImagem');
    if (avatarEl && imagem) {
        if (imagem.startsWith('uploads/')) {
            avatarEl.src = 'backend/' + imagem;
        } else {
            avatarEl.src = imagem;
        }
    }

    const tagsContainer = document.getElementById('health-tags-display');
    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        if (doencas.length > 0) {
            doencas.forEach(d => {
                const tag = document.createElement('span'); tag.className = 'health-tag warning';
                tag.textContent = `⚠️ ${d}`; tagsContainer.appendChild(tag);
            });
        }
    }

    setTextIfElement('booklet-name', nome.toUpperCase());
    setTextIfElement('booklet-sus', sus);
    setTextIfElement('booklet-name-small', nome.toUpperCase());
    setTextIfElement('booklet-sus-small', sus);

    carregarHistorico();
}

function carregarVacinas() {
    const listRealizadas = document.getElementById('booklet-list-realizadas');
    const listPendentes = document.getElementById('booklet-list-pendentes');
    if (!listRealizadas || !listPendentes) return;

    listRealizadas.innerHTML = ''; listPendentes.innerHTML = '';

    // 1. Obter CPF logado
    const meuCpf = localStorage.getItem('usuarioCpf') || JSON.parse(localStorage.getItem('usuarioRegistrado') || '{}').cpf || '';
    const cpfLimpo = meuCpf.replace(/\D/g, '');

    // 2. Tentar carregar do LocalStorage (dados reais salvos pelo enfermeiro)
    const dbV = JSON.parse(localStorage.getItem('db_vacinas_paciente') || '[]');
    const vacinasLocais = dbV.filter(v => (v.paciente_cpf && v.paciente_cpf.replace(/\D/g, '') === cpfLimpo) || (v.pacienteCpf && v.pacienteCpf.replace(/\D/g, '') === cpfLimpo));

    // 3. Mesclar com as simuladas APENAS se estiver vazio (ou sempre mesclar para demonstração)
    let todasMinhas = vacinasLocais.map(v => ({
        id: v.vacinaId || 'local',
        nome: v.vacina_nome || v.vacina,
        data: v.data,
        local: v.local_aplicacao || v.local,
        dose: v.dose,
        status: 'local'
    }));

    // Se estiver vazio, podemos usar as simuladas para o TCC não parecer vazio
    if (todasMinhas.length === 0) {
        vacinasTomadasSimuladas.forEach(s => {
            const vSUS = vacinasSUS.find(v => v.id === s.id) || { nome: 'Vacina', dose: 'Dose' };
            todasMinhas.push({
                id: s.id,
                nome: vSUS.nome,
                data: s.data,
                local: s.local,
                dose: vSUS.dose,
                status: 'simulada'
            });
        });
    }

    const idsTomados = new Set(todasMinhas.map(v => v.id).filter(id => id !== 'local'));
    const nomesTomados = new Set(todasMinhas.map(v => v.nome));

    todasMinhas.forEach(v => {
        const row = document.createElement('div'); row.className = 'booklet-row taken';
        if (v.status === 'local') row.style.borderLeft = '4px solid #f39c12';
        
        row.innerHTML = `
            <div class="row-date">${v.data}</div>
            <div class="row-info">
                <strong>${v.nome}</strong>
                <small>${v.local} • ${v.dose}</small>
            </div>
            <div class="row-stamp"><i class='fi fi-rr-${v.status === 'local' ? 'time-past' : 'check-circle'}'></i> </div>
        `;
        listRealizadas.appendChild(row);
    });

    vacinasSUS.forEach(vacina => {
        if (!idsTomados.has(vacina.id) && !nomesTomados.has(vacina.nome)) {
            const row = document.createElement('div'); row.className = 'booklet-row pending';
            row.innerHTML = `<div class="row-date">--/--</div><div class="row-info"><strong>${vacina.nome}</strong><small>UBS • ${vacina.dose}</small></div><div class="row-stamp">🕒</div>`;
            listPendentes.appendChild(row);
        }
    });
}

function carregarHistorico() {
    const list = document.getElementById('history-list');
    if (!list) return;
    const historico = [
        { data: '10/02/2026', tipo: 'Telemedicina', medico: 'Dr. Silva', motivo: 'Renovação de Receita', status: 'Concluído' },
        { data: '15/01/2026', tipo: 'Consulta Presencial', medico: 'Dra. Ana', motivo: 'Dor lombar', status: 'Concluído' }
    ];
    list.innerHTML = '';
    historico.forEach(item => {
        const h = `<div class="timeline-item"><div class="timeline-date">${item.data}</div><div class="timeline-content"><h4>${item.tipo}</h4><p><strong>Médico:</strong> ${item.medico}</p><span class="status-badge success">${item.status}</span></div></div>`;
        list.insertAdjacentHTML('beforeend', h);
    });
}

function carregarObservacoesPaciente() { }
function carregarExamesUsuario() {
    const listaExames = document.getElementById('lista-exames-paciente');
    if (!listaExames) return;

    // Obter CPF logado
    const meuCpf = localStorage.getItem('usuarioCpf') || JSON.parse(localStorage.getItem('usuarioRegistrado') || '{}').cpf || '';
    const docsStr = localStorage.getItem('documentos_paciente');

    if (!docsStr || !meuCpf) return;

    const docsDict = JSON.parse(docsStr);
    const meusDocs = docsDict[meuCpf] || [];

    if (meusDocs.length === 0) return;

    listaExames.innerHTML = '';

    // Invertendo para mostrar o mais recente no topo
    [...meusDocs].reverse().forEach(doc => {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 15px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; background: #fafafa;';

        const icone = doc.tipo.toLowerCase().includes('receita') ? '<i class=\"fi fi-rr-medicine\"></i> ' : '<i class=\"fi fi-rr-document\"></i> ';

        li.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="font-size: 2rem;">${icone}</div>
                <div>
                    <h4 style="margin: 0 0 5px 0; color: #333;">${doc.tipo}</h4>
                    <small style="color: #777;">Emitido em: ${doc.data}</small><br>
                    <small style="color: #555;">Médico: ${doc.medico}</small>
                </div>
            </div>
            <button onclick="visualizarDocumento('${encodeURIComponent(doc.html)}')" style="background: #1565c0; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-weight: bold;">Ver/Imprimir</button>
        `;
        listaExames.appendChild(li);
    });
}

window.visualizarDocumento = function (encodedHtml) {
    const html = decodeURIComponent(encodedHtml);
    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Documento SUS</title>
            <style>
                body { font-family: 'Times New Roman', serif; margin: 0; padding: 40px; color: #000; }
                .doc-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
                .doc-header h2 { margin: 0 0 5px 0; font-size: 1.5rem; text-transform: uppercase; }
                .doc-header p { margin: 0; font-size: 0.9rem; color: #333; }
                .doc-body { font-size: 1.15rem; line-height: 1.8; text-align: justify; min-height: 300px; }
                .doc-footer { margin-top: 80px; display: flex; flex-direction: column; align-items: center; }
                .doc-assinatura { width: 300px; border-top: 1px solid #000; text-align: center; padding-top: 10px; }
                @media print { body { padding: 0; } .no-print { display: none; } }
            </style>
        </head>
        <body>
            <button onclick="window.print()" class="no-print" style="margin-bottom: 20px; padding: 10px 20px; background: #e74c3c; color: white; border: none; cursor: pointer; border-radius: 4px; font-weight: bold;">🖨️ Imprimir PDF Oficial</button>
            <div style="max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 40px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" class="doc-container">
                ${html}
            </div>
        </body>
        </html>
    `);
    win.document.close();
}

// ── HISTÓRICO DE CHAT DA TELEMEDICINA ───────────────────────────
async function abrirChatHistorico(consultaId, medicoNome) {
    const modal = document.getElementById('modalChatHistorico');
    const containerMsgs = document.getElementById('chat-historico-msgs');
    if (!modal || !containerMsgs) return;

    document.getElementById('chat-historico-medico').textContent = medicoNome ? `Dr(a). ${medicoNome}` : 'Médico';
    containerMsgs.innerHTML = '<div style="text-align:center; padding: 20px;">Carregando mensagens...</div>';
    modal.style.display = 'flex';

    if (typeof API !== 'undefined') {
        const msgs = await API.listarMsgs(consultaId);
        containerMsgs.innerHTML = '';
        if (!msgs || msgs.erro || msgs.length === 0) {
            containerMsgs.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">Nenhuma mensagem registrada nesta consulta.</div>';
            return;
        }

        msgs.forEach(msg => {
            const div = document.createElement('div');
            const isMe = msg.tipo === 'paciente';
            div.style = `padding:8px; margin:5px; border-radius:5px; max-width:80%; word-wrap:break-word; ${isMe ? 'background:#dcf8c6; margin-left:auto;' : 'background:#f0f0f0; border:1px solid #ddd;'}`;

            let conteudo = msg.mensagem;
            if (conteudo.startsWith('[ANEXO]')) {
                const parts = conteudo.split('|');
                const fileUrl = parts[1];
                const fileName = parts[2] || 'Arquivo Anexado';
                const isImage = fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) != null || fileUrl.startsWith('data:image');

                if (isImage) {
                    conteudo = `<a href="${fileUrl}" target="_blank"><img src="${fileUrl}" style="max-width:100%; border-radius:4px; margin-top:5px; border:1px solid #ccc;"></a>`;
                } else {
                    conteudo = `<a href="${fileUrl}" target="_blank" style="display:inline-block; margin-top:5px; color:#004b82; text-decoration:none; background:#e3f2fd; padding:5px 10px; border-radius:4px; border:1px solid #b6d4fe;"><i class='fi fi-rr-clip'></i>  ${fileName}</a>`;
                }
            }

            div.innerHTML = `<div style="font-size:0.7rem; color:#666; margin-bottom:2px;">${isMe ? 'Você' : msg.remetente} - ${msg.data || ''}</div><div>${conteudo}</div>`;
            containerMsgs.appendChild(div);
        });

        // Scroll to bottom
        containerMsgs.scrollTop = containerMsgs.scrollHeight;
    }
}

function fecharChatHistorico() {
    const modal = document.getElementById('modalChatHistorico');
    if (modal) modal.style.display = 'none';
}
function renderizarCondicoesHeader() { }

function setTextIfElement(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function calcularIdade(dataNasc) {
    const hoje = new Date();
    const nasc = new Date(dataNasc);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
}

window.abrirCarteirinha = function () { document.getElementById('modalCarteirinha').style.display = 'flex'; document.getElementById('modalCarteirinha').classList.add('show'); }
window.fecharCarteirinha = function () { document.getElementById('modalCarteirinha').classList.remove('show'); setTimeout(() => { document.getElementById('modalCarteirinha').style.display = 'none'; }, 300); }
window.abrirExames = function () { document.getElementById('modalExames').style.display = 'flex'; document.getElementById('modalExames').classList.add('show'); }
window.fecharExames = function () { document.getElementById('modalExames').classList.remove('show'); setTimeout(() => { document.getElementById('modalExames').style.display = 'none'; }, 300); }

// ── FASE 4: MÓDULO CLÍNICO INTEGRADO (PACIENTE) ─────────────────

async function carregarMedicacoesPacienteAPI() {
    const list = document.getElementById('lista-medicacoes-paciente');
    if (!list) return;

    if (typeof API === 'undefined') return;

    const meds = await API.medicacoesHistorico();

    list.innerHTML = '';

    if (!meds || meds.erro || meds.length === 0) {
        list.innerHTML = '<p class="empty-msg" style="text-align: center; color: #888;">Nenhuma prescrição ou aplicação registrada no seu histórico recente.</p>';
        return;
    }

    meds.forEach(m => {
        const div = document.createElement('div');
        div.style = 'margin-bottom: 12px; padding: 12px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid ' + (m.status === 'Aplicado' ? '#2ecc71' : '#f39c12') + ';';

        let headerStatus = m.status === 'Aplicado' ?
            `<span style="color: #27ae60; font-weight: bold; float: right; font-size: 0.85rem;"><i class='fi fi-rr-check-circle'></i>  Aplicado</span>` :
            `<span style="color: #e67e22; font-weight: bold; float: right; font-size: 0.85rem;">⏳ Aguardando Aplicação</span>`;

        let msgAplicacao = m.status === 'Aplicado' ?
            `<div style="font-size: 0.85rem; color: #27ae60; margin-top: 8px; border-top: 1px dashed #eee; padding-top: 8px;"><i class='fi fi-rr-user-md'></i>  Aplicado por: <strong>${m.enfermeiro || 'Equipe Enfermagem'}</strong> em ${new Date(m.data_aplicacao).toLocaleString()}</div>` : '';

        div.innerHTML = `
            ${headerStatus}
            <h4 style="margin: 0 0 5px 0; color: #333;"><i class='fi fi-rr-medicine'></i>  ${m.medicamento}</h4>
            <div style="font-size: 0.9rem; color: #555;">
                Dose: <strong>${m.dosagem}</strong> | Via: ${m.via} <br>
                Frequência: ${m.frequencia}
            </div>
            <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">
                Prescrito por: Dr(a). ${m.medico} em ${new Date(m.data_prescricao).toLocaleDateString()}
            </div>
            ${msgAplicacao}
        `;
        list.appendChild(div);
    });
}

window.mudarTabPaciente = function (tabName) {
    // Esconde todos os conteudos
    document.getElementById('paciente-tab-observacoes').style.display = 'none';
    document.getElementById('paciente-tab-exames').style.display = 'none';
    const tabMed = document.getElementById('paciente-tab-medicacoes');
    if (tabMed) tabMed.style.display = 'none';

    // Remove active
    const btns = document.querySelectorAll('.tab-btn-paciente');
    btns.forEach(b => {
        b.classList.remove('active');
        b.style.color = '#666';
        b.style.fontWeight = 'normal';
        b.style.borderBottom = 'none';
    });

    // Mostra o ativo
    const conteudos = {
        'observacoes': 'paciente-tab-observacoes',
        'exames': 'paciente-tab-exames',
        'medicacoes': 'paciente-tab-medicacoes'
    };

    document.getElementById(conteudos[tabName]).style.display = 'block';

    // Highlight botão clicado 
    const ativou = Array.from(btns).find(b => b.getAttribute('onclick').includes(tabName));
    if (ativou) {
        ativou.classList.add('active');
        ativou.style.color = '#004b82';
        ativou.style.fontWeight = 'bold';
        ativou.style.borderBottom = '2px solid #004b82';
    }
}

async function carregarResumoSaudeAPI() {
    if (typeof API === 'undefined') return;

    const resumo = await API.resumoSaudePaciente();

    if (resumo && !resumo.erro && resumo.data_atualizacao) {
        setTextIfElement('rs-pressao', `${resumo.pressao || '--'} mmHg`);
        setTextIfElement('rs-imc', `${resumo.imc || '--'} / ${resumo.temperatura ? resumo.temperatura + '°C' : '--'}`);
        setTextIfElement('rs-peso', `${resumo.peso ? resumo.peso + ' kg' : '--'}`);

        const d = new Date(resumo.data_atualizacao);
        setTextIfElement('rs-data', `Atualizado em: ${d.toLocaleDateString()} ${d.toLocaleTimeString().substring(0, 5)}`);
    } else {
        setTextIfElement('rs-pressao', '--');
        setTextIfElement('rs-imc', '--');
        setTextIfElement('rs-peso', '--');
        setTextIfElement('rs-data', 'Nenhuma triagem registrada ainda.');
    }
}

// ── REGISTRO DE TELEMEDICINA DO PACIENTE ───────────────────────────
window.solicitarRegistroTelemedicina = async function() {
    const result = await Swal.fire({
        title: 'Ativar Telemedicina?',
        text: 'Deseja habilitar seu acesso às Consultas Online? O serviço ficará vinculado ao seu CPF imediatamente.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, Ativar!',
        cancelButtonText: 'Agora Não',
        confirmButtonColor: '#6c5ce7'
    });

    if (!result.isConfirmed) return;

    const btn = document.getElementById('btn-registro-telemedicina');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '⏳ Processando...';
    try {
        const resp = await API.pacienteRegistroTelemedicina();
        if(resp && resp.sucesso) {
            Swal.fire({ 
                icon: 'success', 
                title: 'Ativado!', 
                html: resp.msg 
            });
            btn.innerHTML = '<i class=\"fi fi-rr-check-circle\"></i>  Telemedicina Ativa';
            btn.style.background = '#28a745';
            btn.style.color = '#fff';
            btn.style.borderColor = '#28a745';
            btn.style.borderWidth = '1px';
            btn.onclick = () => window.location.href = 'telemedicina.html';
        } else {
            Swal.fire({ 
                icon: 'error', 
                title: 'Erro', 
                text: resp ? resp.erro : 'Ocorreu um erro ao ativar o serviço.' 
            });
            btn.innerHTML = originalHtml;
        }
    } catch(err) { 
        console.error(err); 
        btn.innerHTML = originalHtml;
    }
}


// ── AUTO CHECK-IN PRESENCIAL ─────────────────────────────────────
window.realizarAutoCheckin = async function(id) {
    if (typeof API === 'undefined') return;
    
    try {
        const btn = document.getElementById(`btn-checkin-${id}`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Processando...';
        }
        
        const resp = await API.checkinPresencialConsulta(id);
        if (resp && resp.sucesso) {
            Swal.fire({
                icon: 'success',
                title: 'Check-in Realizado!',
                html: `Sua presença foi confirmada com sucesso!<br>Sua senha na fila é:<br><strong style="font-size: 2.2rem; color: #2e7d32; display:block; margin: 10px 0;">${resp.senha_fila}</strong><br>Acompanhe o painel de chamadas do consultório.`,
                confirmButtonText: 'Entendido'
            }).then(() => {
                window.location.reload();
            });
        } else {
            throw new Error(resp.erro || 'Falha ao realizar check-in.');
        }
    } catch (err) {
        console.error(err);
        Swal.fire({
            icon: 'error',
            title: 'Erro no Check-in',
            text: err.message || 'Não foi possível realizar o auto check-in. Tente novamente mais tarde ou passe no balcão.'
        });
        const btn = document.getElementById(`btn-checkin-${id}`);
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🎫 Ativar Fila (Auto Check-in)';
        }
    }
};

