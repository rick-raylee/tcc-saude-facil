-- ===============================
-- USUARIOS
-- ===============================
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  sus TEXT,
  email TEXT UNIQUE,
  senha TEXT NOT NULL,
  imagem TEXT,
  tipo TEXT CHECK(tipo IN ('paciente','medico','enfermeiro','admin','ti')) DEFAULT 'paciente',
  telefone TEXT,
  cidade TEXT,
  bairro TEXT,
  data_nascimento TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- MÉDICO INFO
-- ===============================
CREATE TABLE IF NOT EXISTS medico_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER UNIQUE,
  crm TEXT,
  especialidade TEXT,
  atende_telemedicina INTEGER DEFAULT 0,
  tipo_atendimento TEXT DEFAULT 'presencial',
  bio TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ===============================
-- ENFERMEIRO INFO
-- ===============================
CREATE TABLE IF NOT EXISTS enfermeiro_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER UNIQUE,
  coren TEXT,
  funcao TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ===============================
-- DOENÇAS DO PACIENTE
-- ===============================
CREATE TABLE IF NOT EXISTS paciente_doencas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER,
  nome TEXT,
  FOREIGN KEY (paciente_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ===============================
-- CONSULTAS / AGENDAMENTOS
-- ===============================
CREATE TABLE IF NOT EXISTS consultas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER,
  medico_id INTEGER,
  especialidade TEXT,
  data TEXT,
  hora TEXT,
  tipo TEXT CHECK(tipo IN ('presencial','telemedicina')) DEFAULT 'presencial',
  status TEXT DEFAULT 'confirmada',
  link_video TEXT,
  senha_fila TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES usuarios(id),
  FOREIGN KEY (medico_id) REFERENCES usuarios(id)
);

-- ===============================
-- TRIAGENS (ENFERMAGEM)
-- ===============================
CREATE TABLE IF NOT EXISTS triagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER,
  enfermeiro_id INTEGER,
  peso REAL,
  altura REAL,
  pressao TEXT,
  freq_cardiaca TEXT,
  temperatura REAL,
  saturacao TEXT,
  queixa TEXT,
  prioridade TEXT,
  medico_destino TEXT,
  imc REAL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES usuarios(id),
  FOREIGN KEY (enfermeiro_id) REFERENCES usuarios(id)
);

-- ===============================
-- PRONTUÁRIOS
-- ===============================
CREATE TABLE IF NOT EXISTS prontuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consulta_id INTEGER,
  paciente_id INTEGER,
  medico_id INTEGER,
  queixa TEXT,
  diagnostico TEXT,
  conduta TEXT,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES usuarios(id),
  FOREIGN KEY (medico_id) REFERENCES usuarios(id)
);

-- ===============================
-- RECEITAS
-- ===============================
CREATE TABLE IF NOT EXISTS receitas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prontuario_id INTEGER,
  medicamentos TEXT,
  instrucoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id) ON DELETE CASCADE
);

-- ===============================
-- ATESTADOS
-- ===============================
CREATE TABLE IF NOT EXISTS atestados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consulta_id INTEGER,
  medico_id INTEGER,
  paciente_id INTEGER,
  dias_afastamento INTEGER DEFAULT 1,
  motivo TEXT,
  cid TEXT,
  texto TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  FOREIGN KEY (medico_id) REFERENCES usuarios(id),
  FOREIGN KEY (paciente_id) REFERENCES usuarios(id)
);

-- ===============================
-- EXAMES
-- ===============================
CREATE TABLE IF NOT EXISTS exames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER,
  consulta_id INTEGER,
  nome TEXT,
  arquivo TEXT,
  enviado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES usuarios(id),
  FOREIGN KEY (consulta_id) REFERENCES consultas(id)
);

-- ===============================
-- VACINAS APLICADAS
-- ===============================
CREATE TABLE IF NOT EXISTS vacinas_aplicadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER,
  enfermeiro_id INTEGER,
  vacina_nome TEXT,
  dose TEXT,
  lote TEXT,
  local_aplicacao TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES usuarios(id),
  FOREIGN KEY (enfermeiro_id) REFERENCES usuarios(id)
);

-- ===============================
-- CHAT (TELEMEDICINA)
-- ===============================
CREATE TABLE IF NOT EXISTS chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consulta_id INTEGER,
  remetente_id INTEGER,
  mensagem TEXT,
  enviada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  FOREIGN KEY (remetente_id) REFERENCES usuarios(id)
);

-- ===============================
-- SISTEMA CLÍNICO (PRESCRIÇÕES E APLICAÇÕES)
-- ===============================
CREATE TABLE IF NOT EXISTS prescricoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consulta_id INTEGER,
  paciente_id INTEGER NOT NULL,
  medico_id INTEGER NOT NULL,
  medicamento VARCHAR(150) NOT NULL,
  dosagem VARCHAR(100) NOT NULL,
  frequencia VARCHAR(100) NOT NULL,
  via_administracao VARCHAR(50) NOT NULL,
  duracao VARCHAR(100),
  observacoes TEXT,
  status VARCHAR(50) DEFAULT 'Aguardando Aplicação',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(consulta_id) REFERENCES consultas(id),
  FOREIGN KEY(paciente_id) REFERENCES usuarios(id),
  FOREIGN KEY(medico_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS aplicacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescricao_id INTEGER NOT NULL,
  enfermeiro_id INTEGER NOT NULL,
  data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  observacao TEXT,
  lote VARCHAR(100),
  FOREIGN KEY(prescricao_id) REFERENCES prescricoes(id),
  FOREIGN KEY(enfermeiro_id) REFERENCES usuarios(id)
);

-- ===============================
-- NOTIFICAÇÕES
-- ===============================
CREATE TABLE IF NOT EXISTS notificacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  mensagem TEXT,
  lida INTEGER DEFAULT 0,
  criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ===============================
-- NOTÍCIAS (ADMIN)
-- ===============================
CREATE TABLE IF NOT EXISTS noticias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT,
  conteudo TEXT,
  imagem TEXT,
  categoria TEXT,
  resumo TEXT,
  cliques INTEGER DEFAULT 0,
  acessos INTEGER DEFAULT 0,
  status TEXT DEFAULT 'publicado',
  destaque_carrossel INTEGER DEFAULT 0,
  prioridade INTEGER DEFAULT 0,
  criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- COMENTÁRIOS (NOTÍCIAS)
-- ===============================
CREATE TABLE IF NOT EXISTS comentarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  noticia_id INTEGER,
  nome TEXT,
  texto TEXT,
  mensagem TEXT,
  status TEXT DEFAULT 'pendente',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (noticia_id) REFERENCES noticias(id) ON DELETE CASCADE
);

-- ===============================
-- CARROSSEL (ADMIN)
-- ===============================
CREATE TABLE IF NOT EXISTS carrossel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT,
  subtitulo TEXT,
  texto TEXT,
  descricao TEXT,
  imagem TEXT,
  link TEXT,
  ativo INTEGER DEFAULT 1,
  status INTEGER DEFAULT 1,
  ordem INTEGER DEFAULT 0
);

-- ===============================
-- ESTATÍSTICAS (ADMIN)
-- ===============================
CREATE TABLE IF NOT EXISTS estatisticas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  texto TEXT,
  valor TEXT,
  valor_mapa TEXT,
  icone TEXT,
  cor TEXT,
  detalhe TEXT
);

-- ===============================
-- CAMPANHAS (ADMIN)
-- ===============================
CREATE TABLE IF NOT EXISTS campanhas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT,
  categoria TEXT,
  status TEXT,
  data_inicio TEXT,
  data_fim TEXT,
  icone TEXT,
  imagem TEXT,
  resumo TEXT,
  descricao TEXT,
  publico_alvo TEXT,
  local TEXT,
  documentos TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- DOENÇAS / PREVENÇÃO (ADMIN)
-- ===============================
CREATE TABLE IF NOT EXISTS doencas_prevencao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT,
  icone TEXT,
  o_que_e TEXT,
  tratamento TEXT,
  prevencao TEXT,
  imagem TEXT,
  cor TEXT,
  especialista TEXT,
  encaminhamento TEXT,
  gravidade TEXT,
  bg_class TEXT,
  ordem INTEGER DEFAULT 0
);

-- ===============================
-- FAQ / DÚVIDAS (ADMIN)
-- ===============================
CREATE TABLE IF NOT EXISTS faq (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pergunta TEXT,
  resposta TEXT,
  ordem INTEGER DEFAULT 0
);

-- ===============================
-- CONFIGURAÇÕES (ADMIN)
-- ===============================
CREATE TABLE IF NOT EXISTS settings (
  chave TEXT PRIMARY KEY,
  valor TEXT
);

-- Inserir valores iniciais
INSERT OR IGNORE INTO settings (chave, valor) VALUES ('portal_titulo', 'Bem-vindo ao Portal Saúde Digital');
INSERT OR IGNORE INTO settings (chave, valor) VALUES ('portal_subtitulo', 'A saúde de Cascavel ao alcance de um clique. Agendamentos, telemedicina, campanhas e muito mais.');

-- ===============================
-- LOGS (ADMIN)
-- ===============================
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  usuario TEXT,
  acao TEXT,
  ip TEXT,
  data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
