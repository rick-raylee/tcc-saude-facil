async function initEnf() {
    console.log("Enfermeiro: Inicializando painel...");
    // Tentar carregar via API primeiro
    let viaAPI = false;
    if (typeof API !== 'undefined') {
        const sessao = await API.sessao();
        if (sessao && sessao.logado) {
            viaAPI = true;
            localStorage.setItem('usuarioLogado', 'true');
            localStorage.setItem('tipoUsuario', sessao.usuario?.tipo || sessao.tipo);
            const nomeNav = document.getElementById('enf-nome-navbar');
            if (nomeNav) nomeNav.textContent = sessao.usuario?.nome || sessao.nome;
        } else if (sessao && !sessao.logado && localStorage.getItem('usuarioLogado') === 'true') {
            // Sessão morta na API
            localStorage.removeItem('usuarioLogado');
            window.location.replace('/');
            return;
        }
    }

    // Sempre verificar acesso básico (local ou API)
    verificarAcessoEnf();

    // Carregar dados locais imediatamente (prevenir tela vazia)
    carregarDadosEnfermeiro();

    carregarMedicosDisponiveis();
    carregarVacinasSelect();
    carregarAtendimentosDoDia();
    carregarResumoEnfermeiro();
    carregarPrescricoesPendentes();

    // Refresh periódico (10s)
    setInterval(() => {
        carregarAtendimentosDoDia();
        carregarResumoEnfermeiro();
        carregarPrescricoesPendentes();
    }, 10000);
}

// Inicialização robusta
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnf);
} else {
    initEnf();
}

function verificarAcessoEnf() {
    const isLogado = localStorage.getItem('usuarioLogado') === 'true';
    const tipo = localStorage.getItem('tipoUsuario');

    console.log("Verificando acesso Enf:", { isLogado, tipo });

    if (!isLogado || (tipo && tipo.toLowerCase() !== 'enfermeiro')) {
        console.warn("Acesso negado: Redirecionando para HOME");
        Swal.fire({
            icon: 'error',
            title: 'Acesso Restrito',
            text: 'Acesso permitido apenas para enfermeiros cadastrados.'
        }).then(() => {
            window.location.replace('/');
        });
        return;
    }

    const enf = JSON.parse(localStorage.getItem('enfermeiroRegistrado') || 'null');
    const nome = localStorage.getItem('usuarioNome') || 'Enfermeiro(a)';
    document.getElementById('enf-nome-navbar').textContent = nome;
    if (enf && document.getElementById('enf-coren-navbar')) {
        document.getElementById('enf-coren-navbar').textContent = 'COREN: ' + (enf.coren || '---');
    }
}

function carregarDadosEnfermeiro() {
    // Redirecionado para verificarAcessoEnf para centralizar
    verificarAcessoEnf();
}

function sairPainel() {
    if (typeof API !== 'undefined') API.logout();
    localStorage.removeItem('usuarioLogado');
    localStorage.removeItem('tipoUsuario');
    localStorage.removeItem('usuarioNome');
    window.location.replace('/');
}

let pacienteNovo = false;

// ===== BUSCA DE PACIENTE =====
async function buscarPacienteEnf() {
    const cpfInput = document.getElementById('enf-busca-cpf').value;
    const cpfLimpo = cpfInput.replace(/\D/g, '');

    if (cpfLimpo.length < 11) {
        Swal.fire({ icon: 'warning', title: 'CPF Inválido', text: 'Digite um CPF válido com 11 dígitos para buscar o paciente.' });
        return;
    }

    // Reset UI
    document.getElementById('enf-ficha-paciente').style.display = 'none';
    document.getElementById('enf-novo-paciente').style.display = 'none';
    document.getElementById('enf-tabs-container').style.display = 'none';
    pacienteNovo = false;

    // ── VIA API ──
    if (typeof API !== 'undefined') {
        const pac = await API.buscarPacienteEnf(cpfInput);
        if (pac && !pac.erro) {
            pacienteAtual = pac;
            exibirFichaPaciente(pacienteAtual);
            return;
        } else if (pac && pac._status === 404) {
            // Mostrar formulário de cadastro rápido
            document.getElementById('enf-novo-paciente').style.display = 'block';
            document.getElementById('enf-welcome').style.display = 'none';
            document.getElementById('enf-novo-cpf').value = cpfInput; // Pre-fill CPF
            return;
        }
    }

    // ── FALLBACK LOCAL ──
    const dbPacientes = JSON.parse(localStorage.getItem('db_pacientes') || '[]');
    const encontrado = dbPacientes.find(p => p.cpf.replace(/\D/g, '') === cpfLimpo);
    if (encontrado) {
        pacienteAtual = encontrado;
        exibirFichaPaciente(pacienteAtual);
        return;
    }
    
    // Se não encontrou nem na API nem no Local, mostra o formulário de novo paciente
    document.getElementById('enf-novo-paciente').style.display = 'block';
    document.getElementById('enf-welcome').style.display = 'none';
    document.getElementById('enf-novo-cpf').value = cpfInput; // Pre-fill CPF
}

function abrirCadastroManual() {
    // Esconder outras áreas
    document.getElementById('enf-ficha-paciente').style.display = 'none';
    document.getElementById('enf-tabs-container').style.display = 'none';
    document.getElementById('enf-welcome').style.display = 'none';
    
    // Mostrar o form de cadastro rápido limpo
    document.getElementById('enf-novo-paciente').style.display = 'block';
    
    // Limpar os campos do form
    document.getElementById('enf-busca-cpf').value = '';
    if (document.getElementById('enf-novo-cpf')) document.getElementById('enf-novo-cpf').value = '';
    document.getElementById('enf-novo-nome').value = '';
    document.getElementById('enf-novo-sus').value = '';
    document.getElementById('enf-novo-nasc').value = '';
    
    pacienteNovo = true;
}

function prepararTriagemNova() {
    const nome = document.getElementById('enf-novo-nome').value.trim();
    if (!nome) { Swal.fire({ icon: 'warning', title: 'Campo Obrigatório', text: 'Informe o nome do paciente.' }); return; }
    
    let cpf = document.getElementById('enf-novo-cpf') ? document.getElementById('enf-novo-cpf').value : document.getElementById('enf-busca-cpf').value;
    if (!cpf) { Swal.fire({ icon: 'warning', title: 'Campo Obrigatório', text: 'Informe o CPF do paciente.' }); return; }
    
    const sus = document.getElementById('enf-novo-sus').value.trim();
    const nasc = document.getElementById('enf-novo-nasc').value;
    
    pacienteAtual = {
        nome: nome,
        cpf: cpf,
        sus: sus,
        data_nascimento: nasc,
        isNovo: true
    };
    
    pacienteNovo = true;
    
    // Simular exibição de ficha com os dados digitados
    document.getElementById('enf-paciente-nome').textContent = nome + " (Novo)";
    document.getElementById('enf-paciente-cpf').textContent = 'CPF: ' + cpf;
    document.getElementById('enf-paciente-idade').textContent = nasc ? calcularIdade(nasc) : '---';
    document.getElementById('enf-paciente-sus').textContent = sus || '---';

    document.getElementById('enf-novo-paciente').style.display = 'none';
    document.getElementById('enf-ficha-paciente').style.display = 'block';
    document.getElementById('enf-tabs-container').style.display = 'block';
    
    // Mudar para aba triagem
    mudarAbaEnf('triagem');
}

async function exibirFichaPaciente(paciente) {
    document.getElementById('enf-paciente-nome').textContent = paciente.nome;
    document.getElementById('enf-paciente-cpf').textContent = 'CPF: ' + paciente.cpf;
    const idade = paciente.data_nascimento ? calcularIdade(paciente.data_nascimento) : (paciente.idade || '---');
    document.getElementById('enf-paciente-idade').textContent = idade;
    document.getElementById('enf-paciente-sus').textContent = paciente.sus || '---';

    document.getElementById('enf-ficha-paciente').style.display = 'block';
    document.getElementById('enf-welcome').style.display = 'none';
    document.getElementById('enf-tabs-container').style.display = 'block';

    // Carregar dados
    await carregarVacinasPaciente();
    await carregarHistoricoPaciente();
}

function calcularIdade(dataNasc) {
    const hoje = new Date();
    const nasc = new Date(dataNasc);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
}

// ===== TABS =====
function mudarAbaEnf(aba) {
    document.querySelectorAll('.enf-aba-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.enf-tab').forEach(el => el.classList.remove('active'));
    document.getElementById('aba-' + aba).style.display = 'block';
    document.getElementById('tab-' + aba).classList.add('active');
}

// ===== MÉDICOS DISPONÍVEIS =====
async function carregarMedicosDisponiveis() {
    const select = document.getElementById('triagem-medico');
    if (!select) return;
    select.innerHTML = '<option value="">Buscando médicos...</option>';

    // 1. TENTA VIA API
    if (typeof API !== 'undefined') {
        const medicos = await API.listarMedicosEnf();
        if (medicos && Array.isArray(medicos) && medicos.length > 0) {
            select.innerHTML = '<option value="">Selecione um médico disponível...</option>';
            medicos.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.nome;
                opt.textContent = `${m.nome} — ${m.especialidade || 'Geral'}`;
                select.appendChild(opt);
            });
            console.log('Enfermeiro: Médicos carregados via API.');
            return;
        }
    }

    // 2. FALLBACK LOCAL (Mock ou LocalStorage)
    console.warn('Enfermeiro: Buscando médicos no fallback local...');
    const dbMedicos = JSON.parse(localStorage.getItem('db_medicos') || '[]');
    select.innerHTML = '<option value="">Selecione um médico disponível...</option>';

    if (dbMedicos.length === 0) {
        const opt = document.createElement('option');
        opt.value = 'Dr. Plantonista';
        opt.textContent = 'Dr. Plantonista — Clínica Geral';
        select.appendChild(opt);
    }

    dbMedicos.forEach(med => {
        const opt = document.createElement('option');
        opt.value = med.nome;
        opt.textContent = `${med.nome} — ${med.especialidade || 'Geral'}`;
        select.appendChild(opt);
    });
}

// ===== TRIAGEM =====
async function salvarTriagem(event) {
    event.preventDefault();
    if (!pacienteAtual) { Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Realize a busca de um paciente antes de salvar a triagem.' }); return; }

    const dados = {
        paciente_cpf: pacienteAtual.cpf,
        peso: document.getElementById('triagem-peso').value,
        altura: document.getElementById('triagem-altura').value,
        pressao: document.getElementById('triagem-pressao').value,
        fc: document.getElementById('triagem-fc').value,
        temperatura: document.getElementById('triagem-temp').value,
        saturacao: document.getElementById('triagem-saturacao').value,
        queixa: document.getElementById('triagem-queixa').value,
        medico_destino: document.getElementById('triagem-medico').value,
        prioridade: document.getElementById('triagem-prioridade').value
    };

    if (pacienteNovo) {
        dados.nome_novo = pacienteAtual.nome;
        dados.sus_novo = pacienteAtual.sus;
        dados.nasc_novo = pacienteAtual.data_nascimento;
    }

    // VIA API
    if (typeof API !== 'undefined') {
        const resp = await API.salvarTriagem(dados);
        if (resp && resp.sucesso) {
            if (resp.senha) {
                Swal.fire({
                    icon: 'success',
                    title: 'Triagem Realizada',
                    html: `Triagem salva com sucesso!<br><br>🎟️ SENHA DA FILA: <b>${resp.senha}</b><br>(Informe ao paciente)`
                });
            } else {
                Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Triagem salva com sucesso!' });
            }
            document.getElementById('formTriagem').reset();
            adicionarAtendimentoDia({ nome: pacienteAtual.nome, hora: new Date().toLocaleTimeString(), tipo: 'Triagem', prioridade: dados.prioridade });
            await carregarHistoricoPaciente();
            return;
        }
    }

    // FALLBACK LOCAL
    let dbTriagens = JSON.parse(localStorage.getItem('db_triagens') || '[]');
    const triagemLocal = { ...dados, pacienteNome: pacienteAtual.nome, data: new Date().toLocaleDateString(), hora: new Date().toLocaleTimeString(), imc: (parseFloat(dados.peso) / (Math.pow(parseFloat(dados.altura) / 100, 2))).toFixed(1) };
    dbTriagens.push(triagemLocal);
    localStorage.setItem('db_triagens', JSON.stringify(dbTriagens));
    Swal.fire({ icon: 'info', title: 'Modo Offline', html: `<i class="fi fi-rr-check-circle"></i>  Triagem salva localmente no dispositivo.` });
    document.getElementById('formTriagem').reset();
    adicionarAtendimentoDia(triagemLocal, 'Triagem');
    await carregarHistoricoPaciente();
}

// ===== VACINAS =====
const vacinasSUS = [
    { id: 'bcg', nome: 'BCG (Bacilo Calmette-Guérin)', dose: 'Dose Única' },
    { id: 'hepb_nasc', nome: 'Hepatite B', dose: 'Ao nascer' },
    { id: 'penta_1', nome: 'Pentavalente (DTP+Hib+HepB)', dose: '1ª Dose' },
    { id: 'vip_1', nome: 'VIP (Poliomielite Inativada)', dose: '1ª Dose' },
    { id: 'pneumo_1', nome: 'Pneumocócica 10 Valente', dose: '1ª Dose' },
    { id: 'rota_1', nome: 'Rotavírus Humano', dose: '1ª Dose' },
    { id: 'meningo_c_1', nome: 'Meningocócica C', dose: '1ª Dose' },
    { id: 'penta_2', nome: 'Pentavalente', dose: '2ª Dose' },
    { id: 'vip_2', nome: 'VIP (Poliomielite)', dose: '2ª Dose' },
    { id: 'pneumo_2', nome: 'Pneumocócica 10V', dose: '2ª Dose' },
    { id: 'rota_2', nome: 'Rotavírus Humano', dose: '2ª Dose' },
    { id: 'meningo_c_2', nome: 'Meningocócica C', dose: '2ª Dose' },
    { id: 'penta_3', nome: 'Pentavalente', dose: '3ª Dose' },
    { id: 'vip_3', nome: 'VIP (Poliomielite)', dose: '3ª Dose' },
    { id: 'febre_amarela', nome: 'Febre Amarela', dose: 'Dose Inicial' },
    { id: 'triplice_viral_1', nome: 'Tríplice Viral', dose: '1ª Dose' },
    { id: 'pneumo_ref', nome: 'Pneumocócica 10V', dose: 'Reforço' },
    { id: 'meningo_c_ref', nome: 'Meningocócica C', dose: 'Reforço' },
    { id: 'dtp_ref_1', nome: 'DTP (Tríplice Bacteriana)', dose: '1º Reforço' },
    { id: 'tetraviral', nome: 'Tetraviral', dose: 'Dose Única' },
    { id: 'hep_a', nome: 'Hepatite A', dose: 'Dose Única' },
    { id: 'vop_ref_1', nome: 'VOP (Poliomielite Oral)', dose: '1º Reforço' },
    { id: 'dtp_ref_2', nome: 'DTP (Tríplice Bacteriana)', dose: '2º Reforço' },
    { id: 'vop_ref_2', nome: 'VOP (Poliomielite Oral)', dose: '2º Reforço' },
    { id: 'varicela', nome: 'Varicela', dose: '2ª Dose' },
    { id: 'hpv', nome: 'HPV Quadrivalente', dose: '2 Doses' },
    { id: 'meningo_acwy', nome: 'Meningocócica ACWY', dose: 'Dose Única' },
    { id: 'dt_adulto', nome: 'Dupla Adulto (dT)', dose: 'Reforço' },
    { id: 'febre_amarela_ref', nome: 'Febre Amarela', dose: 'Reforço' },
    { id: 'hepatite_b_adulto', nome: 'Hepatite B', dose: '3 Doses' },
    { id: 'influenza', nome: 'Influenza (Gripe)', dose: 'Anual' },
    { id: 'covid', nome: 'Covid-19', dose: 'Periódica' },
    { id: 'pneumo_23', nome: 'Pneumocócica 23V', dose: 'Campanha' }
];

function carregarVacinasSelect() {
    const select = document.getElementById('vacina-select');
    if (!select) return;
    vacinasSUS.forEach(v => {
        const opt = document.createElement('option'); opt.value = v.id;
        opt.textContent = `${v.nome} — ${v.dose}`; select.appendChild(opt);
    });
}

function preencherDoseVacina() {
    const vacinaId = document.getElementById('vacina-select').value;
    const vacina = vacinasSUS.find(v => v.id === vacinaId);
    document.getElementById('vacina-dose').value = vacina ? vacina.dose : '';
}

async function registrarVacina(event) {
    event.preventDefault();
    if (!pacienteAtual) { Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Busque um paciente primeiro para registrar a vacina.' }); return; }

    const vacinaId = document.getElementById('vacina-select').value;
    const vacina = vacinasSUS.find(v => v.id === vacinaId);
    if (!vacina) return;

    const dados = {
        paciente_cpf: pacienteAtual.cpf,
        vacina_nome: vacina.nome,
        dose: vacina.dose,
        lote: document.getElementById('vacina-lote').value || 'N/A',
        local_aplicacao: document.getElementById('vacina-local').value
    };

    if (typeof API !== 'undefined') {
        const resp = await API.registrarVacina(dados);
        if (resp && resp.sucesso) {
            Swal.fire({ icon: 'success', title: 'Vacina Registrada', html: '<i class=\"fi fi-rr-syringe\"></i>  Registro salvo com sucesso via API!' });
            document.getElementById('formVacina').reset();
            await carregarVacinasPaciente();
            carregarAtendimentosDoDia();
            return;
        }
    }

    // LOCAL
    let dbV = JSON.parse(localStorage.getItem('db_vacinas_paciente') || '[]');
    dbV.push({ ...dados, vacinaId: vacina.id, pacienteNome: pacienteAtual.nome, data: new Date().toLocaleDateString(), hora: new Date().toLocaleTimeString() });
    localStorage.setItem('db_vacinas_paciente', JSON.stringify(dbV));
    Swal.fire({ icon: 'info', title: 'Modo Offline', html: '<i class=\"fi fi-rr-syringe\"></i>  Vacina salva localmente no dispositivo.' });
    document.getElementById('formVacina').reset();
    await carregarVacinasPaciente();
    carregarAtendimentosDoDia();
}

async function carregarVacinasPaciente() {
    if (!pacienteAtual) return;
    let vacinasAPI = [];
    let vacinasLocais = [];
    
    // 1. Tenta carregar da API
    if (typeof API !== 'undefined') {
        vacinasAPI = await API.vacinasDoP(pacienteAtual.cpf) || [];
    }

    // 2. Sempre verifica o LocalStorage (para garantir que nada registrado offline se perca)
    const dbV = JSON.parse(localStorage.getItem('db_vacinas_paciente') || '[]');
    const cpfBusca = pacienteAtual.cpf.replace(/\D/g, ''); // Limpar CPF para comparação segura
    vacinasLocais = dbV.filter(v => (v.paciente_cpf && v.paciente_cpf.replace(/\D/g, '') === cpfBusca) || (v.pacienteCpf && v.pacienteCpf.replace(/\D/g, '') === cpfBusca));

    // 3. Mesclar (Deduplicar pelo nome da vacina e dose se necessário, mas aqui vamos apenas juntar)
    // Para evitar duplicidade visual se a vacina já subiu para a API
    const nomesJaNaAPI = new Set(vacinasAPI.map(v => `${v.vacina || v.vacina_nome}-${v.dose}`));
    
    const vacinasPendentesSync = vacinasLocais.filter(v => !nomesJaNaAPI.has(`${v.vacina_nome || v.vacina}-${v.dose}`));
    
    // Marcar as locais para identificação visual
    vacinasPendentesSync.forEach(v => v._isLocal = true);

    const vacinas = [...vacinasAPI, ...vacinasPendentesSync];

    const container = document.getElementById('enf-lista-vacinas');
    if (!container) return;

    const aplicadasMap = {};
    vacinas.forEach(v => {
        // Mapear pelo nome ou ID se disponível
        aplicadasMap[v.vacina_nome || v.vacina] = v;
    });

    let html = '';
    vacinasSUS.forEach(v => {
        const aplicada = aplicadasMap[v.nome] || aplicadasMap[v.id];
        let botoes = '';
        if (aplicada && aplicada.id) {
            botoes = `
                <div class="enf-vacina-actions">
                    <button class="btn-edit-vac" onclick="prepararEdicaoVacina(${aplicada.id}, '${v.nome}', '${aplicada.dose}', '${aplicada.lote}', '${aplicada.local}')" title="Editar">✏️</button>
                    <button class="btn-del-vac" onclick="removerVacina(${aplicada.id})" title="Excluir">🗑️</button>
                </div>
            `;
        }

        html += `
            <div class="enf-vacina-item ${aplicada ? 'aplicada' : ''}">
                <div style="flex:1;">
                    <div class="enf-vacina-nome">${v.nome}</div>
                    <div class="enf-vacina-dose">${v.dose} ${aplicada ? `<small>(Lote: ${aplicada.lote || 'N/A'})</small>` : ''}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    ${aplicada && aplicada._isLocal ? '<span class="enf-vacina-status local" style="background:#fff8e1; color:#b8860b; border:1px solid #ffeeba;">Aguardando Sinc.</span>' : ''}
                    <span class="enf-vacina-status ${aplicada ? 'aplicada' : 'pendente'}">${aplicada ? 'Aplicada' : 'Pendente'}</span>
                    ${botoes}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function prepararEdicaoVacina(id, nome, dose, lote, local) {
    const novoLote = prompt(`Editar Lote para ${nome}:`, lote);
    if (novoLote === null) return;
    const novoLocal = prompt(`Editar Local para ${nome}:`, local);
    if (novoLocal === null) return;

    const dados = {
        vacina_nome: nome,
        dose: dose,
        lote: novoLote,
        local_aplicacao: novoLocal
    };

    if (typeof API !== 'undefined') {
        const resp = await API.editarVacina(id, dados);
        if (resp && resp.sucesso) {
            Swal.fire({ icon: 'success', title: 'Atualizado', html: '<i class=\"fi fi-rr-check-circle\"></i>  Registro de vacina atualizado com sucesso!' });
            await carregarVacinasPaciente();
        } else {
            Swal.fire({ icon: 'error', title: 'Erro ao Editar', html: '<i class=\"fi fi-rr-cross-circle\"></i>  ' + (resp ? resp.erro : 'Servidor offline') });
        }
    }
}

async function removerVacina(id) {
    if (!confirm('Deseja realmente excluir este registro de vacina?')) return;

    if (typeof API !== 'undefined') {
        const resp = await API.removerVacina(id);
        if (resp && resp.sucesso) {
            Swal.fire({ icon: 'success', title: 'Removido', html: '<i class=\"fi fi-rr-check-circle\"></i>  Registro removido com sucesso.' });
            await carregarVacinasPaciente();
        } else {
            Swal.fire({ icon: 'error', title: 'Erro ao Remover', text: 'Não foi possível remover o registro de vacina.' });
        }
    }
}

async function carregarHistoricoPaciente() {
    if (!pacienteAtual) return;
    let triagens = [];
    if (typeof API !== 'undefined') {
        triagens = await API.listarTriagensPaciente(pacienteAtual.cpf);
    } else {
        triagens = JSON.parse(localStorage.getItem('db_triagens') || '[]').filter(t => t.pacienteCpf === pacienteAtual.cpf).reverse();
    }

    const container = document.getElementById('enf-historico-triagens');
    if (triagens.length === 0) {
        container.innerHTML = '<p class="enf-empty">Nenhuma triagem encontrada.</p>';
    } else {
        container.innerHTML = triagens.map(t => `
            <div class="enf-triagem-card risco-${t.prioridade}">
                <div class="triagem-header">
                    <div><span class="triagem-data"><i class='fi fi-rr-calendar'></i>  ${t.data}</span><span class="risco-badge ${t.prioridade}">${t.prioridade.toUpperCase()}</span></div>
                    <span class="triagem-medico"><i class='fi fi-rr-stethoscope'></i>  ${t.medico_destino || t.medicoDestino || 'N/A'}</span>
                </div>
                <div class="triagem-sinais">
                    <div class="triagem-sinal"><span class="sinal-label">Peso</span><span class="sinal-valor">${t.peso} kg</span></div>
                    <div class="triagem-sinal"><span class="sinal-label">Altura</span><span class="sinal-valor">${t.altura} cm</span></div>
                    <div class="triagem-sinal"><span class="sinal-label">IMC</span><span class="sinal-valor">${t.imc || '---'}</span></div>
                    <div class="triagem-sinal"><span class="sinal-label">Pressão</span><span class="sinal-valor">${t.pressao}</span></div>
                    <div class="triagem-sinal"><span class="sinal-label">FC</span><span class="sinal-valor">${t.fc || t.freqCardiaca} bpm</span></div>
                </div>
                <div class="triagem-queixa"><i class='fi fi-rr-messages'></i>  <strong>Queixa:</strong> ${t.queixa}</div>
            </div>
        `).join('');
    }
}

function carregarAtendimentosDoDia() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const todos = JSON.parse(localStorage.getItem('db_triagens') || '[]').filter(t => t.data === hoje)
        .map(t => ({ tipo: 'Triagem', nome: t.pacienteNome, hora: t.hora, prioridade: t.prioridade }));

    const container = document.getElementById('enf-lista-atendimentos');
    if (todos.length === 0) { container.innerHTML = '<p class="enf-empty">Nenhum atendimento registrado hoje.</p>'; return; }
    container.innerHTML = todos.map(a => `<div class="enf-atendimento-item ${a.prioridade ? 'risco-' + a.prioridade : ''}"><div class="atd-nome">${a.nome}</div><div class="atd-hora">⏰ ${a.hora}</div><div class="atd-tipo">${a.tipo}</div></div>`).join('');
}

function adicionarAtendimentoDia(registro) { carregarAtendimentosDoDia(); }

// ===== DASHBOARD & PRESCRIÇÕES (Missing Functions) =====
async function carregarResumoEnfermeiro() {
    if (typeof API === 'undefined') return;
    const resp = await API.resumoEnf();
    if (resp && !resp.erro) {
        if (document.getElementById('dash-aguardando-triagem')) 
            document.getElementById('dash-aguardando-triagem').textContent = resp.aguardando_triagem || 0;
        if (document.getElementById('dash-prescricoes-pendentes')) 
            document.getElementById('dash-prescricoes-pendentes').textContent = resp.prescricoes_pendentes || 0;
        if (document.getElementById('dash-vacinas-dia')) 
            document.getElementById('dash-vacinas-dia').textContent = resp.vacinas_hoje || 0;
    }
}

async function carregarPrescricoesPendentes() {
    if (typeof API === 'undefined') return;
    const prescricoes = await API.prescricoesPendentes();
    const container = document.getElementById('lista-prescricoes');
    if (!container) return;

    if (!prescricoes || prescricoes.length === 0) {
        container.innerHTML = '<p class="enf-empty">Nenhuma prescrição pendente.</p>';
        return;
    }

    container.innerHTML = prescricoes.map(p => `
        <div class="enf-prescricao-card">
            <div class="presc-info">
                <strong>${p.medicamento}</strong> - ${p.dosagem} (${p.via})
                <br><small>Paciente: ${p.paciente} | Médico: ${p.medico}</small>
                <div class="presc-obs"><i class='fi fi-rr-document'></i>  ${p.observacoes || 'Sem observações'}</div>
            </div>
            <button class="btn-aplicar" onclick="aplicarMedicamento(${p.id})"><i class='fi fi-rr-syringe'></i>  Aplicar</button>
        </div>
    `).join('');
}

async function aplicarMedicamento(id) {
    const lote = prompt('Informe o lote do medicamento:');
    if (lote === null) return;
    
    if (typeof API !== 'undefined') {
        const resp = await API.aplicarPrescricao({ prescricao_id: id, lote: lote });
        if (resp && resp.sucesso) {
            Swal.fire({ icon: 'success', title: 'Aplicado', html: '<i class=\"fi fi-rr-check-circle\"></i>  Aplicação de medicamento registrada com sucesso!' });
            carregarResumoEnfermeiro();
            carregarPrescricoesPendentes();
        } else {
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao registrar aplicação do medicamento.' });
        }
    }
}

