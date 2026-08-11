# PRD — GovFlow AI
**Automação Inteligente de Processos Governamentais para Contadores**
Enterprise Challenge Claro × Banca Final Startup One (FIAP)

Versão: 0.1 (rascunho para validação de banca)
Status: Draft
Autor: Equipe GovFlow AI

---

## 1. Contexto e Problema

Escritórios de contabilidade (persona primária: **Roberto, contador PJ**) gastam horas repetindo tarefas manuais em portais governamentais (Redesim/Junta Comercial, e-CAC, INSS) para abrir empresas, protocolar documentos e consultar processos. O trabalho é repetitivo, sujeito a erro humano, e não gera dados que provem o ganho de eficiência para o cliente ou para a gestão do próprio escritório.

**Hipótese de produto:** se o contador conseguir enviar um documento por um canal conversacional (WhatsApp/webchat) e receber de volta, em minutos, o protocolo gerado por um robô que preencheu o portal do governo por ele — com todo o histórico registrado em métricas de ROI — o escritório reduz tempo operacional e ganha visibilidade gerencial que hoje não existe.

## 2. Estado Atual do Projeto (baseline técnico)

O repositório hoje contém uma **prova de conceito (PoC)** mínima, que serve de base para esta expansão:

| Componente | Arquivo | O que faz hoje |
|---|---|---|
| Servidor HTTP | [server.js](../server.js) | Express, 1 rota (`POST /registro-empresa`), serve arquivos estáticos de `public/` |
| Robô RPA | [robot/registroEmpresa.js](../robot/registroEmpresa.js) | Puppeteer headful, preenche um formulário fake (CNPJ, razão social, capital, sócios) |
| Portal alvo | [public/portal_fake.html](../public/portal_fake.html) | Mock local do portal governamental, usado como alvo de teste do robô |
| Logger | [services/logger.js](../services/logger.js) | Callback simples que empilha mensagens de log e as devolve na resposta HTTP |
| Dashboard | [public/page.html](../public/page.html) | Front estático com stepper, console de logs e cartão de dados — **dados mockados no próprio HTML**, sem backend real por trás |
| Config | [config/env.js](../config/env.js) + `.env` | Credenciais do robô (`GOV_USER`, `GOV_PASSWORD`, `GOV_URL`) |

**Não existe hoje:** canal conversacional/WhatsApp, OCR/NLP, banco de dados, autenticação/SSO, multi-tenant, cobrança/planos, métricas persistidas, filas/background jobs.

Esta PoC prova o trecho **RPA → Portal** do fluxo. Este PRD especifica o que falta para chegar ao fluxo completo:

```
Cliente envia PDF no Chat (Hub)
        → IA lê e limpa o texto (OCR/NLP)
        → Robô (RPA) preenche o site do Governo
        → Grava métricas no Banco (Star Schema)
        → Notifica sucesso no Chat
```

## 3. Objetivos e Métricas de Sucesso

| Objetivo | Métrica | Meta (piloto) |
|---|---|---|
| Reduzir tempo operacional do contador | `tempo_processamento_seg` médio por automação vs. baseline manual estimado | Redução ≥ 70% |
| Provar confiabilidade do robô | Taxa de sucesso de protocolos sem intervenção humana | ≥ 85% |
| Validar canal conversacional como porta de entrada | % de solicitações originadas via WhatsApp/chat vs. portal web | Ambos os canais ativos e mensuráveis |
| Sustentar modelo SaaS Freemium | Conversão free → pago | Instrumentado (meta define-se pós-piloto) |
| Confiabilidade percebida | NPS / feedback qualitativo dos contadores piloto | ≥ 8/10 |

## 4. Personas

- **Roberto (primária)** — contador responsável por múltiplos clientes PJ. Baixa tolerância a fricção; quer resolver pelo WhatsApp, sem aprender ferramenta nova.
- **Gestor do escritório (secundária)** — quer visibilidade agregada: quantas automações rodaram, quanto tempo foi economizado, quantas falharam.
- **Admin GovFlow AI (interna)** — opera o SaaS: monitora robôs, trata exceções, gerencia planos/assinaturas dos escritórios clientes.

## 5. Arquitetura em 3 Camadas

O produto é organizado em três camadas, cada uma com specs funcionais próprias (ver `docs/specs/`):

### Camada 1 — Hub de Convergência (entrada do usuário, omnichannel)
Ponto único de contato. Recebe arquivos e intenção do usuário via chat (WhatsApp/webchat), expõe uma aba dentro do ecossistema Claro via SSO, e dispara o processamento no backend via webhook/API.
- [01 — Interface Conversacional](specs/01-interface-conversacional.md)
- [02 — Portal Web / SSO](specs/02-portal-web-sso.md)
- [03 — Webhooks e APIs de Conexão](specs/03-webhooks-api.md)

### Camada 2 — Aplicação (Backend / Core)
O "cérebro": lê documentos, limpa e estrutura dados, opera os robôs contra os portais de governo, e persiste tudo em um modelo analítico (Star Schema) para permitir o cálculo de ROI.
- [04 — Motor de OCR e NLP](specs/04-motor-ocr-nlp.md)
- [05 — Motor de Automação RPA](specs/05-motor-rpa.md)
- [06 — Banco de Dados Relacional & Data Warehouse](specs/06-banco-dados-dw.md)

### Camada 3 — Painel de Gestão / Dashboard (Frontend de gestão)
O que o gestor/contador enxerga para acompanhar e provar o valor do produto.
- [07 — Painel de Acompanhamento (Status Board)](specs/07-painel-status-board.md)
- [08 — Gráficos Analíticos de ROI](specs/08-graficos-roi.md)
- [09 — Gestão de Assinatura SaaS (Freemium)](specs/09-gestao-saas-freemium.md)

```
┌─────────────────────────── CAMADA 1: HUB DE CONVERGÊNCIA ───────────────────────────┐
│  WhatsApp / Webchat  ──┐                                                             │
│  Portal Web (SSO)     ─┼──►  Webhook/API Gateway  ──► fila de processamento          │
└─────────────────────────┼─────────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────── CAMADA 2: APLICAÇÃO (CORE) ──────────────────────────────┐
│  Motor OCR/NLP  ──►  Motor RPA (Puppeteer)  ──►  Banco Relacional + Star Schema DW    │
└─────────────────────────┼─────────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────── CAMADA 3: PAINEL DE GESTÃO ──────────────────────────────┐
│  Status Board  |  Gráficos de ROI  |  Gestão de Assinatura SaaS                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 6. Escopo por Fase

| Fase | Escopo | Objetivo |
|---|---|---|
| **MVP (banca/demo)** | Webchat simples (sem WhatsApp real) + upload → OCR mock/real simples → RPA no portal fake → Postgres com Star Schema → Dashboard consumindo dados reais (substitui o mock de `page.html`) | Provar o fluxo ponta a ponta com dados reais persistidos |
| **Piloto (pós-banca)** | Integração WhatsApp Business API real, OCR de produção (Textract/Tesseract), SSO real com ecossistema Claro, tratamento de exceção robusto, portal governamental real (Redesim/e-CAC) | Validar com contadores reais |
| **Produto** | Multi-tenant completo, billing recorrente, múltiplos serviços de governo, observabilidade e SLA | Escalar comercialmente |

## 7. Requisitos Não Funcionais (transversais)

- **LGPD:** documentos processados (RG, CPF, contrato social) contêm dados pessoais sensíveis. Exige: criptografia em repouso e trânsito, retenção mínima necessária, mascaramento de CPF em telas (já sinalizado no mock atual: `***.***.234-87`), log de acesso a dados pessoais, e base legal declarada.
- **Segurança:** credenciais de portais de governo (`GOV_USER`/`GOV_PASSWORD`) nunca em texto plano em logs ou no frontend; segredos via vault/env, nunca commitados.
- **Confiabilidade:** falhas do robô (site fora do ar, captcha, layout mudou) não podem travar o Hub sem notificar o usuário.
- **Observabilidade:** todo processamento deve ser rastreável ponta a ponta por um `id_processamento` único, do webhook de entrada até a notificação de saída.
- **Multi-tenant desde o modelo de dados:** mesmo no MVP, o Star Schema deve isolar dados por `DIM_CLIENTE`/escritório, já pensando em SaaS.

## 8. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Portais governamentais reais mudam layout / têm captcha | Robô quebra silenciosamente | Tratamento de exceção (spec 05) + fallback humano-no-loop + monitoramento de falhas no Status Board |
| OCR com baixa acurácia em documentos digitalizados de baixa qualidade | Dados incorretos enviados ao governo | Etapa de confirmação humana antes do envio (já presente conceitualmente no dashboard mock, ver spec 04) |
| Dependência de WhatsApp Business API (custo/aprovação Meta) | Atraso no piloto | MVP usa webchat próprio; WhatsApp entra na fase de piloto |
| Uso indevido de dados pessoais (LGPD) | Risco legal/reputacional | Ver requisitos não funcionais acima |

## 9. Fora de Escopo (por ora)

- Suporte a outros serviços de governo além de Registro de Empresa (Redesim) no MVP — desenhado para ser extensível (`DIM_SERVICO_GOV`), mas apenas 1 serviço implementado na banca.
- Pagamento/cobrança real (gateway de pagamento) — a spec 09 cobre apenas o *controle de limite/uso*, não a cobrança em si.
- App mobile nativo — o canal mobile é via WhatsApp/webchat responsivo.

## 10. Índice de Specs

Ver pasta [`docs/specs/`](specs/) — uma spec por funcionalidade, cada uma com: objetivo, estado atual (gap vs. PoC), requisitos funcionais/não funcionais, contratos de API/dados, critérios de aceite e fora de escopo.
