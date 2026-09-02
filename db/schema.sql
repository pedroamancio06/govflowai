-- Star Schema — GovFlow AI (docs/TECH-SPEC-MVP.md §3)
-- UUIDs são gerados pela aplicação (crypto.randomUUID()), não pelo banco —
-- evita depender da extensão pgcrypto, que nem todo ambiente (incluindo
-- PGlite local) garante disponível, e mantém o id_processamento conhecido
-- pela aplicação antes mesmo do INSERT (necessário para o stream SSE).

-- ══════════════════════════════════════════════════════════
-- DIM_TEMPO
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dim_tempo (
    id_tempo        SERIAL PRIMARY KEY,
    data_completa   DATE NOT NULL UNIQUE,
    dia             SMALLINT NOT NULL,
    mes             SMALLINT NOT NULL,
    ano             SMALLINT NOT NULL,
    trimestre       SMALLINT NOT NULL,
    dia_semana      VARCHAR(12) NOT NULL,
    is_dia_util     BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_dim_tempo_ano_mes ON dim_tempo (ano, mes);

-- ══════════════════════════════════════════════════════════
-- DIM_CLIENTE  (escritório contábil — tenant)
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dim_cliente (
    id_cliente              UUID PRIMARY KEY,
    nome_escritorio         VARCHAR(200) NOT NULL,
    cnpj_escritorio         VARCHAR(18),
    email_admin             VARCHAR(150) NOT NULL UNIQUE,
    plano_saas              VARCHAR(10) NOT NULL DEFAULT 'free'
                                 CHECK (plano_saas IN ('free', 'pro')),
    limite_documentos_mes   SMALLINT NOT NULL DEFAULT 5,
    status_assinatura       VARCHAR(15) NOT NULL DEFAULT 'ativo'
                                 CHECK (status_assinatura IN ('ativo', 'cancelado', 'inadimplente')),
    data_inicio_plano       DATE NOT NULL DEFAULT CURRENT_DATE,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════
-- DIM_CANAL
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dim_canal (
    id_canal        SERIAL PRIMARY KEY,
    nome_canal      VARCHAR(20) NOT NULL UNIQUE
                        CHECK (nome_canal IN ('whatsapp', 'webchat', 'portal_web')),
    descricao       VARCHAR(200)
);

-- ══════════════════════════════════════════════════════════
-- DIM_SERVICO_GOV
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dim_servico_gov (
    id_servico_gov                   SERIAL PRIMARY KEY,
    codigo                           VARCHAR(50) NOT NULL UNIQUE, -- chave estável p/ lookup pela aplicação
    nome_servico                     VARCHAR(100) NOT NULL,
    orgao_responsavel                VARCHAR(100) NOT NULL,
    tempo_manual_estimado_padrao_seg INTEGER NOT NULL,
    ativo                            BOOLEAN NOT NULL DEFAULT TRUE
);

-- ══════════════════════════════════════════════════════════
-- DIM_STATUS
-- ══════════════════════════════════════════════════════════
-- Correção em relação ao rascunho original da Tech Spec: nome_status sozinho
-- não pode ser UNIQUE, porque múltiplas categorias de erro (PORTAL_INDISPONIVEL,
-- CAPTCHA_DETECTADO...) precisam coexistir sob o mesmo nome_status='erro'.
-- categoria_erro passa a viver na tabela fato (é um atributo do fato, não um
-- membro de dimensão) — DIM_STATUS fica só com os 5 estados do ciclo de vida.
CREATE TABLE IF NOT EXISTS dim_status (
    id_status       SERIAL PRIMARY KEY,
    nome_status     VARCHAR(25) NOT NULL UNIQUE
                        CHECK (nome_status IN
                            ('recebido', 'processando', 'aguardando_confirmacao',
                             'pendente_revisao_humana', 'sucesso', 'erro'))
);

-- Convergência idempotente para bancos já criados antes de 'aguardando_confirmacao'
-- existir (o CREATE TABLE IF NOT EXISTS acima não altera uma tabela existente).
-- Seguro rodar em todo boot — dropar+recriar a constraint não mexe nos dados.
ALTER TABLE dim_status DROP CONSTRAINT IF EXISTS dim_status_nome_status_check;
ALTER TABLE dim_status ADD CONSTRAINT dim_status_nome_status_check
    CHECK (nome_status IN
        ('recebido', 'processando', 'aguardando_confirmacao',
         'pendente_revisao_humana', 'sucesso', 'erro'));

-- ══════════════════════════════════════════════════════════
-- FATO_PROCESSAMENTO_AUTOMACOES
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fato_processamento_automacoes (
    id_processamento            UUID PRIMARY KEY,

    id_tempo                    INTEGER NOT NULL REFERENCES dim_tempo(id_tempo),
    id_cliente                  UUID NOT NULL REFERENCES dim_cliente(id_cliente),
    id_canal                    INTEGER NOT NULL REFERENCES dim_canal(id_canal),
    id_servico_gov               INTEGER NOT NULL REFERENCES dim_servico_gov(id_servico_gov),
    id_status                   INTEGER NOT NULL REFERENCES dim_status(id_status),

    categoria_erro               VARCHAR(30)
                                     CHECK (categoria_erro IS NULL OR categoria_erro IN
                                         ('PORTAL_INDISPONIVEL', 'SELETOR_NAO_ENCONTRADO',
                                          'CAPTCHA_DETECTADO', 'DADOS_INVALIDOS', 'TIMEOUT_GLOBAL')),

    tipo_documento               VARCHAR(50),
    confianca_ocr                DECIMAL(5,2),
    tempo_ocr_ms                 INTEGER,

    tempo_rpa_ms                  INTEGER,
    protocolo_gerado             VARCHAR(50),
    tentativas_rpa                SMALLINT NOT NULL DEFAULT 0,

    tempo_processamento_total_seg INTEGER,
    tempo_manual_estimado_seg     INTEGER NOT NULL,
    tempo_economizado_seg         INTEGER GENERATED ALWAYS AS
                                       (tempo_manual_estimado_seg - COALESCE(tempo_processamento_total_seg, 0)) STORED,
    custo_variavel_documento      DECIMAL(6,2) NOT NULL DEFAULT 0.80,

    criado_em                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fato_cliente        ON fato_processamento_automacoes (id_cliente);
CREATE INDEX IF NOT EXISTS idx_fato_tempo          ON fato_processamento_automacoes (id_tempo);
CREATE INDEX IF NOT EXISTS idx_fato_status         ON fato_processamento_automacoes (id_status);
CREATE INDEX IF NOT EXISTS idx_fato_cliente_tempo  ON fato_processamento_automacoes (id_cliente, id_tempo);

-- ══════════════════════════════════════════════════════════
-- View de consumo mensal (cota do plano SaaS — spec 09)
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW vw_consumo_mensal_cliente AS
SELECT
    f.id_cliente,
    dt.ano,
    dt.mes,
    COUNT(*) AS automacoes_no_mes,
    c.limite_documentos_mes,
    c.plano_saas
FROM fato_processamento_automacoes f
JOIN dim_tempo dt ON dt.id_tempo = f.id_tempo
JOIN dim_cliente c ON c.id_cliente = f.id_cliente
GROUP BY f.id_cliente, dt.ano, dt.mes, c.limite_documentos_mes, c.plano_saas;

-- ══════════════════════════════════════════════════════════
-- View de ROI agregado por cliente/mês (dashboard — spec 08)
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW vw_roi_por_periodo AS
SELECT
    f.id_cliente,
    dt.ano,
    dt.mes,
    SUM(f.tempo_manual_estimado_seg) AS manual_estimado_seg,
    SUM(COALESCE(f.tempo_processamento_total_seg, 0)) AS real_seg,
    SUM(f.tempo_economizado_seg) AS economizado_seg
FROM fato_processamento_automacoes f
JOIN dim_tempo dt ON dt.id_tempo = f.id_tempo
GROUP BY f.id_cliente, dt.ano, dt.mes;
