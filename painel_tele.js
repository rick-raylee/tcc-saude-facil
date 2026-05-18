let sessaoTelemedicina = null;
let jitsiApi = null;
let salaPadrao = "SalaMedica" + Math.floor(Math.random() * 1000000);

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar Sessão via API
    if (typeof API !== 'undefined') {
        const p = await API.sessao();
        if (p && p.autenticado && p.tipo === 'medico_tele') {
            sessaoTelemedicina = p;
            document.getElementById('nome-medico-tele').textContent = 'Dr(a). ' + p.nome;
            document.getElementById('crm-medico-tele').textContent = 'CRM: ' + (p.crm || 'N/D');
            
            // Buscar link da sala padrão do backend se existir
            if(p.telemedicina_link_padrao) {
                salaPadrao = p.telemedicina_link_padrao.split('/').pop() || salaPadrao;
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
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong style="color:white; font-size:1.1rem;">${c.paciente_nome}</strong>
                <span style="background:#eab308; color:#713f12; font-size:0.7rem; font-weight:bold; padding:2px 6px; border-radius:4px;">${c.status}</span>
            </div>
            <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:8px;">
                🕒 Agendado para as ${c.hora || 'Hoje'}
            </div>
            <button class="btn-iniciar-chamada" onclick="iniciarChamada('${c.id}', '${c.paciente_nome}')">
                📹 INICIAR CHAMADA
            </button>
        `;
        lista.appendChild(div);
    });
}

window.iniciarChamada = async function(id_consulta, nome_paciente) {
    document.getElementById('dash-vazio').style.display = 'none';
    const container = document.getElementById('jitsi-container');
    container.style.display = 'block';
    
    document.getElementById('controles-fim').style.display = 'flex';

    // Gerar string da sala
    // Idealmente, a sala deve ser vinculada à consulta ou sala padrão persistida.
    const roomName = "ceep_teleconsulta_" + id_consulta + "_" + salaPadrao;
    
    // Altera o status no banco para indicar que o médico entrou
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
    
    // Clear se já tinha iframe
    container.innerHTML = '';
    jitsiApi = new JitsiMeetExternalAPI(domain, options);
}

window.encerrarJitsi = function() {
    if(jitsiApi) {
        jitsiApi.dispose();
        jitsiApi = null;
    }
    
    document.getElementById('jitsi-container').style.display = 'none';
    document.getElementById('controles-fim').style.display = 'none';
    document.getElementById('dash-vazio').style.display = 'block';
    
    alert("Consulta finalizada. Lembre-se de anexar as receitas ou relatórios no painel tradicional se necessário.");
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
