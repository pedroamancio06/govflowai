# Spec 06 — Banco de Dados Relacional & Analítico (Data Warehouse)

**Camada:** 2 — Aplicação (Backend/Core)
**Status:** Implementado — ver nota abaixo. Especificação técnica completa (DDL, correções de design encontradas na implementação) em [TECH-SPEC-MVP.md §3](../TECH-SPEC-MVP.md#3-especificação-de-banco-de-dados-star-schema--aws-rds).

## 0. Nota de Implementação

Star Schema real aplicado em `db/schema.sql`, rodando via **PGlite** (Postgres real compilado para WASM, `db/connection.js`) — sem exigir Docker ou instalação local de Postgres. Camada de repositórios em `db/repositories/` (`clienteRepository`, `automacaoRepository`, `dimensaoRepository`) já é consumida por:
- `auth/tenantStore.js` — `DIM_CLIENTE` real (era Map em memória)
- `hub/pipeline.js` — grava o ciclo de vida completo de cada automação em `FATO_PROCESSAMENTO_AUTOMACOES`, incluindo `tempo_economizado_seg` (coluna gerada pelo próprio banco)

Testado ponta a ponta: login SSO resolvendo `DIM_CLIENTE` real e uma automação completa via webchat persistindo corretamente na fato, com JOIN às 5 dimensões retornando os dados esperados.

**Simplificação consciente:** o canal de chat (webchat) ainda não tem login — `hub/pipeline.js` resolve/provisiona um `DIM_CLIENTE` sintético a partir do `usuarioId` da sessão de chat. Quando o WhatsApp real existir, o telefone assume esse mesmo papel.

**Banco de dados em nuvem provisionado (Neon, `sa-east-1`)** — `db/connection.js` suporta os dois modos por trás da mesma interface: com `DATABASE_URL` definida, conecta no Neon via `pg`; sem ela, cai automaticamente no PGlite local. Fluxo completo (SSO, upload, OCR, confirmação, RPA) validado ponta a ponta contra o banco em nuvem.

## 1. Objetivo

Persistir cada automação executada em um modelo **Star Schema** que sirva simultaneamente como:
1. Registro operacional (o que aconteceu, com quem, quando);
2. Fonte analítica para os dashboards de ROI ([spec 08](08-graficos-roi.md)) e status board ([spec 07](07-painel-status-board.md)).

## 2. Estado Atual / Gap

Hoje, uma execução do robô produz apenas mensagens de log efêmeras (array `logs` devolvido no `res.json`, [server.js:27-30](../../server.js)) — nada é gravado em disco/banco. Não há conceito de cliente, canal, serviço ou tempo de processamento persistido. Esta spec introduz o primeiro banco de dados do projeto (PostgreSQL).

## 3. Requisitos Funcionais

### 3.1 Modelagem Star Schema

**Tabela fato:**

```
FATO_PROCESSAMENTO_AUTOMACOES
├── id_processamento        UUID (PK) -- mesmo id usado nos eventos da spec 03
├── id_tempo                FK → DIM_TEMPO
├── id_cliente               FK → DIM_CLIENTE
├── id_canal                 FK → DIM_CANAL
├── id_servico_gov            FK → DIM_SERVICO_GOV
├── id_status                FK → DIM_STATUS
├── tempo_processamento_seg  INT   -- duração real do robô (spec 05)
├── tempo_manual_estimado_seg INT  -- baseline p/ cálculo de ROI (spec 08)
├── confianca_extracao        DECIMAL -- da etapa de OCR/NLP (spec 04)
├── protocolo_gerado          VARCHAR NULL
├── criado_em                 TIMESTAMP
```

**Dimensões:**

```
DIM_TEMPO        (id_tempo, data, hora, dia_semana, mes, ano, trimestre)
DIM_CLIENTE      (id_cliente, nome_escritorio, plano_saas, criado_em)  -- base do multi-tenant (specs 02, 09)
DIM_CANAL        (id_canal, nome_canal)  -- "whatsapp" | "webchat" | "portal_web"
DIM_SERVICO_GOV  (id_servico_gov, nome_servico, orgao)  -- "Abertura Redesim", "Consulta e-CAC", ...
DIM_STATUS       (id_status, nome_status, categoria_erro)  -- "sucesso" | "erro" | "pendente_revisao_humana"
```

- RF01 — Toda automação criada via [spec 03](03-webhooks-api.md) gera imediatamente 1 linha em `FATO_PROCESSAMENTO_AUTOMACOES` com status inicial, e é atualizada conforme avança (não é um `INSERT` único no fim — precisa refletir o progresso em tempo real para o Status Board).
- RF02 — `DIM_CLIENTE` deve ser a chave de isolamento multi-tenant referenciada por todas as queries do dashboard (reforça RF05 da [spec 02](02-portal-web-sso.md)).
- RF03 — `DIM_CANAL` é populado a partir do campo `canal` recebido no evento de entrada ([spec 03](03-webhooks-api.md)), permitindo o gráfico "WhatsApp vs. Portal Web" da [spec 08](08-graficos-roi.md).
- RF04 — Migrations versionadas (ex.: `node-pg-migrate` ou `Prisma Migrate`) — nenhuma alteração de schema manual em produção.

### 3.2 Cálculo de ROI
- RF05 — `tempo_manual_estimado_seg` é um valor de referência por `id_servico_gov` (configurável, ex.: "abertura Redesim manual leva em média 40 min"), usado para calcular o tempo economizado: `tempo_economizado = tempo_manual_estimado_seg - tempo_processamento_seg`.
- RF06 — Expor uma view/query agregada `vw_roi_por_periodo` que soma tempo economizado por `DIM_CLIENTE` e por `DIM_TEMPO`, consumida diretamente pela [spec 08](08-graficos-roi.md).

## 4. Requisitos Não Funcionais

- Dados pessoais (nome, CPF mascarado) que precisem transitar pela fato/dimensão devem seguir a política de mascaramento definida na [spec 04, RF08](04-motor-ocr-nlp.md) — o Data Warehouse não deve armazenar CPF completo.
- Índices em `id_cliente`, `id_tempo`, `id_status` (colunas mais usadas em filtros do dashboard).
- Backup diário e retenção definida conforme política de LGPD do produto.

## 5. Critérios de Aceite

- [ ] Uma automação completa (do disparo ao protocolo) resulta em exatamente 1 linha na tabela fato, com todas as FKs preenchidas corretamente.
- [ ] É possível somar `tempo_economizado` filtrando por escritório e por mês via a view `vw_roi_por_periodo`.
- [ ] Uma query cross-tenant (sem filtro de `id_cliente`) nunca é exposta por nenhuma API do dashboard.
- [ ] Rodar as migrations do zero recria o schema completo sem intervenção manual.

## 6. Dependências

- PostgreSQL provisionado (novo componente de infraestrutura).
- [Spec 03](03-webhooks-api.md) como fonte de eventos que alimentam a fato.
- [Spec 05, RF09](05-motor-rpa.md) como fonte de `tempo_processamento_seg` e `protocolo_gerado`.

## 7. Fora de Escopo

- Data lake / processamento batch em larga escala (ETL) — no MVP o volume não justifica; a fato é escrita diretamente pela aplicação.
- Ferramenta de BI externa (Metabase/PowerBI) — os gráficos do MVP são renderizados no próprio dashboard ([spec 08](08-graficos-roi.md)).
