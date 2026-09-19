# Documentação — GovFlow AI

Documentação de produto para alinhar o projeto ao **Enterprise Challenge Claro** e à **banca final do Startup One (FIAP)**.

- [**PRD — Visão Geral do Produto**](PRD.md): contexto, objetivos, personas, arquitetura em 3 camadas, fases e riscos.
- [**Tech Spec MVP**](TECH-SPEC-MVP.md): especificação técnica de engenharia — DDL do Star Schema, contratos de API (`/api/v1`), especificação dos 4 módulos (Hub React, OCR Python, RPA, Dashboard), critérios de aceite mensuráveis e plano de sprints. Documento de referência para desenvolvedores full-stack e engenheiros de IA/DevOps.

## Specs por Camada

### Camada 1 — Hub de Convergência
| Spec | Status |
|---|---|
| [01 — Interface Conversacional (Chatbot/Webchat/WhatsApp)](specs/01-interface-conversacional.md) | **MVP implementado** — webchat em `/webchat.html` (`hub/`), sem WhatsApp real ainda |
| [02 — Portal Web / SSO](specs/02-portal-web-sso.md) | **MVP implementado** — `/page.html` protegido por SSO simulado (`auth/`), com login real contra a tabela `usuarios` (banco) e painel de gestão de usuários da organização (ícone de configurações no dashboard); IdP Claro real ainda pendente |
| [03 — Webhooks e APIs de Conexão](specs/03-webhooks-api.md) | Parcial — MVP da spec 01 usa uma versão simplificada em memória (`hub/eventBus.js`) como stand-in; fila real/Redis ainda não existe |

### Camada 2 — Aplicação (Backend / Core)
| Spec | Status |
|---|---|
| [04 — Motor de OCR e NLP](specs/04-motor-ocr-nlp.md) | **Implementado** — microserviço Python/FastAPI real (`ocr-service/`, Tesseract + OpenCV + Regex), consumido por `hub/pipeline.js`. Extração heurística por regex, validada contra documento de referência — ver limitações em [ocr-service/README.md](../ocr-service/README.md) |
| [05 — Motor de Automação RPA](specs/05-motor-rpa.md) | PoC funcional contra portal fake — `portal_fake.html` ganhou JS mínimo (login navega, sócios geram linhas) para o robô conseguir completar o fluxo |
| [06 — Banco de Dados Relacional & Data Warehouse](specs/06-banco-dados-dw.md) | **Implementado** — Star Schema real (`db/`) rodando em Postgres na nuvem (Neon, `sa-east-1`), com fallback automático para PGlite (Postgres/WASM embutido) em dev local sem `DATABASE_URL`; `auth/` e `hub/` já gravam nele |

### Camada 3 — Painel de Gestão / Dashboard
| Spec | Status |
|---|---|
| [07 — Painel de Acompanhamento (Status Board)](specs/07-painel-status-board.md) | **Implementado** — histórico real de automações no dashboard, com filtro por status e detalhe expansível, testado visualmente (screenshot) e com isolamento multi-tenant validado |
| [08 — Gráficos Analíticos de ROI](specs/08-graficos-roi.md) | **Implementado** — tempo economizado (destaque + gráfico mensal manual vs. real) e distribuição por canal, com dados reais do banco em nuvem |
| [09 — Gestão de Assinatura SaaS (Freemium)](specs/09-gestao-saas-freemium.md) | **Implementado** — widget de consumo no dashboard e bloqueio real de upload ao atingir a cota mensal, testado com cliente real no limite |

Cada spec segue o mesmo formato: Objetivo → Estado Atual/Gap (referenciando o código real do repositório) → Requisitos Funcionais → Requisitos Não Funcionais → Contrato de API/Dados → Critérios de Aceite → Dependências → Fora de Escopo.
