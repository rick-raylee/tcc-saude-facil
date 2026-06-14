let sessaoTelemedicina = null;
let jitsiApi = null;
let salaPadrao = "SalaMedica" + Math.floor(Math.random() * 1000000);
window.activeConsultaId = null;
let currentPacienteId = null;
let currentPacienteCpf = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar Sessão via API
    if (typeof API !== 'undefined') {
        const p = await API.sessao();
        if (p && p.logado && p.usuario && (p.usuario.tipo === 'medico_tele' || p.usuario.tipo === 'medico')) {
            sessaoTelemedicina = p.usuario;
            document.getElementById('nome-medico-tele').textContent = 'Dr(a). ' + p.usuario.nome;
            
            // Buscar CRM e dados locais de medicoRegistrado
            const medicoLocal = JSON.parse(localStorage.getItem('medicoRegistrado') || '{}');
            document.getElementById('crm-medico-tele').textContent = 'CRM: ' + (medicoLocal.crm || p.usuario.crm || 'N/D');
            
            // Buscar link da sala padrão do backend ou do localStorage se existir
            if(p.usuario.telemedicina_link_padrao) {
                salaPadrao = p.usuario.telemedicina_link_padrao.split('/').pop() || salaPadrao;
            } else if (medicoLocal.link_sala_padrao) {
                salaPadrao = medicoLocal.link_sala_padrao.split('/').pop() || salaPadrao;
            }

            carregarFilaOnlineAPI();
            return;
        } else {
            alert('⛔ Acesso negado. Esta área é exclusiva para Médicos de Telemedicina.');
            window.location.href = 'index.html';
        }
    } else {
        // Fallback pra Dev Offline
        alert("Modo Offline - Banco de dados inativo");
        window.location.href = 'index.html';
    }
});

async function carregarFilaOnlineAPI() {
    const lista = document.getElementById('fila-online-lista');
    if (!lista) return;

    if (typeof API === 'undefined') return;

    const consultas = await API.teleConsultas();
    
    lista.innerHTML = '';

    if (!consultas || consultas.erro || consultas.length === 0) {
        lista.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">Nenhum paciente aguardando no momento.</div>';
        document.getElementById('stat-atendimentos').textContent = '0';
        return;
    }

    // Filtrar apenas as da telemedicina que não estejam concluídas
    const consultasOnline = consultas.filter(c => c.tipo && c.tipo.toLowerCase() === 'telemedicina' && c.status !== 'Concluido' && c.status !== 'finalizada');
    document.getElementById('stat-atendimentos').textContent = consultasOnline.length;

    if (consultasOnline.length === 0) {
        lista.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">Fila virtual livre.</div>';
        return;
    }

    consultasOnline.forEach(c => {
        const div = document.createElement('div');
        div.className = 'card-paciente-fila';
        const statusClass = c.status ? c.status.toLowerCase() : 'agendada';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="color:white; font-size:1.15rem; font-family:'Outfit', sans-serif;">${c.paciente_nome}</strong>
                <span class="status-badge status-${statusClass}">${c.status.toUpperCase()}</span>
            </div>
            <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <i class="fi fi-rr-clock-three" style="color:#38bdf8;"></i> Agendado para as ${c.hora || 'Hoje'}
            </div>
            <button class="btn-iniciar-chamada" onclick="iniciarChamada('${c.id}', '${c.paciente_nome}', '${c.paciente_id}', '${c.paciente_cpf || ''}')">
                <i class="fi fi-rr-video-camera-alt"></i> INICIAR ATENDIMENTO
            </button>
        `;
        lista.appendChild(div);
    });
}

window.iniciarChamada = async function(id_consulta, nome_paciente, paciente_id, paciente_cpf) {
    document.getElementById('dash-vazio').style.display = 'none';
    
    // Tornar o workspace completo visível (Jitsi + Painel Clínico)
    const workspace = document.getElementById('tele-workspace');
    if (workspace) {
        workspace.style.display = 'flex';
    }
    
    const container = document.getElementById('jitsi-container');
    if (container) {
        container.style.display = 'block';
    }
    
    document.getElementById('controles-fim').style.display = 'flex';
    window.activeConsultaId = id_consulta;
    currentPacienteId = paciente_id;
    currentPacienteCpf = paciente_cpf;

    // Carregar perfil de saúde do paciente no painel do meio
    if (paciente_cpf) {
        carregarPerfilSaudePaciente(paciente_cpf);
    }

    // Resetar o formulário clínico para este novo atendimento
    const form = document.getElementById('form-tele-clinico');
    if (form) {
        form.reset();
        
        // Configurar os estados padrão dos checkboxes
        const recChk = document.getElementById('emitir-receita-chk');
        if (recChk) {
            recChk.checked = true;
            toggleReceitaForm(true);
        }
        const atChk = document.getElementById('emitir-atestado-chk');
        if (atChk) {
            atChk.checked = false;
            toggleAtestadoForm(false);
        }
        
        // Configurar dropdown de encaminhamento
        const nextStep = document.getElementById('clin-proxima-etapa');
        if (nextStep) {
            nextStep.value = 'alta';
            toggleEncaminhamentoDropdown('alta');
        }
    }

    const roomName = "ceep_teleconsulta_" + id_consulta + "_" + salaPadrao;
    
    try {
        await API.teleStatus(id_consulta, 'Em Atendimento');
    } catch(e) { console.error('Aviso ao registrar log da sala:', e); }

    const domain = 'meet.jit.si';
    const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: container,
        userInfo: {
            displayName: document.getElementById('nome-medico-tele').textContent
        },
        configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false
        },
        interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'fodeviceselection', 'hangup', 'profile', 'chat', 'settings',
                'videoquality', 'filmstrip', 'shortcuts', 'tileview'
            ],
            SHOW_CHROME_EXTENSION_BANNER: false
        }
    };
    
    container.innerHTML = '';
    jitsiApi = new JitsiMeetExternalAPI(domain, options);
}

// ── COMPONENTES CLÍNICOS E DOCUMENTAÇÃO ───────────────────────

window.toggleReceitaForm = function(checked) {
    const form = document.getElementById('clin-receita-form');
    if (form) {
        form.style.display = checked ? 'flex' : 'none';
        const med = document.getElementById('clin-med');
        const dose = document.getElementById('clin-dose');
        const freq = document.getElementById('clin-freq');
        if (med) med.required = checked;
        if (dose) dose.required = checked;
        if (freq) freq.required = checked;
    }
}

window.toggleAtestadoForm = function(checked) {
    const form = document.getElementById('clin-atestado-form');
    if (form) {
        form.style.display = checked ? 'flex' : 'none';
        const dias = document.getElementById('clin-dias');
        const motivo = document.getElementById('clin-motivo');
        if (dias) dias.required = checked;
        if (motivo) motivo.required = checked;
    }
}

window.toggleEncaminhamentoDropdown = async function(value) {
    const wrapper = document.getElementById('clin-wrapper-encaminhamento');
    if (!wrapper) return;
    
    if (value === 'encaminhar') {
        wrapper.style.display = 'flex';
        const selectMed = document.getElementById('clin-encaminhar-medico');
        if (selectMed) {
            selectMed.innerHTML = '<option value="">Carregando especialistas...</option>';
            selectMed.required = true;
            try {
                if (typeof API !== 'undefined') {
                    const medicos = await API.listarMedicos();
                    selectMed.innerHTML = '<option value="">Selecione o médico especialista</option>';
                    if (medicos && !medicos.erro && Array.isArray(medicos)) {
                        const currentMedId = sessaoTelemedicina ? sessaoTelemedicina.id : null;
                        medicos.forEach(m => {
                            if (m.id !== currentMedId) {
                                const opt = document.createElement('option');
                                opt.value = m.id;
                                opt.textContent = `${m.nome} - ${m.especialidade} (CRM: ${m.crm || 'N/D'})`;
                                selectMed.appendChild(opt);
                            }
                        });
                    } else {
                        selectMed.innerHTML = '<option value="">Erro ao carregar médicos</option>';
                    }
                }
            } catch (e) {
                console.error("Erro ao carregar médicos para encaminhamento:", e);
                selectMed.innerHTML = '<option value="">Erro ao carregar médicos</option>';
            }
        }
    } else {
        wrapper.style.display = 'none';
        const selectMed = document.getElementById('clin-encaminhar-medico');
        if (selectMed) selectMed.required = false;
    }
}

window.salvarAtendimentoTele = async function(e) {
    if (e) e.preventDefault();
    
    if (!window.activeConsultaId || !currentPacienteCpf) {
        alert("⚠️ Nenhuma consulta ativa para registrar.");
        return;
    }
    
    const diagnostico = document.getElementById('clin-diagnostico').value;
    const proximaEtapa = document.getElementById('clin-proxima-etapa').value;
    const encaminhadoParaMedicoId = proximaEtapa === 'encaminhar' ? document.getElementById('clin-encaminhar-medico').value : null;
    
    // Compilar medicamentos e instruções se a receita digital estiver marcada
    let medicamentos = "";
    let instrucoes = "";
    if (document.getElementById('emitir-receita-chk').checked) {
        const medName = document.getElementById('clin-med').value;
        const dose = document.getElementById('clin-dose').value;
        const freq = document.getElementById('clin-freq').value;
        const via = document.getElementById('clin-via').value || 'Oral';
        const duracao = document.getElementById('clin-duracao').value || '';
        
        medicamentos = `${medName} ${dose}`;
        instrucoes = `Frequência: ${freq} | Via: ${via} ${duracao ? `| Duração: ${duracao}` : ''}`;
    }
    
    const dadosAtendimento = {
        consulta_id: window.activeConsultaId,
        paciente_cpf: currentPacienteCpf,
        diagnostico: diagnostico,
        queixa: "Atendimento por Telemedicina",
        conduta: "Orientação e prescrição digital fornecidas via teleconsulta.",
        observacoes: proximaEtapa === 'alta' ? "Alta médica pós teleconsulta." : (proximaEtapa === 'retorno' ? "Retorno agendado." : "Encaminhado para especialista."),
        medicamentos: medicamentos,
        instrucoes: instrucoes,
        encaminhado_para_medico_id: encaminhadoParaMedicoId
    };
    
    try {
        // 1. Salvar Atendimento / Prontuário & Receita
        if (typeof API !== 'undefined') {
            const respAtd = await API.salvarAtendimento(dadosAtendimento);
            if (!respAtd || respAtd.erro) {
                alert("❌ Erro ao salvar prontuário: " + (respAtd ? respAtd.erro : "Falha desconhecida"));
                return;
            }
            
            // 2. Salvar Atestado em paralelo se marcado
            if (document.getElementById('emitir-atestado-chk').checked) {
                const dadosAtestado = {
                    paciente_cpf: currentPacienteCpf,
                    dias: parseInt(document.getElementById('clin-dias').value) || 1,
                    motivo: document.getElementById('clin-motivo').value || "Necessidade de repouso",
                    cid: document.getElementById('clin-cid').value || "",
                    consulta_id: window.activeConsultaId
                };
                
                const respAt = await API.gerarAtestado(dadosAtestado);
                if (!respAt || respAt.erro) {
                    console.warn("Aviso: Falha ao emitir atestado digital:", respAt ? respAt.erro : "");
                }
            }
            
            alert("✅ Teleconsulta finalizada com sucesso! Todos os prontuários, receitas e atestados foram assinados digitalmente e estão visíveis no portal do paciente.");
            
            // Finalizar Jitsi e voltar para a fila
            await encerrarJitsi();
        }
    } catch(err) {
        console.error("Erro ao finalizar atendimento:", err);
        alert("❌ Ocorreu um erro ao salvar o atendimento.");
    }
}

window.encerrarJitsi = async function() {
    if(jitsiApi) {
        jitsiApi.dispose();
        jitsiApi = null;
    }
    
    if (window.activeConsultaId) {
        try {
            await API.teleStatus(window.activeConsultaId, 'finalizada');
        } catch(e) { console.error('Erro ao finalizar consulta no backend:', e); }
        window.activeConsultaId = null;
    }
    
    // Ocultar workspace e exibir tela vazia
    const workspace = document.getElementById('tele-workspace');
    if (workspace) {
        workspace.style.display = 'none';
    }
    
    document.getElementById('jitsi-container').style.display = 'none';
    document.getElementById('controles-fim').style.display = 'none';
    document.getElementById('dash-vazio').style.display = 'block';
    
    carregarFilaOnlineAPI();
}

window.editarSalaPadrao = async function() {
    let sala = prompt("Crie uma URL/Código customizado para sua sala particular (Evite espaços):", salaPadrao);
    if(sala && sala.trim() !== '') {
        sala = sala.trim().replace(/ +/g, "");
        salaPadrao = sala;
        if(typeof API !== 'undefined') {
            await API.teleConfigPerfil({ tipo_atendimento: 'telemedicina', link_sala_padrao: salaPadrao });
        }
        alert("Sala padrão alterada para: " + salaPadrao);
    }
}

window.logoutTele = async function() {
    if (typeof API !== 'undefined') {
        await API.logout();
    }
    localStorage.clear();
    window.location.href = 'index.html';
}

let currentPacienteDbId = null;

window.carregarPerfilSaudePaciente = async function(cpf) {
    if (!cpf) return;
    
    try {
        if (typeof API !== 'undefined') {
            const pac = await API.buscarPacienteMed(cpf);
            if (pac && !pac.erro) {
                // Preencher nome, idade, SUS
                document.getElementById('pac-nome-val').textContent = pac.nome;
                
                // Calcular idade se data_nascimento estiver disponível
                let idadeStr = pac.idade || '--';
                if (pac.data_nascimento && (!pac.idade || pac.idade === '--')) {
                    const dob = new Date(pac.data_nascimento);
                    const diffMs = Date.now() - dob.getTime();
                    const ageDt = new Date(diffMs);
                    idadeStr = Math.abs(ageDt.getUTCFullYear() - 1970);
                }
                
                document.getElementById('pac-meta-val').textContent = `${idadeStr} anos • SUS: ${pac.sus || 'N/D'}`;
                
                // Configurar avatar
                const iniciais = pac.nome ? pac.nome.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() : 'P';
                document.getElementById('pac-avatar-inits').textContent = iniciais;
                
                // Vinais/Triagem
                if (pac.triagem) {
                    const t = pac.triagem;
                    document.getElementById('pac-pressao-val').textContent = t.pressao || '--';
                    document.getElementById('pac-fc-val').textContent = t.fc ? `${t.fc} bpm` : '--';
                    document.getElementById('pac-peso-altura-val').textContent = `${t.peso ? t.peso+' kg' : '--'} / ${t.altura ? t.altura+' m' : '--'}`;
                    document.getElementById('pac-imc-val').textContent = t.imc || '--';
                    document.getElementById('pac-temp-val').textContent = t.temperatura ? `${t.temperatura} °C` : '--';
                    document.getElementById('pac-sat-val').textContent = t.saturacao ? `${t.saturacao}%` : '--';
                    document.getElementById('pac-queixa-val').textContent = t.queixa || 'Nenhuma queixa registrada na triagem.';
                } else {
                    // Limpar valores se não houver triagem
                    document.getElementById('pac-pressao-val').textContent = '--';
                    document.getElementById('pac-fc-val').textContent = '--';
                    document.getElementById('pac-peso-altura-val').textContent = '-- / --';
                    document.getElementById('pac-imc-val').textContent = '--';
                    document.getElementById('pac-temp-val').textContent = '--';
                    document.getElementById('pac-sat-val').textContent = '--';
                    document.getElementById('pac-queixa-val').textContent = 'Nenhuma queixa triada para este paciente.';
                }
                
                // Renderizar doenças
                renderizarDoencasTele(pac.doencas || [], pac.id);
            }
        }
    } catch(err) {
        console.error("Erro ao carregar perfil de saúde do paciente:", err);
    }
}

function renderizarDoencasTele(doencas, pacienteId) {
    currentPacienteDbId = pacienteId;
    const container = document.getElementById('pac-doencas-list');
    if (!container) return;
    
    container.innerHTML = '';
    if (!doencas || doencas.length === 0) {
        container.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Nenhuma condição crônica ativa.</span>';
        return;
    }
    
    doencas.forEach(d => {
        const tag = document.createElement('span');
        tag.className = 'patient-badge-condicao';
        tag.innerHTML = `${d.nome} <span onclick="removerDoencaTele('${d.id}')" style="cursor:pointer; font-weight:bold; opacity:0.6;">✕</span>`;
        container.appendChild(tag);
    });
}

window.adicionarCondicaoTele = async function() {
    const input = document.getElementById('pac-nova-doenca-input');
    if (!input) return;
    
    const nome = input.value.trim();
    if (!nome) return;
    
    if (!currentPacienteDbId) {
        alert("⚠️ Nenhum paciente selecionado ou carregado.");
        return;
    }
    
    try {
        if (typeof API !== 'undefined') {
            const resp = await API.adicionarDoenca(currentPacienteDbId, nome);
            if (resp && !resp.erro) {
                input.value = '';
                // Recarregar perfil
                if (currentPacienteCpf) {
                    await carregarPerfilSaudePaciente(currentPacienteCpf);
                }
            } else {
                alert("Erro ao adicionar condição: " + (resp ? resp.erro : "desconhecido"));
            }
        }
    } catch(err) {
        console.error("Erro ao adicionar doença:", err);
    }
}

window.removerDoencaTele = async function(id) {
    if (!confirm("Deseja realmente remover esta condição de saúde do paciente?")) return;
    
    try {
        if (typeof API !== 'undefined') {
            const resp = await API.removerDoenca(id);
            if (resp && !resp.erro) {
                // Recarregar perfil
                if (currentPacienteCpf) {
                    await carregarPerfilSaudePaciente(currentPacienteCpf);
                }
            } else {
                alert("Erro ao remover condição: " + (resp ? resp.erro : "desconhecido"));
            }
        }
    } catch(err) {
        console.error("Erro ao remover doença:", err);
    }
}

window.togglePanel = function(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    
    panel.classList.toggle('collapsed');
}

