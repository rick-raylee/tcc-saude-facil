async function initTI() {
    console.log('TI Dashboard: Iniciando verificação de sessão...');
    // Verificar sessão
    if (typeof API === 'undefined') return;
    
    const sessao = await API.sessao();
    
    // Fallback: se a API falhar ou não detectar sessão, mas temos localStorage, tentamos manter o acesso
    const tiLogadoJS = localStorage.getItem('tiLogado') === 'true';
    const nomeLocalStorage = localStorage.getItem('usuarioNome');

    if (!sessao || !sessao.logado) {
        console.warn('TI Dashboard: API não detectou sessão activa. Tentando fallback para localStorage...');
        
        if (tiLogadoJS && nomeLocalStorage) {
            console.log('TI Dashboard: Fallback bem-sucedido via localStorage para', nomeLocalStorage);
            // Permitir continuar, mas as chamadas de API subsequentes podem falhar se o backend exigir sessão
            const userEl = document.getElementById('user-name');
            if (userEl) userEl.innerText = nomeLocalStorage;
            const userFullEl = document.getElementById('user-name-full');
            if (userFullEl) userFullEl.innerText = nomeLocalStorage;
            
            // Iniciais do Avatar
            const iniciais = nomeLocalStorage.charAt(0).toUpperCase();
            const avatarTrigger = document.getElementById('ti-avatar-trigger');
            if (avatarTrigger) avatarTrigger.innerText = iniciais;
            const avatarLarge = document.getElementById('ti-avatar-large');
            if (avatarLarge) avatarLarge.innerText = iniciais;

            const statusEl = document.getElementById('backend-status');
            if (statusEl) {
                statusEl.innerText = 'Online (Fallback)';
                statusEl.style.background = '#f59e0b'; // Laranja para indicar aviso
            }
        } else {
            console.error('TI Dashboard: Sem sessão API e sem localStorage válido. Redirecionando...');
            window.location.replace('/');
            return;
        }
    } else {
        // Sessão API OK
        console.log('TI Dashboard: Sessão validada via API para', sessao.usuario.nome);
        const nomeUsuario = sessao.usuario.nome;
        const userEl = document.getElementById('user-name');
        if (userEl) userEl.innerText = nomeUsuario;
        const userFullEl = document.getElementById('user-name-full');
        if (userFullEl) userFullEl.innerText = nomeUsuario;
        
        // Iniciais do Avatar
        const iniciais = nomeUsuario.charAt(0).toUpperCase();
        const avatarTrigger = document.getElementById('ti-avatar-trigger');
        if (avatarTrigger) avatarTrigger.innerText = iniciais;
        const avatarLarge = document.getElementById('ti-avatar-large');
        if (avatarLarge) avatarLarge.innerText = iniciais;

        const statusEl = document.getElementById('backend-status');
        if (statusEl) {
            statusEl.innerText = 'Online';
            statusEl.style.background = '#10b981';
        }
    }

    // Inicializar dados
    updateTime();
    setInterval(updateTime, 1000);
    
    loadStats();
    setInterval(loadStats, 10000); // 10s real-time simulation

    loadFlaskLogs();
    setInterval(loadFlaskLogs, 2000); // 2s live terminal feed

    loadTableList();
    initCharts();

    // Configurar toggle interativo do dropdown de perfil (Suporte TI)
    const dropdownContainer = document.querySelector('.profile-dropdown-container');
    if (dropdownContainer) {
        const trigger = dropdownContainer.querySelector('.user-profile');
        if (trigger) {
            trigger.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdownContainer.classList.toggle('show');
            });
        }
        // Fechar ao clicar fora
        document.addEventListener('click', function() {
            dropdownContainer.classList.remove('show');
        });
        // Evitar fechar se clicar dentro do menu, a não ser que seja um link ou botão
        const menu = dropdownContainer.querySelector('.profile-dropdown-menu');
        if (menu) {
            menu.addEventListener('click', function(e) {
                if (!e.target.closest('a') && !e.target.closest('button')) {
                    e.stopPropagation();
                }
            });
        }
    }
}

// Inicialização robusta
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTI);
} else {
    initTI();
}

function updateTime() {
    const now = new Date();
    document.getElementById('system-time').innerText = now.toLocaleString('pt-BR');
}

// ── TERMINAL LIVE (FLASK LOGS) ─────────────────────────────────
async function loadFlaskLogs() {
    const logs = await API.tiLogs();
    const terminal = document.getElementById('flask-logs');
    if (!terminal) return;

    if (!logs || logs.length === 0) {
        terminal.innerHTML = "Aguardando eventos do Backend...";
        return;
    }

    // Identifica se o usuário já subiu o scroll para cima (não força scrollbar)
    const isScrolledToBottom = terminal.scrollHeight - terminal.clientHeight <= terminal.scrollTop + 50;

    let html = '';
    logs.forEach(log => {
        // Colorir códigos HTTP comuns para dar cara de painel real
        let color = "#a5b4fc";
        if (log.includes(" 200 ")) color = "#86efac";
        else if (log.includes(" 401 ") || log.includes(" 403 ")) color = "#fca5a5";
        else if (log.includes(" 500 ")) color = "#ef4444";
        else if (log.includes(" GET ") || log.includes(" POST ")) color = "#93c5fd";

        html += `<div style="color: ${color}; white-space: pre-wrap;">${log.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
    });
    
    terminal.innerHTML = html;

    // Forçar rolagem automática apenas se já estava no fim
    if (isScrolledToBottom) {
        terminal.scrollTop = terminal.scrollHeight;
    }
}

// ── NAVEGAÇÃO ──────────────────────────────────────────────────
function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');

    if (id === 'tickets') loadTickets();
    if (id === 'infrastructure') loadInfrastructure();
}

// ── MÉTRICAS ───────────────────────────────────────────────────
async function loadStats() {
    const stats = await API.tiStats();
    if (!stats) return;

    document.getElementById('stat-cpu').innerText = stats.cpu.toFixed(1) + '%';
    document.getElementById('stat-memory').innerText = stats.memory.toFixed(1) + '%';
    document.getElementById('stat-uptime').innerText = stats.uptime;
    
    const cpuStatus = document.getElementById('cpu-status');
    if (stats.cpu > 80) {
        cpuStatus.innerText = 'Carga Alta';
        cpuStatus.className = 'negative';
    } else {
        cpuStatus.innerText = 'Operacional';
        cpuStatus.className = 'positive';
    }

    updatePerformanceChart(stats.cpu, stats.memory);
}

// ── BANCO DE DADOS ─────────────────────────────────────────────
async function loadTableList() {
    console.log('TI Dashboard: Carregando lista de tabelas...');
    const tables = await API.tiTables();
    console.log('TI Dashboard: Tabelas recebidas:', tables);
    const select = document.getElementById('table-select');
    if (!tables || !Array.isArray(tables)) {
        console.error('TI Dashboard: Falha ao carregar tabelas ou formato inválido:', tables);
        return;
    }

    tables.sort().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.innerText = t;
        select.appendChild(opt);
    });
}

let currentTableData = [];
let tableColumns = [];
let primaryKeyCol = null;

async function loadTableData() {
    const tableName = document.getElementById('table-select').value;
    if (!tableName) {
        document.getElementById('btn-add-db').style.display = 'none';
        return;
    }
    document.getElementById('btn-add-db').style.display = 'block';

    const thead = document.getElementById('db-thead');
    const tbody = document.getElementById('db-tbody');
    thead.innerHTML = '<tr><th>Carregando...</th></tr>';
    tbody.innerHTML = '';

    // Pegar estrutura primeiro
    const columns = await API.tiTableStructure(tableName);
    if (!columns) return;
    tableColumns = columns;
    
    // Identificar PK
    const pk = columns.find(c => c.pk === 1);
    primaryKeyCol = pk ? pk.name : null;

    let headHtml = '<tr>';
    columns.forEach(col => {
        headHtml += `<th>${col.name} ${col.pk ? '<i class=\"fi fi-rr-key\"></i> ' : ''}<br><small style="color:#94a3b8">${col.type}</small></th>`;
    });
    headHtml += '<th>Ações</th>';
    headHtml += '</tr>';
    thead.innerHTML = headHtml;

    // Pegar dados
    const data = await API.tiTableData(tableName);
    if (!data) return;
    currentTableData = data;

    data.forEach((row, index) => {
        let rowHtml = '<tr>';
        columns.forEach(col => {
            const val = row[col.name];
            rowHtml += `<td>${val === null ? '<em>null</em>' : val}</td>`;
        });
        rowHtml += `<td class="actions-cell">
            <button class="btn-edit" onclick="openDbModal(${index})"><i class="fas fa-edit"></i></button>
            <button class="btn-danger" onclick="deleteDbRow(${index})"><i class="fas fa-trash"></i></button>
        </td>`;
        rowHtml += '</tr>';
        tbody.insertAdjacentHTML('beforeend', rowHtml);
    });
}

// ── CRUD MODAL ────────────────────────────────────────────────
let editingIndex = -1; // -1 = novo

function openDbModal(index = -1) {
    editingIndex = index;
    const modal = document.getElementById('db-modal');
    const title = document.getElementById('db-modal-title');
    const fieldsContainer = document.getElementById('db-form-fields');
    fieldsContainer.innerHTML = '';

    const row = index >= 0 ? currentTableData[index] : {};
    title.innerText = index >= 0 ? 'Editar Registro' : 'Novo Registro';

    tableColumns.forEach(col => {
        const isPk = col.pk === 1;
        // Não mostrar PK no form se for autoincrement (comum no SQLite)
        if (isPk && index === -1) return;

        const field = `
            <div class="form-group">
                <label>${col.name} ${isPk ? '(ID - Somente Leitura)' : ''}</label>
                <input type="text" name="${col.name}" value="${row[col.name] || ''}" ${isPk ? 'readonly' : ''}>
            </div>
        `;
        fieldsContainer.insertAdjacentHTML('beforeend', field);
    });

    modal.classList.add('active');
}

function closeDbModal() {
    document.getElementById('db-modal').classList.remove('active');
}

async function saveDbRow() {
    const tableName = document.getElementById('table-select').value;
    const formData = new FormData(document.getElementById('db-form'));
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    let resp;
    if (editingIndex >= 0) {
        // Update
        const pkVal = currentTableData[editingIndex][primaryKeyCol];
        resp = await API.tiUpdateRow(tableName, primaryKeyCol, pkVal, data);
    } else {
        // Create
        resp = await API.tiAddRow(tableName, data);
    }

    if (resp && resp.sucesso) {
        alert('Salvo com sucesso!');
        closeDbModal();
        loadTableData();
    } else {
        alert('Erro ao salvar: ' + (resp ? resp.erro : 'Servidor Offline'));
    }
}

async function deleteDbRow(index) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;

    const tableName = document.getElementById('table-select').value;
    const pkVal = currentTableData[index][primaryKeyCol];
    
    const resp = await API.tiDeleteRow(tableName, primaryKeyCol, pkVal);
    if (resp && resp.sucesso) {
        alert('Excluído com sucesso!');
        loadTableData();
    } else {
        alert('Erro ao excluir: ' + (resp ? resp.erro : 'Servidor Offline'));
    }
}

// ── CHAMADOS ───────────────────────────────────────────────────
async function loadTickets() {
    const tickets = await API.tiTickets();
    const list = document.getElementById('ticket-list-body');
    list.innerHTML = '';

    if (!tickets || tickets.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding:2rem; color:#94a3b8">Nenhum chamado aberto.</p>';
        return;
    }

    tickets.forEach(t => {
        const item = `
            <div class="ticket-item" style="border-left-color: ${t.prioridade === 'Crítica' ? '#ef4444' : '#3b82f6'}">
                <div class="ticket-info">
                    <h4>${t.titulo}</h4>
                    <p>Relatado por: ${t.usuario_nome || 'Sistema'} • ${new Date(t.criado_em).toLocaleString()}</p>
                    <small>${t.descricao}</small>
                </div>
                <div class="ticket-actions">
                    <span class="status-badge badge-open">${t.status}</span>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', item);
    });
}

// ── INFRAESTRUTURA ─────────────────────────────────────────────
function loadInfrastructure() {
    const grid = document.getElementById('server-status-list');
    const servers = [
        {name: 'Servidor Principal (Flask)', status: 'Online', ip: '192.168.1.10', load: '12%'},
        {name: 'Banco de Dados (SQLite)', status: 'Online', ip: 'Local', load: '5%'},
        {name: 'API Gateway', status: 'Online', ip: '192.168.1.11', load: '24%'},
        {name: 'Servidor de Mídia', status: 'Online', ip: '192.168.1.15', load: '8%'}
    ];

    grid.innerHTML = servers.map(s => `
        <div class="kpi-card">
            <div class="kpi-icon ${s.status === 'Online' ? 'green' : 'red'}"><i class="fas fa-server"></i></div>
            <div class="kpi-data" style="flex:1">
                <span class="kpi-label">${s.ip}</span>
                <h4>${s.name}</h4>
                <div style="display:flex; justify-content:space-between; margin-top:10px">
                    <span class="positive">${s.status}</span>
                    <span style="color:var(--ti-text-muted)">Carga: ${s.load}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ── GRÁFICOS (CHART.JS) ────────────────────────────────────────
let perfChart;
function initCharts() {
    const ctxPerf = document.getElementById('performanceChart').getContext('2d');
    perfChart = new Chart(ctxPerf, {
        type: 'line',
        data: {
            labels: Array(10).fill(''),
            datasets: [
                {
                    label: 'CPU (%)',
                    data: Array(10).fill(0),
                    borderColor: '#3b82f6',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)'
                },
                {
                    label: 'Memória (%)',
                    data: Array(10).fill(0),
                    borderColor: '#10b981',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { min: 0, max: 100, grid: { color: '#334155' } }, x: { grid: { display: false } } },
            plugins: { legend: { labels: { color: '#f1f5f9' } } }
        }
    });

    const ctxCap = document.getElementById('capacityChart').getContext('2d');
    new Chart(ctxCap, {
        type: 'doughnut',
        data: {
            labels: ['Usado', 'Livre'],
            datasets: [{
                data: [65, 35],
                backgroundColor: ['#3b82f6', '#1e293b'],
                borderWidth: 0
            }]
        },
        options: {
            plugins: { legend: { position: 'bottom', labels: { color: '#f1f5f9' } } }
        }
    });
}

function updatePerformanceChart(cpu, mem) {
    if (!perfChart) return;
    perfChart.data.datasets[0].data.shift();
    perfChart.data.datasets[0].data.push(cpu);
    perfChart.data.datasets[1].data.shift();
    perfChart.data.datasets[1].data.push(mem);
    perfChart.update('none');
}

async function executeSystemAction(action) {
    const titles = {
        'init-db': 'Reinicializar Banco',
        'seed-users': 'Gerar Massa de Teste',
        'cleanup-cpfs': 'Corrigir Erros de CPF'
    };

    const result = await Swal.fire({
        title: titles[action],
        text: "Tem certeza que deseja executar esta ação de sistema? Isso pode alterar dados permanentemente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sim, Executar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        Swal.fire({
            title: 'Processando...',
            text: 'Aguarde enquanto o servidor executa a tarefa.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            let resp;
            if (action === 'init-db') resp = await API.tiSystemInitDb();
            if (action === 'seed-users') resp = await API.tiSystemSeedUsers();
            if (action === 'cleanup-cpfs') resp = await API.tiSystemCleanupCpfs();

            if (resp && resp.sucesso) {
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: resp.msg || 'Ação concluída com êxito.',
                    timer: 3000
                });
                loadFlaskLogs();
            } else {
                throw new Error(resp ? resp.erro : 'Erro na resposta do servidor');
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Falha na Execução',
                text: error.message
            });
        }
    }
}

function logout() {
    console.log('TI Dashboard: Realizando logout...');
    API.logout().finally(() => {
        // Limpar tudo do localStorage (sessão e fallback)
        localStorage.removeItem('usuarioLogado');
        localStorage.removeItem('usuarioNome');
        localStorage.removeItem('tipoUsuario');
        localStorage.removeItem('tiLogado');
        localStorage.removeItem('usuarioId');
        localStorage.removeItem('usuarioCpf');
        
        console.log('TI Dashboard: Sessão local encerrada. Redirecionando...');
        window.location.href = 'index.html';
    });
}
