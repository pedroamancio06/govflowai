# GovFlow AI — Especificação Técnica e de Produto (PRD & Tech Specs)
**MVP v1.0 — Documento de Engenharia**

| | |
|---|---|
| **Segmento** | RegTech / GovTech B2B SaaS |
| **Autor** | Arquitetura de Produto GovFlow AI |
| **Público-alvo** | Engenharia Full-stack, Engenharia de IA/OCR, DevOps |
| **Status** | Em execução — Sprints 1-2 (§6) concluídas, ver notas de implementação inline |
| **Documentos relacionados** | [PRD.md](PRD.md) (visão de produto/camadas) · [specs/](specs/) (specs funcionais por feature) |

> **Nota de rastreabilidade:** este documento é a especificação técnica de engenharia (contratos, DDL, APIs, critérios de aceite). As motivações de produto/negócio e o detalhamento funcional por feature já estão em `docs/PRD.md` e `docs/specs/`. Onde os dois divergem em nomenclatura ou stack, este documento prevalece como a arquitetura-alvo, e a divergência é anotada explicitamente na Seção 1.3.

---

## Sumário

1. [Visão Geral do Produto e Objetivos do MVP](#1-visão-geral-do-produto-e-objetivos-do-mvp)
2. [Especificação dos Módulos e Componentes do Sistema](#2-especificação-dos-módulos-e-componentes-do-sistema)
3. [Especificação de Banco de Dados (Star Schema — AWS RDS)](#3-especificação-de-banco-de-dados-star-schema--aws-rds)
4. [Especificação de APIs e Webhooks](#4-especificação-de-apis-e-webhooks)
5. [Critérios de Aceite e Testes de Usabilidade/Performance](#5-critérios-de-aceite-e-testes-de-usabilidadeperformance)

---

## 1. Visão Geral do Produto e Objetivos do MVP

### 1.1 Contexto

**Persona:** Roberto, sócio-diretor de escritório contábil. Perde até **85% do tempo útil** em "trabalho invisível": triagem manual de documentos, redigitação de dados e protocolo em portais governamentais (Redesim, e-CAC).

**Proposta de valor:** automatizar o fluxo burocrático de ponta a ponta através do **Hub de Convergência de Interfaces Conversacionais da Claro** (WhatsApp/Webchat), integrado a um motor de OCR com IA e robôs RPA — do documento bruto ao protocolo emitido, sem o contador tocar em um portal.

**Modelo de negócio (referência para decisões técnicas abaixo):**

| Métrica | Valor | Implicação técnica |
|---|---|---|
| Plano Free | até 5 docs/mês | `DIM_CLIENTE.limite_documentos_mes = 5`; verificação de cota **antes** de enfileirar processamento |
| Plano Pro | R$ 299/mês, até 100 docs | `limite_documentos_mes = 100`; upgrade não pode exigir migração de dados |
| Custo variável | R$ 0,80/documento | Teto de custo de infra por documento — pesa na escolha OCR self-hosted (Tesseract) vs. API paga (Textract) — ver §2.2 |
| Margem de contribuição (Pro) | R$ 219,00 | Cada documento processado tem custo de OCR+RPA+storage rastreado (`custo_variavel_documento` na tabela fato) para auditar essa margem com dados reais, não estimativa |
| CAC / LTV / Breakeven | R$ 250 / R$ 3.942 / 18 clientes no Mês 3 | Não impacta arquitetura diretamente, mas justifica priorizar instrumentação de uso (§3) desde o MVP — sem isso, essas métricas não são verificáveis |

### 1.2 Escopo dos 80% do MVP

**Dentro do escopo (MVP):**
- 1 canal conversacional operacional (Webchat; WhatsApp Business API integrado ao mesmo contrato de eventos, ativação pode ser posterior à banca sem mudança de arquitetura)
- 1 serviço governamental completo, ponta a ponta: Abertura de Empresa (Redesim)
- OCR real para os campos: Razão Social, CNPJ, QSA (nome + participação), Endereço
- RPA real contra ambiente de testes controlado (portal fake), com toggle de configuração para portal real quando houver homologação
- Persistência completa em Star Schema (PostgreSQL/AWS RDS)
- Dashboard com Status Board + gráfico de ROI (tempo economizado) + indicador de cota do plano
- Autenticação via SSO simulado (padrão Authorization Code/OIDC), pronto para trocar pelo IdP real da Claro

**Fora do escopo (os ~20% restantes, explicitamente adiados):**
- Múltiplos serviços de governo simultâneos (e-CAC, Juntas Comerciais) — arquitetura já suporta (`DIM_SERVICO_GOV`), implementação adicional é replicação do padrão do Módulo 3
- Resolução automática de CAPTCHA — tratado como exceção que escala para revisão humana (§2.2.3)
- Cobrança recorrente real (gateway de pagamento) — apenas controle de cota/plano, sem transação financeira
- IdP real da Claro (produção usa simulador com o mesmo protocolo — troca é isolada em 1 módulo)
- WhatsApp Business API ativa (aprovação Meta é processo externo ao time de engenharia)

### 1.3 Estado Atual vs. Arquitetura-Alvo (gap real)

| Camada | Implementado hoje (protótipo funcional) | Arquitetura-alvo (esta spec) | Gap / Ação |
|---|---|---|---|
| Frontend Hub/Dashboard | HTML5 + JS vanilla (`public/webchat.html`, `public/page.html`) — funcional, testado ponta a ponta | React.js + Tailwind CSS | **Reescrita de frontend.** Contratos de API (§4) já são desenhados para serem consumidos por SPA React — o vanilla JS atual consome os mesmos endpoints e pode ser mantido como fallback até a migração terminar |
| Backend | Node.js/Express, sessão via cookie `httpOnly` custom | Node.js/Express, sessão via **JWT** | Middleware de auth precisa ser adaptado (§4.1); lógica de negócio não muda |
| Fila assíncrona | `EventEmitter` em memória (1 processo) | Fila real (Redis/BullMQ ou SQS) | Necessário antes de horizontalizar o backend (mais de 1 instância Node) |
| OCR/NLP | **Implementado** — microserviço Python real (`ocr-service/`, Tesseract + OpenCV + Regex + FastAPI), consumido por `hub/pipeline.js` via HTTP | Microserviço Python (Tesseract + Regex), FastAPI | Consumo hoje é HTTP direto, não fila (spec 03 ainda pendente) — funciona para 1 instância, migra quando o volume justificar |
| RPA | Puppeteer (Node.js) funcional contra portal de testes | Puppeteer (Node.js) — **mantido**, ver justificativa em §2.2.3 | Adicionar tratamento de exceções granular e retries (§2.2.3) |
| Banco de dados | **Implementado em nuvem** — PostgreSQL real no Neon (`sa-east-1`), Star Schema completo. `db/connection.js` suporta os dois modos por trás da mesma interface: `DATABASE_URL` definida usa o Neon (via `pg`); vazia, cai automaticamente no PGlite local (WASM, sem Docker) para desenvolvimento offline | PostgreSQL / AWS RDS ou Neon, Star Schema | Concluído — troca de provedor (Neon → RDS, por exemplo) é apenas mudar `DATABASE_URL` |
| Dashboard analítico | Mock visual com dados fixos | React consumindo `/api/v1/dashboard/*` real | Depende do banco de dados existir primeiro |

### 1.4 Diagrama de Fluxo de Dados (Data Flow)

```
┌──────────┐   1. Mensagem/arquivo    ┌────────────────────┐
│ Usuário  │ ───────────────────────► │  Hub Claro          │
│ (Roberto)│                          │  (WhatsApp/Webchat) │
└──────────┘                          └──────────┬──────────┘
                                                  │ 2. POST /api/v1/webhooks/claro-hub
                                                  │    { canal, usuario_id, arquivo_url }
                                                  ▼
                                      ┌────────────────────────┐
                                      │  Backend Node.js        │
                                      │  (Express + fila)       │
                                      │  - valida payload        │
                                      │  - checa cota do plano   │
                                      │  - grava FATO (status=    │
                                      │    "recebido")            │
                                      │  - enfileira job           │
                                      └───────────┬─────────────┘
                                     3. HTTP interno (fila)      │
                                      ┌───────────▼─────────────┐
                                      │  OCR Engine (Python)      │
                                      │  Tesseract + Regex        │
                                      │  → JSON estruturado       │
                                      └───────────┬─────────────┘
                                     4. callback  │  { dados, confianca }
                                      ┌───────────▼─────────────┐
                                      │  Backend Node.js          │
                                      │  - atualiza FATO           │
                                      │  - dispara job RPA         │
                                      └───────────┬─────────────┘
                                     5. dados limpos│
                                      ┌───────────▼─────────────┐
                                      │  RPA Engine (Puppeteer)   │
                                      │  - login, preenche, envia │
                                      │  - captura protocolo       │
                                      │  - trata exceções (§2.2.3) │
                                      └───────────┬─────────────┘
                                     6. resultado  │
                                      ┌───────────▼─────────────┐
                                      │  AWS RDS (PostgreSQL)      │
                                      │  Star Schema — grava        │
                                      │  tempo, status, protocolo,  │
                                      │  custo, canal (Seção 3)     │
                                      └───────────┬─────────────┘
                                     7. evento de status           │
                                      ┌───────────▼─────────────┐
                                      │  Backend Node.js            │
                                      │  publica no barramento      │
                                      │  de eventos (SSE/WebSocket) │
                                      └───────────┬─────────────┘
                          8. feedback proativo    │
                          ◄────────────────────────┘
┌──────────┐
│ Usuário  │  "✅ Protocolo NB-2026-XXXXXX gerado com sucesso!"
└──────────┘
```

Cada seta 2–7 carrega o `id_processamento` (UUID gerado no passo 2), que é a chave de correlação em todos os logs, eventos e na linha da tabela fato.

---

## 2. Especificação dos Módulos e Componentes do Sistema

### 2.1 Módulo 1 — Hub Conversacional (Front-end/Chat)

**Stack:** React.js 18+, Tailwind CSS, gerenciamento de estado via Context API + hook customizado (`useAutomationStream`), consumo de eventos em tempo real via SSE (`EventSource`) ou WebSocket.

#### 2.1.1 Árvore de Componentes

```
<App>
 ├─ <AuthGuard>                     // redireciona para SSO se sessão JWT inválida/expirada
 │   └─ <DashboardLayout>
 │       ├─ <HubConversacional>     // simula a conversa contínua do Hub Claro
 │       │   ├─ <ChatWindow>
 │       │   │   ├─ <MessageBubble variant="bot|user|sistema" />
 │       │   │   ├─ <QuickReplyButtons opcoes={...} />
 │       │   │   └─ <StatusTimeline eventos={...} />   // linha do tempo em tempo real
 │       │   └─ <FileUploadZone onUpload={...} />
 │       │       ├─ validação client-side (tipo/tamanho)
 │       │       └─ <UploadProgressIndicator />
 │       ├─ <StatusBoard>            // histórico de automações
 │       │   └─ <AutomationRow status="sucesso|erro|processando" />
 │       └─ <ROIDashboard>
 │           ├─ <QuotaWidget uso={3} limite={5} />       // "3/5 automações gratuitas"
 │           ├─ <TempoEconomizadoChart />
 │           └─ <DistribuicaoCanalChart />
```

#### 2.1.2 Validação de Arquivos

| Regra | Client-side (React) | Server-side (Node, obrigatório) |
|---|---|---|
| Tipos aceitos | `.pdf`, `.png`, `.jpg`, `.jpeg` (atributo `accept` do input + checagem de extensão) | `mimetype` real do buffer (nunca confiar na extensão) — `application/pdf`, `image/png`, `image/jpeg` |
| Tamanho máximo | 15 MB, bloqueia seleção com toast de erro | `multer` com `limits.fileSize`, rejeita com HTTP 413 |
| Sanitização de nome | — | Nome do arquivo em disco/storage é gerado (`{id_processamento}.{ext}`), nunca usa o nome original do usuário diretamente (previne path traversal) |

**Nunca confiar apenas na validação client-side** — é UX, não segurança. A validação server-side (Módulo em `POST /api/v1/documents/upload`, §4) é a autoridade.

#### 2.1.3 Mensagens de Status Proativas

O componente `<StatusTimeline>` assina o stream de eventos (`GET /api/v1/automations/stream/:id`, SSE) e renderiza cada evento recebido como uma nova entrada, sem polling.

| Evento (`etapa`) | Copy exibida ao usuário | Ícone/estado |
|---|---|---|
| `recebido` | "📄 Documento recebido! Iniciando processamento..." | info |
| `ocr_iniciado` | "🧠 Lendo e extraindo os dados do documento..." | loading |
| `ocr_concluido` | "✅ Dados extraídos com {confianca}% de confiança." | success |
| `ocr_baixa_confianca` | "⚠️ Alguns dados ficaram incertos — vamos confirmar antes de prosseguir." | warning |
| `rpa_iniciado` | "🤖 Robô acessando o portal do governo..." | loading |
| `rpa_retry` | "🔄 Tentando novamente (tentativa {n}/3)..." | warning |
| `concluido` | "✅ Protocolo {protocolo} gerado com sucesso!" | success |
| `erro` | mensagem específica por `categoria_erro` (ver §2.2.3) | error |

### 2.2 Módulo 2 — Motor de OCR & NLP (Python)

**Stack:** Python 3.11+, **Tesseract OCR** (via `pytesseract`), **OpenCV** para pré-processamento de imagem, **Regex** (`re`) para higienização, exposto como microserviço via **FastAPI** (consumido internamente pelo backend Node via fila/HTTP — nunca exposto publicamente).

> **Por que Tesseract (self-hosted) e não uma API paga (AWS Textract):** o custo variável-alvo é **R$ 0,80/documento** (§1.1). Tesseract self-hosted em uma instância dimensionada corretamente tem custo marginal por documento próximo de zero (apenas CPU/tempo), preservando margem. Textract é a opção de fallback documentada para casos de baixa confiança persistente (ver Fora de Escopo do MVP) — trade-off: acurácia vs. custo variável, decisão de produto a revisitar com dados reais de confiança média em produção.

#### 2.2.1 Pipeline de Processamento

```
1. Recebe arquivo (PDF/imagem) via fila
2. Se PDF → rasteriza páginas em imagens (pdf2image)
3. Pré-processamento de imagem (OpenCV):
   a. Conversão para escala de cinza
   b. Correção de inclinação (deskew)
   c. Binarização adaptativa (threshold)
   d. Remoção de ruído (denoise)
4. OCR (Tesseract, idioma "por", --psm 6)
5. Texto bruto → Higienização (Regex)
6. Classificação do tipo de documento (heurística por palavras-chave)
7. Extração de campos por tipo de documento
8. Cálculo de score de confiança por campo (Tesseract já retorna confidence por palavra)
9. Retorno: JSON estruturado + confiança agregada
```

#### 2.2.2 Regras de Higienização de Strings (Regex)

| Problema comum do OCR | Regra de correção |
|---|---|
| Confusão `O` ↔ `0`, `l`/`I` ↔ `1` em campos numéricos | Aplicar substituição condicional **apenas** em campos identificados como numéricos (CNPJ, CEP) — nunca em campos de texto livre (Razão Social) |
| CNPJ sem máscara ou com espaços soltos | `re.sub(r'[^\d]', '', texto)` → aplica máscara padrão `\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}` via formatação, com validação de dígito verificador |
| Quebras de linha dentro do mesmo campo | `re.sub(r'\s*\n\s*', ' ', texto).strip()` |
| Espaços múltiplos | `re.sub(r'\s{2,}', ' ', texto)` |
| CPF em texto (para mascaramento — nunca exibido completo) | `re.sub(r'(\d{3})\.?\d{3}\.?\d{3}-?(\d{2})', r'\1.***.**-\2', texto)` |

#### 2.2.3 Contrato de Saída (JSON)

```json
{
  "id_processamento": "3b6fdc0b-f4f6-4593-a393-1e89f81b9ef6",
  "tipo_documento": "contrato_social",
  "confianca_agregada": 0.94,
  "tempo_processamento_ms": 2140,
  "dados": {
    "razao_social": { "valor": "TECHGOV SOLUCOES LTDA", "confianca": 0.97 },
    "cnpj": { "valor": "12.345.678/0001-90", "confianca": 0.99, "digito_verificador_valido": true },
    "endereco": {
      "logradouro": "Rua das Flores, 123",
      "bairro": "Centro",
      "cidade": "São Paulo",
      "uf": "SP",
      "cep": "01310-100",
      "confianca": 0.88
    },
    "qsa": [
      { "nome": "Pedro Lopes", "participacao": "60%", "confianca": 0.95 },
      { "nome": "Ana Silva", "participacao": "40%", "confianca": 0.93 }
    ]
  },
  "status": "pronto_para_rpa"
}
```

`status` pode ser `pronto_para_rpa` (confiança agregada ≥ 0.85), `pendente_revisao_humana` (0.60–0.85) ou `documento_ilegivel` (< 0.60 ou falha total de OCR) — limiares configuráveis via variável de ambiente, não hardcoded.

### 2.3 Módulo 3 — Motor de Automação RPA (Puppeteer)

**Decisão técnica:** manter **Puppeteer/Node.js** (já implementado e validado ponta a ponta, ver `robot/registroEmpresa.js`) em vez de migrar para Selenium/Python. Justificativa: (1) reescrever em Selenium não agrega capacidade nova — Puppeteer já cobre 100% dos requisitos funcionais; (2) manter RPA no mesmo runtime do backend (Node) simplifica deploy e comunicação via fila, sem exigir um segundo runtime Python além do já necessário para OCR. Selenium permanece como alternativa documentada caso um portal governamental específico exija um driver não suportado pelo Chromium/Puppeteer.

#### 2.3.1 Tratamento de Exceções

| Categoria | Detecção | Política de Retry | Ação após esgotar tentativas |
|---|---|---|---|
| `PORTAL_INDISPONIVEL` | Timeout de navegação (`page.goto`) ou HTTP 5xx do portal | 3 tentativas, backoff exponencial (5s, 15s, 45s) | Marca automação como `erro`, notifica usuário, reagenda tentativa automática em 30 min |
| `SELETOR_NAO_ENCONTRADO` | `page.waitForSelector` excede timeout (layout do portal mudou) | 1 tentativa (não adianta repetir o mesmo seletor quebrado) | Marca como `erro`, alerta técnico (não é recuperável sem intervenção de engenharia) |
| `CAPTCHA_DETECTADO` | Presença de elemento conhecido de CAPTCHA na página | 0 tentativas automáticas | Marca como `pendente_revisao_humana`, notifica usuário com instrução clara |
| `DADOS_INVALIDOS` | Portal rejeita submissão (ex: CNPJ já existente, campo obrigatório vazio) | 0 tentativas (retry não resolve dado inválido) | Marca como `erro`, retorna ao usuário para reenvio de documento correto |
| `TIMEOUT_GLOBAL` | Execução total excede 90s (ver §5.2) | — | Força `browser.close()`, marca como `erro`, categoria `TIMEOUT_GLOBAL` |

Toda exceção captura screenshot (`page.screenshot()`) da tela no momento da falha, salvo em storage com `id_processamento` no nome, para auditoria — nunca contendo campos de CPF completo visíveis (mascaramento já ocorre antes do preenchimento).

### 2.4 Módulo 4 — Dashboard do Contador (React)

#### 2.4.1 Tela: Status Board

| Elemento | Fonte de dados | Comportamento |
|---|---|---|
| Lista de automações (paginada, 20/página) | `GET /api/v1/automations` | Filtros: status, período, canal |
| Badge de status | `DIM_STATUS.nome_status` | Cores: verde (sucesso), amarelo (pendente_revisao), vermelho (erro), azul (processando) |
| Detalhe (clique na linha) | `GET /api/v1/automations/status/:id` + histórico de eventos | Reaproveita `<StatusTimeline>` do Módulo 1 |

#### 2.4.2 Tela: ROI de Horas Economizadas

| Elemento | Fonte de dados | Cálculo |
|---|---|---|
| Card "Tempo economizado no mês" | `GET /api/v1/dashboard/roi?periodo=mensal` | `SUM(tempo_manual_estimado_seg - tempo_processamento_total_seg)` |
| Gráfico comparativo (manual vs. GovFlow) | idem | Série temporal por mês |
| Distribuição por canal | idem | `COUNT(*) GROUP BY id_canal` |

#### 2.4.3 Tela: Gestão de Cotas do Plano SaaS

| Elemento | Fonte de dados | Regra |
|---|---|---|
| "Você usou X/Y automações este mês" | `GET /api/v1/dashboard/plano` | `Y` = `DIM_CLIENTE.limite_documentos_mes`; `X` = contagem de linhas na fato no mês corrente |
| CTA de upgrade | — | Exibido quando `X >= Y * 0.8` (80% da cota) |
| Bloqueio de novo envio | `POST /api/v1/documents/upload` retorna 402 quando cota excedida | Verificado **antes** de qualquer processamento (nunca gastar OCR/RPA em uma automação que será recusada) |

---

## 3. Especificação de Banco de Dados (Star Schema — AWS RDS)

**Status:** Implementado. Rodando localmente via **PGlite** (Postgres real compilado para WASM, `db/`) — sem dependência de Docker ou instalação de Postgres na máquina de desenvolvimento. Em produção, aponta para **AWS RDS PostgreSQL 15+** (recomendado: `db.t4g.medium` para o MVP, Multi-AZ desligado até tração comprovada — reavaliar com dados reais de carga, ver §5.3) — a troca é isolada em `db/connection.js`; toda a camada de repositórios (`db/repositories/`) já fala SQL parametrizado padrão (`query(sql, params)`), compatível com o driver `pg` real.

> **Duas correções feitas durante a implementação** em relação ao rascunho original desta seção — o código em `db/schema.sql` é a versão correta e prevalece:
> 1. **UUIDs são gerados pela aplicação** (`crypto.randomUUID()`), não pelo banco — remove a dependência da extensão `pgcrypto`/`gen_random_uuid()`, que nem todo ambiente garante disponível (incluindo o PGlite local), e mantém o `id_processamento` conhecido pela aplicação antes mesmo do `INSERT` (necessário para o stream SSE, que publica eventos antes da escrita terminar).
> 2. **`categoria_erro` foi movido de `DIM_STATUS` para a tabela fato.** O rascunho original tinha `UNIQUE` em `nome_status`, o que impedia múltiplas linhas de erro (`PORTAL_INDISPONIVEL`, `CAPTCHA_DETECTADO` etc.) coexistirem sob o mesmo status `'erro'`. `categoria_erro` é um atributo do fato (só existe quando `status = 'erro'`), não um membro de dimensão — `DIM_STATUS` ficou só com os 5 estados do ciclo de vida.

### 3.1 Diagrama do Modelo

```
                         ┌───────────────────┐
                         │   DIM_TEMPO         │
                         └─────────┬──────────┘
                                   │
┌───────────────┐        ┌────────▼─────────────────────┐        ┌───────────────┐
│  DIM_CLIENTE    │◄──────┤                                 ├──────►│  DIM_CANAL      │
└───────────────┘        │  FATO_PROCESSAMENTO_AUTOMACOES  │        └───────────────┘
                          │                                 │
┌───────────────┐        │                                 │        ┌───────────────┐
│ DIM_SERVICO_GOV │◄──────┤                                 ├──────►│  DIM_STATUS     │
└───────────────┘        └────────────────────────────────┘        └───────────────┘
```

### 3.2 DDL — Dimensões

```sql
-- ══════════════════════════════════════════════════════════
-- DIM_TEMPO
-- ══════════════════════════════════════════════════════════
CREATE TABLE dim_tempo (
    id_tempo        SERIAL PRIMARY KEY,
    data_completa   DATE NOT NULL UNIQUE,
    dia             SMALLINT NOT NULL,
    mes             SMALLINT NOT NULL,
    ano             SMALLINT NOT NULL,
    trimestre       SMALLINT NOT NULL,
    dia_semana      VARCHAR(12) NOT NULL,
    is_dia_util     BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_dim_tempo_ano_mes ON dim_tempo (ano, mes);

-- ══════════════════════════════════════════════════════════
-- DIM_CLIENTE  (escritório contábil — tenant)
-- ══════════════════════════════════════════════════════════
CREATE TABLE dim_cliente (
    id_cliente              UUID PRIMARY KEY,  -- gerado pela aplicação, ver nota acima
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
CREATE TABLE dim_canal (
    id_canal        SERIAL PRIMARY KEY,
    nome_canal      VARCHAR(20) NOT NULL UNIQUE
                        CHECK (nome_canal IN ('whatsapp', 'webchat', 'portal_web')),
    descricao       VARCHAR(200)
);

-- ══════════════════════════════════════════════════════════
-- DIM_SERVICO_GOV
-- ══════════════════════════════════════════════════════════
CREATE TABLE dim_servico_gov (
    id_servico_gov                   SERIAL PRIMARY KEY,
    codigo                           VARCHAR(50) NOT NULL UNIQUE, -- chave estável p/ lookup pela aplicação
    nome_servico                     VARCHAR(100) NOT NULL,
    orgao_responsavel                VARCHAR(100) NOT NULL,
    tempo_manual_estimado_padrao_seg INTEGER NOT NULL,   -- baseline p/ ROI, ex: 2400 (40 min)
    ativo                             BOOLEAN NOT NULL DEFAULT TRUE
);

-- ══════════════════════════════════════════════════════════
-- DIM_STATUS  (só os estados do ciclo de vida — categoria_erro é atributo do fato, ver nota acima)
-- ══════════════════════════════════════════════════════════
CREATE TABLE dim_status (
    id_status       SERIAL PRIMARY KEY,
    nome_status     VARCHAR(25) NOT NULL UNIQUE
                        CHECK (nome_status IN
                            ('recebido', 'processando', 'aguardando_confirmacao',
                             'pendente_revisao_humana', 'sucesso', 'erro'))
);
```

`aguardando_confirmacao` foi adicionado depois do MVP inicial: o Portal Web (spec 07) exige confirmação humana explícita ("Enviar ao Gov.br") antes do robô agir — o pipeline para logo após o OCR bem-sucedido e fica nesse estado até o clique, nunca aciona o RPA sozinho nesse canal.

### 3.3 DDL — Tabela Fato

```sql
-- ══════════════════════════════════════════════════════════
-- FATO_PROCESSAMENTO_AUTOMACOES
-- ══════════════════════════════════════════════════════════
CREATE TABLE fato_processamento_automacoes (
    id_processamento            UUID PRIMARY KEY,  -- gerado pela aplicação, ver nota acima

    -- Chaves estrangeiras para as dimensões
    id_tempo                    INTEGER NOT NULL REFERENCES dim_tempo(id_tempo),
    id_cliente                  UUID NOT NULL REFERENCES dim_cliente(id_cliente),
    id_canal                    INTEGER NOT NULL REFERENCES dim_canal(id_canal),
    id_servico_gov               INTEGER NOT NULL REFERENCES dim_servico_gov(id_servico_gov),
    id_status                   INTEGER NOT NULL REFERENCES dim_status(id_status),

    -- Atributo do fato (não é membro de dimensão — só populado quando id_status = 'erro')
    categoria_erro               VARCHAR(30)
                                     CHECK (categoria_erro IS NULL OR categoria_erro IN
                                         ('PORTAL_INDISPONIVEL', 'SELETOR_NAO_ENCONTRADO',
                                          'CAPTCHA_DETECTADO', 'DADOS_INVALIDOS', 'TIMEOUT_GLOBAL')),

    -- Métricas de OCR
    tipo_documento               VARCHAR(50),
    confianca_ocr                DECIMAL(5,2),           -- 0.00 a 1.00
    tempo_ocr_ms                 INTEGER,

    -- Métricas de RPA
    tempo_rpa_ms                 INTEGER,
    protocolo_gerado             VARCHAR(50),
    tentativas_rpa                SMALLINT NOT NULL DEFAULT 0,

    -- Métricas agregadas (ROI e custo — ligadas ao unit economics, §1.1)
    tempo_processamento_total_seg INTEGER,
    tempo_manual_estimado_seg     INTEGER NOT NULL,
    tempo_economizado_seg         INTEGER GENERATED ALWAYS AS
                                       (tempo_manual_estimado_seg - COALESCE(tempo_processamento_total_seg, 0)) STORED,
    custo_variavel_documento      DECIMAL(6,2) NOT NULL DEFAULT 0.80,

    -- Auditoria
    criado_em                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fato_cliente        ON fato_processamento_automacoes (id_cliente);
CREATE INDEX idx_fato_tempo          ON fato_processamento_automacoes (id_tempo);
CREATE INDEX idx_fato_status         ON fato_processamento_automacoes (id_status);
CREATE INDEX idx_fato_cliente_tempo  ON fato_processamento_automacoes (id_cliente, id_tempo);
```

`atualizado_em` **não** usa trigger — `db/repositories/automacaoRepository.js` seta `atualizado_em = now()` explicitamente em todo `UPDATE`, o suficiente já que a única escrita nessa tabela é a própria aplicação (evita a complexidade de uma função `plpgsql` para um caso de uso único).

### 3.4 View de Suporte — Consumo Mensal por Cliente (cota SaaS)

```sql
CREATE VIEW vw_consumo_mensal_cliente AS
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
```

### 3.5 Mapeamento de Tipos e Considerações de Conexão

| Campo lógico | Tipo PostgreSQL | Motivo |
|---|---|---|
| Identificadores de tenant/processamento | `UUID` | Evita enumeração sequencial de IDs entre tenants (segurança) |
| Identificadores de dimensão de baixa cardinalidade (canal, status, serviço) | `SERIAL` (INTEGER) | Cardinalidade baixa e estável — UUID seria overhead desnecessário |
| Percentuais/confiança | `DECIMAL(5,2)` | Evita erro de arredondamento de `FLOAT` em métricas exibidas ao usuário |
| Timestamps | `TIMESTAMPTZ` | RDS pode rodar em região diferente do cliente — nunca usar `TIMESTAMP` sem timezone |
| `tempo_economizado_seg` | `GENERATED ALWAYS AS ... STORED` | Evita divergência entre o valor gravado e o cálculo — computado pelo próprio banco |

**Conexão da aplicação:** usar pool de conexões (`pg-pool` no Node, `asyncpg` no Python) — nunca abrir conexão nova por request. Tamanho do pool recomendado para o MVP: 10 conexões por instância de aplicação (ver dimensionamento em §5.3).

---

## 4. Especificação de APIs e Webhooks

### 4.1 Padrões Gerais

- **Base path:** `/api/v1`
- **Autenticação:** JWT Bearer (`Authorization: Bearer <token>`) para todas as rotas exceto o webhook inbound do Hub Claro e o callback de SSO.
  - Access token: expiração 15 min, claims `{ sub: id_cliente, escritorio, plano_saas, iat, exp }`
  - Refresh token: cookie `httpOnly`, `SameSite=Lax`, expiração 30 dias, rota dedicada de renovação (`POST /api/v1/auth/refresh`)
- **Autenticação de webhook inbound (Hub Claro):** assinatura HMAC-SHA256 no header `X-Claro-Signature`, calculada sobre o corpo bruto da requisição com um segredo compartilhado — **não usar JWT para webhooks de terceiros** (o emissor não é um usuário autenticado, é um sistema; HMAC é o padrão correto).
- **Formato de erro padrão:**
  ```json
  { "erro": { "codigo": "COTA_EXCEDIDA", "mensagem": "Limite de 5 documentos do plano gratuito atingido.", "status": 402 } }
  ```
- **Paginação:** `?pagina=1&tamanho=20`, resposta inclui `{ itens: [...], pagina, tamanho, total }`.

### 4.2 Endpoints

#### `POST /api/v1/auth/sso/callback`
Troca o `code` do fluxo Authorization Code por uma sessão JWT.

**Request:** `?code=...&state=...`
**Response 200:**
```json
{ "access_token": "eyJhbGciOi...", "expires_in": 900, "cliente": { "id_cliente": "uuid", "nome_escritorio": "..." } }
```
*(refresh token é setado via `Set-Cookie`, não retorna no corpo)*

---

#### `POST /api/v1/documents/upload`
Recebe o documento do usuário e inicia o pipeline. **Autenticado.**

**Request:** `multipart/form-data`
| Campo | Tipo | Obrigatório |
|---|---|---|
| `arquivo` | file (PDF/PNG/JPG, ≤15MB) | sim |
| `canal` | string (`whatsapp`\|`webchat`\|`portal_web`) | sim |
| `id_servico_gov` | integer | sim |

**Response 202 Accepted:**
```json
{ "id_processamento": "3b6fdc0b-f4f6-4593-a393-1e89f81b9ef6", "status": "recebido" }
```
**Response 402 Payment Required** (cota excedida):
```json
{ "erro": { "codigo": "COTA_EXCEDIDA", "mensagem": "Limite de 5 documentos do plano gratuito atingido.", "status": 402 } }
```
**Response 400** (arquivo inválido): `{ "erro": { "codigo": "ARQUIVO_INVALIDO", "mensagem": "Envie um PDF, JPG ou PNG de até 15MB.", "status": 400 } }`

---

#### `GET /api/v1/automations/status/:id`
Consulta o estado atual de uma automação (complementar ao stream de eventos, para reload de página).

**Response 200:**
```json
{
  "id_processamento": "3b6fdc0b-f4f6-4593-a393-1e89f81b9ef6",
  "status": "sucesso",
  "protocolo_gerado": "NB-2026-253570",
  "tempo_processamento_total_seg": 47,
  "historico": [
    { "etapa": "recebido", "timestamp": "2026-08-11T21:28:32Z" },
    { "etapa": "ocr_concluido", "timestamp": "2026-08-11T21:28:34Z" },
    { "etapa": "concluido", "timestamp": "2026-08-11T21:28:46Z" }
  ]
}
```

---

#### `GET /api/v1/automations/stream/:id` *(Server-Sent Events)*
Stream de eventos em tempo real da mesma automação — consumido pelo `<StatusTimeline>` (§2.1.3). `Content-Type: text/event-stream`.

---

#### `GET /api/v1/automations`
Lista automações do cliente autenticado (Status Board, §2.4.1). Suporta `?status=&canal=&periodo=&pagina=`.

**Response 200:**
```json
{
  "itens": [
    { "id_processamento": "uuid", "servico": "Abertura Redesim", "canal": "whatsapp",
      "status": "erro", "categoria_erro": "PORTAL_INDISPONIVEL", "criado_em": "2026-08-10T14:02:00Z" }
  ],
  "pagina": 1, "tamanho": 20, "total": 42
}
```

---

#### `POST /api/v1/webhooks/claro-hub` *(inbound, autenticado via HMAC)*
Recebido pelo backend sempre que o Hub Claro repassa uma mensagem/arquivo do usuário.

**Request:**
```json
{
  "canal": "whatsapp",
  "usuario_id": "5511999999999",
  "tipo": "arquivo",
  "arquivo_url": "https://storage.claro.com.br/tmp/abc123.pdf",
  "servico_solicitado": "abertura_redesim"
}
```
**Response 200:** `{ "recebido": true, "id_processamento": "uuid" }`
**Response 401:** assinatura HMAC inválida — requisição descartada e logada para auditoria de segurança.

---

#### `GET /api/v1/dashboard/roi?periodo=mensal&de=2026-01&ate=2026-08`
```json
{
  "tempo_economizado_seg_total": 136800,
  "serie_temporal": [{ "mes": "2026-07", "manual_estimado_seg": 52000, "real_seg": 10400 }],
  "distribuicao_canal": [{ "canal": "whatsapp", "quantidade": 34, "percentual": 68 }]
}
```

---

#### `GET /api/v1/dashboard/plano`
```json
{ "plano_saas": "free", "limite_mensal": 5, "uso_mes_atual": 3, "periodo": "2026-08" }
```

---

#### `GET /api/v1/health`
Endpoint operacional (liveness/readiness probe para orquestração/DevOps). `200 { "status": "ok", "db": "ok", "fila": "ok" }`.

---

## 5. Critérios de Aceite e Testes de Usabilidade/Performance

### 5.1 Taxa de Sucesso do OCR

| Cenário de teste | Critério de aceite | Método de validação |
|---|---|---|
| Documento digitalizado nítido (scanner, 300dpi+) | Confiança agregada ≥ 95%, todos os campos obrigatórios extraídos | Conjunto de 30 documentos de referência, execução automatizada, assert de confiança mínima |
| Foto de celular com boa iluminação | Confiança agregada ≥ 85% | Idem, conjunto de 20 fotos de referência |
| Documento com ruído/baixa qualidade | Sistema classifica corretamente como `pendente_revisao_humana` (nunca segue automaticamente com confiança < 60%) | Conjunto de 10 documentos degradados propositalmente |
| CNPJ com dígito verificador inválido | Sistema rejeita e sinaliza campo específico, não bloqueia os demais campos | Teste unitário da função de validação de CNPJ |

### 5.2 Timeout e Confiabilidade do RPA

| Cenário | Critério de aceite |
|---|---|
| Execução em condições normais | Conclusão em ≤ 60s (P95) |
| Timeout global | Automação nunca excede **90s** — força encerramento e marca `erro/TIMEOUT_GLOBAL` |
| Portal indisponível (simulado) | 3 retries com backoff (5s/15s/45s), depois marca `erro` e reagenda em 30 min |
| CAPTCHA detectado | 0 retries automáticos, marca `pendente_revisao_humana` em até 2s após detecção |
| Taxa de sucesso agregada (ambiente de testes, 100 execuções) | ≥ 85% sem intervenção humana (meta de produto, §1 do PRD.md) |

### 5.3 Carga no Banco de Dados (AWS RDS)

| Cenário | Critério de aceite | Método de validação |
|---|---|---|
| Escrita de 1 linha na fato por automação concluída | Latência de escrita < 50ms (P95) | Benchmark com `pgbench` ou script de carga dedicado |
| Consulta de Status Board (paginada, 20 itens) | Latência < 200ms (P95) com até 100k linhas na fato | Query plan (`EXPLAIN ANALYZE`) validado, índices de §3.3 aplicados |
| Consulta de ROI agregado (view `vw_consumo_mensal_cliente`) | Latência < 300ms (P95) com até 100k linhas | Idem |
| Volume-alvo do MVP | Suportar 500 automações/dia sem degradação | Teste de carga simulando pico de uso concorrente |
| Pool de conexões | Nunca exceder `max_connections` do RDS sob carga de pico | Configuração de pool testada sob carga simulada (§3.5) |

### 5.4 Matriz de Testes de Aceite — Ponta a Ponta

| ID | Cenário | Critério de Aceite |
|---|---|---|
| E2E-01 | Usuário envia documento válido pelo Webchat | Recebe protocolo em ≤ 2 min, com pelo menos 4 mensagens de status intermediárias |
| E2E-02 | Usuário no limite do plano free tenta enviar 6º documento do mês | Recebe erro `COTA_EXCEDIDA` antes de qualquer processamento OCR/RPA ser iniciado |
| E2E-03 | Documento ilegível enviado | Usuário recebe instrução para reenviar em < 15s, automação não avança para RPA |
| E2E-04 | Portal governamental indisponível durante RPA | Usuário é notificado com mensagem específica (não genérica), automação reagendada automaticamente |
| E2E-05 | Dois escritórios distintos consultam o Status Board simultaneamente | Nenhum dado cross-tenant vaza entre as sessões |
| E2E-06 | Sessão JWT expira durante navegação no dashboard | Renovação silenciosa via refresh token, sem logout abrupto do usuário |

---

## 6. Plano de Execução Recomendado (Sprints)

Para o time de engenharia priorizar o restante do MVP a partir do estado atual (§1.3):

1. ✅ **Sprint 1 — Fundação de dados** *(concluída)*: Star Schema aplicado (`db/schema.sql`), camada de repositórios (`db/repositories/`) substituindo o estado em memória — `auth/tenantStore.js` e `hub/pipeline.js` já gravam em `DIM_CLIENTE`/`FATO_PROCESSAMENTO_AUTOMACOES` reais. **Banco de dados em nuvem provisionado (Neon)** e validado ponta a ponta; PGlite local permanece como fallback automático para desenvolvimento offline (§3)
2. ✅ **Sprint 2 — Microserviço de OCR** *(concluída)*: serviço Python/FastAPI real (`ocr-service/`) substituindo o stub — pipeline completo (pré-processamento, Tesseract, regex, confiança por campo). Integração com o backend é HTTP direto por ora; migrar para fila real fica para quando a spec 03 existir
3. **Sprint 3 — Migração de auth para JWT:** adaptar o middleware de sessão existente (cookie → JWT), sem alterar a lógica de resolução de tenant já validada
4. **Sprint 4 — API v1 completa:** implementar/realinhar os endpoints da Seção 4 sob o namespace `/api/v1`, com testes automatizados por endpoint
5. **Sprint 5 — Frontend React:** migrar Webchat + Dashboard de vanilla JS para React/Tailwind, consumindo a API já estabilizada nos sprints anteriores
6. **Sprint 6 — Hardening:** aplicar tratamento de exceções completo do RPA (§2.2.3), rodar a matriz de testes da Seção 5, ajustar índices/queries conforme resultados de carga
