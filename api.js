/**
 * API Helper — Funções para comunicação com o backend Flask
 * Todas as chamadas apontam para o backend Flask em http://127.0.0.1:5001/api/
 */

function resolveApiBase() {
    if (window.API_BASE_OVERRIDE) {
        return String(window.API_BASE_OVERRIDE).replace(/\/$/, '');
    }

    const { protocol, hostname, port, origin } = window.location;

    // Em arquivo local ou no Live Server, apontamos sempre para o Flask.
    if (protocol === 'file:') {
        return 'http://127.0.0.1:5001';
    }

    // Se já estamos no próprio backend Flask, usamos same-origin.
    if ((hostname === '127.0.0.1' || hostname === 'localhost') && port === '5001') {
        return '';
    }

    // Qualquer outro host/porta local usa o backend do Flask.
    if (hostname === '127.0.0.1' || hostname === 'localhost') {
        return 'http://127.0.0.1:5001';
    }

    // Produção/ambientes com proxy reverso podem manter same-origin.
    return origin;
}

const API_BASE = resolveApiBase();

async function apiCall(endpoint, method = 'GET', body = null) {
    const timeoutMs = 8000;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timeoutId = null;

    const opts = {
        method,
        headers: {
            // Fallback de Autenticação (para quando o navegador bloqueia cookies de sessão em localhost)
            'X-User-Type': localStorage.getItem('tipoUsuario') || '',
            'X-User-Id': localStorage.getItem('usuarioId') || '',
            'X-User-Nome': localStorage.getItem('usuarioNome') || ''
        },
        credentials: 'include'  // envia cookies de sessão (principal)
    };

    if (controller) {
        opts.signal = controller.signal;
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    if (body) {
        if (body instanceof FormData) {
            // Se for FormData, o fetch decide o Content-Type (para colocar o boundary correto)
            opts.body = body;
        } else {
            // Default: JSON
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
    }

    try {
        let url = API_BASE + endpoint;
        if (method === 'GET') {
            const sep = url.includes('?') ? '&' : '?';
            url += `${sep}_=${Date.now()}`;
        }
        const resp = await fetch(url, opts);
        
        // Verifica se a resposta é JSON antes de parsear
        const contentType = resp.headers.get('content-type');
        let data = {};
        
        if (contentType && contentType.includes('application/json')) {
            data = await resp.json();
        } else {
            const text = await resp.text();
            console.warn(`Resposta não-JSON recebida de ${endpoint}:`, text.substring(0, 100));
            data = { erro: `Resposta inválida do servidor (${resp.status})`, texto: text };
        }

        if (!resp.ok) {
            console.error(`ERRO API ${method} ${endpoint}:`, data);
        }
        data._status = resp.status;
        return data;
    } catch (err) {
        const isAbort = err && (err.name === 'AbortError' || /aborted/i.test(err.message || ''));
        console.error(`FALHA CRÍTICA na chamada API ${method} ${endpoint}:`, err);
        console.error(`Certifique-se que o Flask está rodando em ${API_BASE || window.location.origin}`);
        return {
            erro: isAbort ? 'Tempo limite excedido ao conectar com o servidor.' : 'Falha na conexão com o servidor.',
            detalhe: err.message
        };
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

// ── Atalhos ──────────────────────────────────────────────────────
const API = {
    // Auth
    login: (cpf, senha) => apiCall('/api/login', 'POST', { cpf, senha }),
    cadastro: (dados) => apiCall('/api/cadastro', 'POST', dados),
    sessao: () => apiCall('/api/sessao'),
    logout: () => apiCall('/api/logout', 'POST'),

    // Paciente
    perfil: () => apiCall('/api/paciente/perfil'),
    historico: () => apiCall('/api/paciente/historico'),
    minhasVacinas: () => apiCall('/api/paciente/vacinas'),
    meusAtestados: () => apiCall('/api/paciente/atestados'),
    minhasReceitas: () => apiCall('/api/paciente/receitas'),
    medicacoesHistorico: () => apiCall('/api/paciente/medicacoes'),
    resumoSaudePaciente: () => apiCall('/api/paciente/resumo-saude'),
    listarDoencas: (cpf) => apiCall(`/api/paciente/doencas?cpf=${cpf || ''}`),
    adicionarDoenca: (paciente_id, nome) => apiCall('/api/paciente/doencas', 'POST', { paciente_id, nome }),
    removerDoenca: (id) => apiCall(`/api/paciente/doencas/${id}`, 'DELETE'),

    // Médico
    agendaMedico: () => apiCall('/api/medico/agenda'),
    resumoMedico: () => apiCall('/api/medico/resumo'),
    buscarPacienteMed: (cpf) => apiCall(`/api/medico/buscar-paciente?cpf=${cpf}`),
    proximoFila: () => apiCall('/api/medico/proximo_fila', 'POST'),
    salvarAtendimento: (dados) => apiCall('/api/medico/atendimento', 'POST', dados),
    gerarAtestado: (dados) => apiCall('/api/medico/atestado', 'POST', dados),
    prescreverEnfermagem: (dados) => apiCall('/api/medico/prescrever', 'POST', dados),
    listarMedicos: (esp) => apiCall(`/api/medicos?especialidade=${esp || ''}`),
    listarEspecialidades: () => apiCall('/api/especialidades'),
    atualizarPresencaMedico: (status) => apiCall('/api/medico/presenca', 'POST', { presencial_ativo: status }),
    atualizarAtendimentoAmanha: (status) => apiCall('/api/medico/presenca-amanha', 'POST', { atende_amanha: status }),
    checkinPresencialConsulta: (id) => apiCall(`/api/consultas/${id}/checkin-presencial`, 'POST'),
    confirmarConsultaPaciente: (id) => apiCall(`/api/consultas/${id}/confirmar-paciente`, 'POST'),
    confirmarPresencaAmanha: (id, confirmado) => apiCall(`/api/consultas/${id}/confirmar-presenca`, 'POST', { confirmado: confirmado }),

    // Enfermeiro
    buscarPacienteEnf: (cpf) => apiCall(`/api/enfermeiro/buscar-paciente?cpf=${cpf}`),
    salvarTriagem: (dados) => apiCall('/api/enfermeiro/triagem', 'POST', dados),
    registrarVacina: (dados) => apiCall('/api/enfermeiro/vacina', 'POST', dados),
    editarVacina: (id, dados) => apiCall(`/api/enfermeiro/vacina/${id}`, 'PUT', dados),
    removerVacina: (id) => apiCall(`/api/enfermeiro/vacina/${id}`, 'DELETE'),
    triagensDoP: (cpf) => apiCall(`/api/enfermeiro/triagens?cpf=${cpf}`),
    listarTriagensPaciente: (cpf) => apiCall(`/api/enfermeiro/triagens?cpf=${cpf}`),
    vacinasDoP: (cpf) => apiCall(`/api/enfermeiro/vacinas-paciente?cpf=${cpf}`),
    listarMedicosEnf: () => apiCall('/api/enfermeiro/medicos'),
    resumoEnf: () => apiCall('/api/enfermeiro/resumo'),
    prescricoesPendentes: () => apiCall('/api/enfermeiro/prescricoes-pendentes'),
    aplicarPrescricao: (dados) => apiCall('/api/enfermeiro/aplicar-prescricao', 'POST', dados),
    atendimentosHoje: () => apiCall('/api/enfermeiro/atendimentos-hoje'),

    // Consultas
    agendar: (dados) => apiCall('/api/consultas/agendar', 'POST', dados),
    minhasConsultas: () => apiCall('/api/consultas/minhas'),
    cancelarConsulta: (id) => apiCall(`/api/consultas/${id}/cancelar`, 'PUT'),

    // Chat
    enviarMsg: (consulta_id, mensagem) => apiCall('/api/chat/enviar', 'POST', { consulta_id, mensagem }),
    listarMsgs: (consulta_id) => apiCall(`/api/chat/${consulta_id}`),

    noticiasPublic: () => apiCall('/api/public/noticias'),
    noticias: () => apiCall('/api/admin/noticias'),
    registrarCliqueNoticia: (id) => apiCall(`/api/admin/noticias/${id}/clique`, 'POST'),
    listarComentariosNoticia: (id) => apiCall(`/api/admin/noticias/${id}/comentarios`),
    enviarComentario: (id, dados) => apiCall(`/api/admin/noticias/${id}/comentarios`, 'POST', dados),
    criarNoticia: (dados) => apiCall('/api/admin/noticias', 'POST', dados),
    editarNoticia: (id, dados) => apiCall(`/api/admin/noticias/${id}`, 'PUT', dados),
    deletarNoticia: (id) => apiCall(`/api/admin/noticias/${id}`, 'DELETE'),

    carrosselPublic: () => apiCall('/api/public/carrossel'),
    carrossel: () => apiCall('/api/admin/carrossel'),
    criarSlide: (dados) => apiCall('/api/admin/carrossel', 'POST', dados),
    editarSlide: (id, dados) => apiCall(`/api/admin/carrossel/${id}`, 'PUT', dados),
    deletarSlide: (id) => apiCall(`/api/admin/carrossel/${id}`, 'DELETE'),
    statsPublic: () => apiCall('/api/public/estatisticas'),
    stats: () => apiCall('/api/admin/stats'),
    salvarStats: (lista) => apiCall('/api/admin/stats', 'POST', lista),
    logs: () => apiCall('/api/admin/logs'),
    criarLog: (acao) => apiCall('/api/admin/logs', 'POST', { acao }),
    limparLogs: () => apiCall('/api/admin/logs', 'DELETE'),
    dashboard: () => apiCall('/api/admin/resumo'),
    
    // Configurações do Sistema e Acessos Google Analytics
    settingsPublic: () => apiCall('/api/public/settings'),
    settings: () => apiCall('/api/admin/settings'),
    salvarSettings: (dados) => apiCall('/api/admin/settings', 'POST', dados),
    acessosSemana: () => apiCall('/api/admin/acessos-semana'),

    // Campanhas e Comentários (Admin e Publico)
    campanhasPublic: () => apiCall('/api/public/campanhas'),
    campanhas: () => apiCall('/api/admin/campanhas'),
    criarCampanha: (dados) => apiCall('/api/admin/campanhas', 'POST', dados),
    editarCampanha: (id, dados) => apiCall(`/api/admin/campanhas/${id}`, 'PUT', dados),
    deletarCampanha: (id) => apiCall(`/api/admin/campanhas/${id}`, 'DELETE'),
    comentariosAdmin: () => apiCall('/api/admin/comentarios'),
    aprovarComentario: (id, status) => apiCall(`/api/admin/comentarios/${id}`, 'PUT', { status }),
    deletarComentario: (id) => apiCall(`/api/admin/comentarios/${id}`, 'DELETE'),

    // Notificações
    notificacoes: () => apiCall('/api/notificacoes'),
    lerNotificacao: (id) => apiCall(`/api/notificacoes/${id}/ler`, 'PUT'),

    // Admin - Gestão de Notificações
    usuariosAdmin: () => apiCall('/api/admin/usuarios'),
    notificacoesAdmin: () => apiCall('/api/admin/notificacoes'),
    enviarNotificacaoAdmin: (dados) => apiCall('/api/admin/notificacoes', 'POST', dados),
    deletarNotificacaoAdmin: (id) => apiCall(`/api/admin/notificacoes/${id}`, 'DELETE'),

    // ── MAPA DE DOENÇAS 3D ───────────────────────────────────────
    doencasPublic: () => apiCall('/api/public/doencas'),
    adminDoencas: (metodo = 'GET', dados = null, id = null) => {
        const url = id ? `/api/admin/doencas/${id}` : '/api/admin/doencas';
        return apiCall(url, metodo, dados);
    },

    // --- Integração TOTVS Framework v1 - Recuperação de Senha ---
    // POST /api/framework/v1/users/{userId ou Email}/recoveryPassword
    totvsRecoveryPassword: async (identificador) => {
        try {
            // ==============================================
            // INTEGRAÇÃO EMAILJS PARA ENVIAR O E-MAIL REAL
            // ==============================================
            // Como configurar: 
            // 1. Crie uma conta no emailjs.com
            // 2. Conecte seu Gmail (anote o Service ID)
            // 3. Crie um Template de Email (anote o Template ID)
            // No template de email, configure o conteúdo para: 
            // "O seu token de recuperação é: {{token}}" e envie para {{to_email}}

            const EMAILJS_PUBLIC_KEY = 'SNKwwL-vpIPxWE9TK'; // Sua chave principal
            const EMAILJS_SERVICE_ID = 'service_mxnzg8e'; // <--- VOCÊ PRECISA MUDAR ISSO AQUI
            const EMAILJS_TEMPLATE_ID = 'template_lpu42yd'; // <--- VOCÊ PRECISA MUDAR ISSO AQUI

            // Gera um Token Aleatório de 6 dígitos para teste no lugar da TOTVS real
            const tokenFalsoDeTeste = Math.floor(100000 + Math.random() * 900000).toString();

            const payload = {
                service_id: EMAILJS_SERVICE_ID,
                template_id: EMAILJS_TEMPLATE_ID,
                user_id: EMAILJS_PUBLIC_KEY,
                template_params: {
                    email: identificador, // O template do usuário pede "email" e não "to_email"
                    link: tokenFalsoDeTeste, // O template do usuário pede "link"
                    reply_to: 'suporte@saudefacil.com'
                }
            };

            const resp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const errorText = await resp.text();
                console.error("EmailJS Error Response:", errorText);
                return { sucesso: false, status: resp.status, erro: errorText };
            }

            // O Email JS não retorna JSON no sucesso, retorna apenas 'OK'
            const data = { simulated_token: tokenFalsoDeTeste };

            return { sucesso: true, status: resp.status, data };
        } catch (err) {
            console.error('EmailJS API Erro (Recovery):', err);
            return { sucesso: false, erro: 'Falha na conexão com o servidor de E-mail.' };
        }
    },

    // POST /api/framework/v1/users/{userId ou Email}/changePasswordWithToken
    totvsChangePasswordWithToken: async (identificador, token, novaSenha) => {
        try {
            const body = {
                lastPassword: token,
                newPassword: novaSenha,
                confirmationPassword: novaSenha
            };
            const resp = await fetch(`http://localhost:8051/api/framework/v1/users/${encodeURIComponent(identificador)}/changePasswordWithToken`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return { sucesso: resp.ok || resp.status === 200, status: resp.status };
        } catch (err) {
            console.error('TOTVS API Erro (Change With Token):', err);
            return { sucesso: false, erro: 'Falha na conexão com o servidor TOTVS.' };
        }
    },

    // POST /api/framework/v1/users/{userId ou Email}/changePassword
    totvsChangePassword: async (identificador, senhaAntiga, novaSenha) => {
        try {
            const body = {
                lastPassword: senhaAntiga,
                newPassword: novaSenha,
                confirmationPassword: novaSenha
            };
            const resp = await fetch(`http://localhost:8051/api/framework/v1/users/${identificador}/changePassword`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return { sucesso: resp.ok || resp.status === 200, status: resp.status };
        } catch (err) {
            console.error('TOTVS API Erro (Change Pwd):', err);
            return { sucesso: false, erro: 'Falha na conexão com o servidor TOTVS.' };
        }
    },

    // Telemedicina
    teleConsultas: () => apiCall('/api/telemedicina/consultas'),
    teleStatus: (consulta_id, status) => apiCall('/api/telemedicina/status', 'POST', { consulta_id, status }),
    teleGerarDoc: (dados) => apiCall('/api/telemedicina/gerar-documento', 'POST', dados),
    teleConfigPerfil: (dados) => apiCall('/api/telemedicina/config-perfil', 'POST', dados),
    teleMeusDocumentos: () => apiCall('/api/telemedicina/meus-documentos'),
    listarMedicos: (esp) => apiCall(`/api/medicos?especialidade=${esp || ''}`),
    agendar: (dados) => apiCall('/api/consultas/agendar', 'POST', dados),
    teleStats: () => apiCall('/api/telemedicina/estatisticas'),
    pacienteRegistroTelemedicina: () => apiCall('/api/telemedicina/paciente/registro', 'POST'),

    // TI Panel
    tiStats: () => apiCall('/api/ti/stats'),
    tiLogs: () => apiCall('/api/ti/logs'),
    tiTables: () => apiCall('/api/ti/db/tables'),
    tiTableStructure: (table) => apiCall(`/api/ti/db/structure/${table}`),
    tiTableData: (table, limit = 100) => apiCall(`/api/ti/db/data/${table}?limit=${limit}`),
    tiAddRow: (table, dados) => apiCall(`/api/ti/db/data/${table}`, 'POST', dados),
    tiUpdateRow: (table, pkCol, pkVal, dados) => apiCall(`/api/ti/db/data/${table}/${pkCol}/${pkVal}`, 'PUT', dados),
    tiDeleteRow: (table, pkCol, pkVal) => apiCall(`/api/ti/db/data/${table}/${pkCol}/${pkVal}`, 'DELETE'),
    tiTickets: () => apiCall('/api/ti/tickets'),
    tiCreateTicket: (dados) => apiCall('/api/ti/tickets', 'POST', dados),
    tiSystemInitDb: () => apiCall('/api/ti/system/init-db', 'POST'),
    tiSystemSeedUsers: () => apiCall('/api/ti/system/seed-users', 'POST'),
    tiSystemCleanupCpfs: () => apiCall('/api/ti/system/cleanup-cpfs', 'POST')
};

// ==========================================================================
// HEALTH LOADER (ANIMAÇÃO GLOBAL DE CARREGAMENTO)
// Pode ser chamado em qualquer tela importando api.js
// ==========================================================================

function initHealthLoader() {
    if (document.getElementById('health-loader-overlay')) return;

    const loaderHTML = `
        <div id="health-loader-overlay">
            <div class="health-loader-container">
                <div class="health-heart">
                    <div class="health-cross"></div>
                </div>
            </div>
            <div class="health-loader-text" id="health-loader-msg">Carregando<span>.</span></div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loaderHTML);
}

window.showHealthLoader = function (mensagem = 'Aguarde') {
    initHealthLoader();
    const overlay = document.getElementById('health-loader-overlay');
    const msgEl = document.getElementById('health-loader-msg');

    if (msgEl) msgEl.innerHTML = mensagem + '<span>.</span>';
    if (overlay) overlay.classList.add('show');
};

window.hideHealthLoader = function () {
    const overlay = document.getElementById('health-loader-overlay');
    if (overlay) overlay.classList.remove('show');
};

// ==========================================================================
// MODAL EDIÇÃO DE PERFIL (GLOBAL)
// ==========================================================================
function injetarModalEdicaoPerfil() {
    if (document.getElementById('modalEditarPerfil')) return;

    const modalHTML = `
    <div id="modalEditarPerfil" class="modal-wrapper" style="display: none; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.6); position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2000; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); transition: all 0.3s ease;">
        <div class="modal-auth-card" style="display: flex !important; flex-direction: column !important; align-items: stretch !important; padding: 0 !important; background: white; width: 92%; max-width: 460px; border-radius: 24px; overflow: hidden; position: relative; border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); animation: modalPulse 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">
            
            <!-- CABEÇALHO DO MODAL -->
            <div style="width: 100%; background: linear-gradient(135deg, #0284c7, #0369a1); color: white; padding: 25px 30px; text-align: left; position: relative;">
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 10px; letter-spacing: -0.5px;">
                    <i class="fi fi-rr-edit" style="font-size: 1.35rem; color: #e0f2fe;"></i> Editar Dados Pessoais
                </h3>
                <p style="margin: 5px 0 0 0; font-size: 0.72rem; color: rgba(224, 242, 254, 0.8); font-weight: 500;">Mantenha suas informações sempre atualizadas no portal</p>
                <button type="button" onclick="fecharModalEditarPerfil()" style="position: absolute; top: 22px; right: 22px; width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 255, 255, 0.15); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; line-height: 1; transition: all 0.2s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.25)'; this.style.transform='rotate(90deg)';" onmouseout="this.style.background='rgba(255, 255, 255, 0.15)'; this.style.transform='none';">&times;</button>
            </div>
            
            <!-- CORPO DO MODAL -->
            <div style="width: 100%; padding: 25px 30px 30px 30px; text-align: left;">
                <form id="formEditarPerfil" onsubmit="salvarEdicaoPerfil(event)">
                    
                    <!-- CPF (Somente Leitura) -->
                    <div class="input-group" style="margin-bottom: 18px;">
                        <label style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">CPF (Não alterável)</label>
                        <input type="text" id="edit-perfil-cpf" readonly style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #cbd5e1; background: #f1f5f9; color: #94a3b8; font-size: 0.9rem; cursor: not-allowed; font-weight: 500;">
                    </div>
                    
                    <!-- Nome Completo -->
                    <div class="input-group" style="margin-bottom: 18px;">
                        <label style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">Nome Completo</label>
                        <input type="text" id="edit-perfil-nome" required style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-size: 0.9rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; font-weight: 500;" onfocus="this.style.borderColor='#0284c7'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(2, 132, 199, 0.12)';" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'; this.style.boxShadow='none';">
                    </div>
                    
                    <!-- Data de Nascimento -->
                    <div class="input-group" style="margin-bottom: 18px;">
                        <label style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">Data de Nascimento</label>
                        <input type="date" id="edit-perfil-nasc" style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-size: 0.9rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; font-weight: 500;" onfocus="this.style.borderColor='#0284c7'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(2, 132, 199, 0.12)';" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'; this.style.boxShadow='none';">
                    </div>
                    
                    <!-- Cartão SUS -->
                    <div class="input-group" style="margin-bottom: 18px;">
                        <label style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">Número do Cartão SUS</label>
                        <input type="text" id="edit-perfil-sus" placeholder="Se não possuir, deixe em branco" style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-size: 0.9rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; font-weight: 500;" onfocus="this.style.borderColor='#0284c7'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(2, 132, 199, 0.12)';" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'; this.style.boxShadow='none';">
                    </div>
                    
                    <!-- Senha -->
                    <div class="input-group" style="margin-bottom: 24px;">
                        <label style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">Nova Senha (Opcional)</label>
                        <input type="password" id="edit-perfil-senha" placeholder="Deixe em branco para manter a atual" style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-size: 0.9rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; font-weight: 500;" onfocus="this.style.borderColor='#0284c7'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(2, 132, 199, 0.12)';" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'; this.style.boxShadow='none';">
                    </div>
                    
                    <!-- BOTÕES -->
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="button" onclick="fecharModalEditarPerfil()" style="flex: 1; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.2); color: #ef4444; padding: 14px; border-radius: 12px; font-weight: 600; font-size: 0.92rem; cursor: pointer; transition: all 0.3s ease; display: inline-flex; align-items: center; justify-content: center; gap: 6px;" onmouseover="this.style.background='#ef4444'; this.style.color='white'; this.style.boxShadow='0 8px 20px rgba(239, 68, 68, 0.15)';" onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.color='#ef4444'; this.style.boxShadow='none';">
                            Cancelar
                        </button>
                        <button type="submit" style="flex: 1; background: #0284c7; border: none; color: white; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 0.92rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: inline-flex; align-items: center; justify-content: center; gap: 6px;" onmouseover="this.style.background='#0369a1'; this.style.boxShadow='0 8px 24px rgba(2, 132, 199, 0.25)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='#0284c7'; this.style.boxShadow='none'; this.style.transform='none';" onmousedown="this.style.transform='translateY(1px)';" onmouseup="this.style.transform='translateY(-1px)';">
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <!-- Animação do surgimento do modal -->
    <style>
    @keyframes modalPulse {
        from { transform: scale(0.9) translateY(20px); opacity: 0; }
        to { transform: scale(1) translateY(0); opacity: 1; }
    }
    </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.abrirModalEditarPerfil = function(event) {
    if (event) event.preventDefault();
    injetarModalEdicaoPerfil();

    const cpf = localStorage.getItem('usuarioCpf') || '';
    const nome = localStorage.getItem('usuarioNome') || '';
    const sus = localStorage.getItem('usuarioSUS') || '';
    
    let dataNasc = '';
    const objKeys = ['adminRegistrado', 'medicoRegistrado', 'enfermeiroRegistrado', 'pacienteRegistrado']; 
    
    for (const key of objKeys) {
        const str = localStorage.getItem(key);
        if (str) {
            try {
                const obj = JSON.parse(str);
                if (obj.cpf === cpf && obj.dataNascimento) {
                    dataNasc = obj.dataNascimento;
                    break;
                }
            } catch(e) {}
        }
    }
    
    document.getElementById('edit-perfil-cpf').value = cpf;
    document.getElementById('edit-perfil-nome').value = nome;
    document.getElementById('edit-perfil-sus').value = sus;
    document.getElementById('edit-perfil-nasc').value = dataNasc;
    document.getElementById('edit-perfil-senha').value = '';

    document.getElementById('modalEditarPerfil').style.display = 'flex';
}

window.fecharModalEditarPerfil = function() {
    const modal = document.getElementById('modalEditarPerfil');
    if (modal) modal.style.display = 'none';
}

window.salvarEdicaoPerfil = function(event) {
    event.preventDefault();
    
    const novoNome = document.getElementById('edit-perfil-nome').value.trim();
    const novoSus = document.getElementById('edit-perfil-sus').value.trim();
    const novaSenha = document.getElementById('edit-perfil-senha').value.trim();
    const novoNasc = document.getElementById('edit-perfil-nasc').value;
    
    if (novoNome) localStorage.setItem('usuarioNome', novoNome);
    if (novoSus) localStorage.setItem('usuarioSUS', novoSus);
    
    const cpfAtivo = localStorage.getItem('usuarioCpf');
    const objKeys = ['adminRegistrado', 'medicoRegistrado', 'enfermeiroRegistrado', 'pacienteRegistrado'];
    
    objKeys.forEach(key => {
        let str = localStorage.getItem(key);
        if (str) {
            try {
                let obj = JSON.parse(str);
                if (obj.cpf === cpfAtivo) {
                    if (novoNome) obj.nome = novoNome;
                    if (novoSus) obj.sus = novoSus;
                    if (novoNasc) obj.dataNascimento = novoNasc;
                    if (novaSenha) obj.senha = novaSenha;
                    localStorage.setItem(key, JSON.stringify(obj));
                }
            } catch(e){}
        }
    });

    fecharModalEditarPerfil();
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Perfil Atualizado',
            text: 'Seus dados foram atualizados com sucesso!'
        }).then(() => {
            if (typeof atualizarInterfaceLogin === 'function') {
                atualizarInterfaceLogin();
            }
            const path = window.location.pathname;
            if (path.includes('medico.html') || path.includes('enfermeiro.html') || path.includes('admin.html') || path.includes('ti.html') || path.includes('painel_telemedicina.html') || path.includes('perfil.html')) {
                window.location.reload();
            }
        });
    } else {
        alert("Dados atualizados com sucesso!");
        window.location.reload();
    }
}

// ==========================================================================
// INICIALIZAÇÃO DINÂMICA DO GOOGLE ANALYTICS (TCC SUS)
// ==========================================================================
async function initGoogleAnalytics() {
    try {
        if (window.GA_INJECTED) return;
        
        const base = resolveApiBase();
        const url = (base ? base : '') + '/api/public/settings';
        
        const res = await fetch(url);
        if (!res.ok) return;
        const settings = await res.json();
        
        const gaId = settings.google_analytics_id;
        if (gaId && gaId.trim() !== '') {
            console.log(`[Google Analytics] Inicializando rastreamento com ID: ${gaId}`);
            
            // Injetar o script global do Google Analytics (gtag.js)
            const scriptTag = document.createElement('script');
            scriptTag.async = true;
            scriptTag.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
            document.head.appendChild(scriptTag);
            
            // Injetar código de configuração interno
            const configScript = document.createElement('script');
            configScript.innerHTML = `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', { 'anonymize_ip': true });
            `;
            document.head.appendChild(configScript);
            window.GA_INJECTED = true;
        }
    } catch (e) {
        console.warn("[Google Analytics] Falha ao injetar rastreamento:", e);
    }
}

// Inicializar Google Analytics na carga da página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoogleAnalytics);
} else {
    initGoogleAnalytics();
}

// ==========================================================================
// SUPORTE E CHAMADOS DE TI (MODAL GLOBAL PROFISSIONAL)
// ==========================================================================
window.abrirChamadoTI = async function(event) {
    if (event) event.preventDefault();
    if (typeof Swal === 'undefined') {
        alert("O serviço de alertas visuais (SweetAlert2) não está disponível nesta página.");
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: '<i class="fas fa-headset" style="color: #3b82f6; margin-right: 8px;"></i> Abrir Chamado para a TI',
        html: `
            <div style="text-align: left; font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif;">
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 15px;">
                    Descreva o problema ou a solicitação de suporte de TI. A equipe de infraestrutura analisará o caso em breve.
                </p>
                <div class="swal2-input-group" style="margin-bottom: 15px;">
                    <label style="font-size: 0.85rem; font-weight: 600; color: #334155; display: block; margin-bottom: 5px;">Assunto / Título do Chamado</label>
                    <input id="swal-ticket-titulo" class="swal2-input" placeholder="Ex: Impressora de receitas não responde" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 0.9rem;">
                </div>
                <div class="swal2-input-group" style="margin-bottom: 15px;">
                    <label style="font-size: 0.85rem; font-weight: 600; color: #334155; display: block; margin-bottom: 5px;">Prioridade</label>
                    <select id="swal-ticket-prioridade" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 0.9rem;">
                        <option value="Baixa">🟢 Baixa</option>
                        <option value="Média" selected>🟡 Média</option>
                        <option value="Alta">🟠 Alta</option>
                        <option value="Crítica">🔴 Crítica</option>
                    </select>
                </div>
                <div class="swal2-input-group">
                    <label style="font-size: 0.85rem; font-weight: 600; color: #334155; display: block; margin-bottom: 5px;">Descrição Detalhada do Problema</label>
                    <textarea id="swal-ticket-descricao" class="swal2-textarea" placeholder="Descreva aqui o comportamento do sistema ou o problema de hardware..." style="width: 100%; margin: 0; box-sizing: border-box; font-size: 0.9rem; height: 120px; font-family: inherit;"></textarea>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-paper-plane"></i> Enviar Chamado',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const titulo = document.getElementById('swal-ticket-titulo').value.trim();
            const descricao = document.getElementById('swal-ticket-descricao').value.trim();
            const prioridade = document.getElementById('swal-ticket-prioridade').value;

            if (!titulo) {
                Swal.showValidationMessage('Por favor, informe o assunto/título do chamado.');
                return false;
            }
            if (!descricao) {
                Swal.showValidationMessage('Por favor, faça uma descrição detalhada do problema.');
                return false;
            }

            return { titulo, descricao, prioridade };
        }
    });

    if (formValues) {
        Swal.fire({
            title: 'Enviando chamado...',
            text: 'Aguarde um momento enquanto registramos sua solicitação.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const resp = await API.tiCreateTicket(formValues);
            if (resp && resp.sucesso) {
                Swal.fire({
                    icon: 'success',
                    title: 'Chamado Aberto!',
                    text: 'A equipe de TI foi notificada e o seu chamado já está na fila de atendimento.',
                    confirmButtonColor: '#10b981'
                });
                
                // Recarregar a fila se estivermos no painel de TI
                if (typeof loadTickets === 'function') {
                    loadTickets();
                }
            } else {
                throw new Error(resp ? resp.erro : 'Erro desconhecido');
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Falha no Envio',
                text: 'Não foi possível registrar seu chamado: ' + err.message,
                confirmButtonColor: '#ef4444'
            });
        }
    }
};

// ==========================================================================
// INICIALIZAÇÃO DINÂMICA DE DROPDOWNS DE PERFIL (PAINEIS)
// ==========================================================================
function initGlobalProfileDropdown() {
    const dropdownContainer = document.querySelector('.profile-dropdown-container');
    if (dropdownContainer) {
        const trigger = dropdownContainer.querySelector('.user-profile');
        if (trigger) {
            trigger.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdownContainer.classList.toggle('show');
            });
        }
        document.addEventListener('click', function() {
            dropdownContainer.classList.remove('show');
        });
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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalProfileDropdown);
} else {
    initGlobalProfileDropdown();
}
