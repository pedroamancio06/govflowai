# Spec 05 — Motor de Automação Robótica (RPA)

**Camada:** 2 — Aplicação (Backend/Core)
**Status:** Implementado como PoC funcional contra um portal fake — precisa evoluir para portal real, execução em background e tratamento de exceções robusto.

## 0. Nota de Implementação — Segundo robô: Consulta e-CAC (simulação)

Além de `registroEmpresa.js` (Redesim), o MVP ganhou um segundo robô — **Consulta e-CAC (declarações de IR)** — que demonstra o mesmo conceito (login + navegação + extração de dados de um portal governamental) contra um alvo diferente, agora numa stack diferente (Python/Playwright em vez de Node/Puppeteer):

- **Alvo:** [public/ecac_fake/](../../public/ecac_fake/) — réplica visual fictícia do e-CAC/gov.br (autenticação, captcha simulado, SSO simulado com CPF/senha, 2FA simulado, home e Portal MIR), servida pelo próprio Express da aplicação. **Este robô nunca acessa `cav.receita.fazenda.gov.br` ou qualquer domínio real do governo** — decisão deliberada, consistente com o `portal_fake.html` já usado pela Redesim, e reforçada aqui porque o alvo real (eCAC) tem CAPTCHA/2FA de produção ativos, cuja automação (mesmo com resolução manual) violaria os Termos de Uso do gov.br.
- **Script:** [executerRPAEcac.py](../../executerRPAEcac.py) (Playwright `sync_api`, `headless=False`). O captcha e o 2FA simulados são resolvidos pelo próprio robô (marca o checkbox "Não sou um robô" + clica "Verificar"; clica "Confirmar" no 2FA), cada um com uma pausa (~1,2s) antes do clique só para ficar visível em apresentação/gravação — diferente de burlar um captcha real de terceiro, aqui é um checkbox decorativo de uma página HTML deste próprio projeto, sem nenhuma validação por trás (a política de "nunca automatizar captcha" continua valendo para qualquer alvo real, ver RF06/Fora de Escopo — não se aplica a um prop visual fictício que o robô controla).
- **Ponte Node → Python:** [robot/consultaEcac.js](../../robot/consultaEcac.js) faz `child_process.spawn` do script, repassando `stdout`/`stderr` linha a linha ao `Logger` existente, que publica cada etapa via SSE exatamente como o robô da Redesim. Aceita credenciais opcionais (`{cpf, senha}`, repassadas como argv ao script) e usa um arquivo de saída único por execução (`declaracoes_<uuid>.json`, apagado depois de lido) quando chamado com credenciais — evita colisão entre duas consultas concorrentes.
- **Dois pontos de disparo:**
  1. Menu do webchat, opção `[2] Consulta e-CAC` ([hub/flowEngine.js](../../hub/flowEngine.js)) — consulta avulsa sem cliente associado, sempre usando `ECAC_CPF`/`ECAC_SENHA` do `.env`. Grava em `fato_processamento_automacoes` (`dim_servico_gov.codigo = 'consulta_ecac'`), então aparece no Status Board (spec 07) e no ROI (spec 08) como qualquer outra automação.
  2. Página **Consulta e-CAC** do dashboard ([public/clientes_ecac.html](../../public/clientes_ecac.html)), acessível pelo menu-toggle no canto superior esquerdo de `page.html` (que também reúne, no mesmo dropdown, os atalhos para Webchat e Configurações — antes soltos no header) — CRUD completo de clientes do escritório (`clientes_ecac`, tabela operacional em `db/schema.sql`): criar, editar (nome/CPF, com troca de senha simulada opcional — em branco mantém a atual) e excluir, além de "Consultar"/"Reprocessar" por cliente (`hub/pipeline.js: iniciarConsultaEcacParaCliente`). Status (`nunca_executado`/`processando`/`sucesso`/`erro`) e declarações exibidos em tempo real via SSE no mesmo canal do usuário logado; edição/exclusão ficam bloqueadas enquanto uma consulta está em andamento.
- **Testado:** ponta a ponta contra o Neon nos dois pontos de disparo — cadastro de cliente, edição (incluindo tentativa de CPF já usado por outro cliente → 409), exclusão (incluindo cliente já excluído → 404), disparo da consulta, acompanhamento via SSE, gravação do resultado (`status_consulta` + `declaracoes` JSONB), bloqueio de disparo duplicado (409) enquanto uma consulta já está em andamento, 409 para CPF duplicado no cadastro, arquivo de saída único limpo após a leitura, e verificação visual (menu-toggle reorganizado, modal de configurações, tabela de clientes com ações, modal de edição) via screenshot.
- **Ritmo de apresentação (ambos os robôs):** `robot/registroEmpresa.js` ganhou `slowMo: 60` no `puppeteer.launch`, digitação com `delay` em todos os campos (inclusive os sócios, que antes eram preenchidos instantaneamente via `$eval`, agora usam `.type()` visível) e pausas de ~1,2s entre etapas — fluxo completo passou de poucos segundos para ~50-55s, dando tempo de acompanhar CNPJ/Razão Social/sócios sendo digitados com os valores exatos que vieram do OCR (logados explicitamente: `Preenchendo CNPJ (extraído do documento): ...`). `executerRPAEcac.py` ganhou `slow_mo=350`, trocou `page.fill()` por `page.type(..., delay=110)` no CPF/senha e pausas equivalentes entre etapas — fluxo completo passou a levar ~25-30s.
- **Variabilidade da consulta e-CAC:** `public/ecac_fake/sso-login.html` grava o CPF digitado em `localStorage` (compartilhado entre abas da mesma origem); `public/ecac_fake/portalmir.html` usa esse CPF pra escolher entre duas listas de declarações diferentes (regra: último dígito do CPF par → todas "Regular", ímpar → uma "Pendente de Regularização" em 2024) — existia hardcoded uma única lista antes, o que fazia qualquer cliente consultado sempre mostrar o mesmo resultado, mascarando que a extração é real. Testado com dois clientes cadastrados com CPFs terminados em dígitos de paridades diferentes: um retornou as 3 declarações "Regular", o outro retornou 2024 como "Pendente de Regularização" — confirmando que o robô está lendo o que está na tela, não repetindo um valor fixo.
- **Portal Redesim mais realista + protocolo em tela:** [public/portal_fake.html](../../public/portal_fake.html) foi reestilizado no mesmo padrão visual usado no e-CAC fictício (topbar BRASIL, cor institucional `#1351b4`, selo "SIMULAÇÃO"), e ganhou fluxo real de 3 telas (login → painel com menu → formulário), em vez de tudo já visível de uma vez — todos os seletores que `robot/registroEmpresa.js` usa (`#username`, `#menu-registro-empresa`, `#form-registro`, `#cnpj` etc.) continuam os mesmos, só a apresentação mudou. O protocolo agora é gerado em `hub/pipeline.js` **antes** de chamar o robô (não depois) e passado como parâmetro para `executarRegistroEmpresa(dados, logger, protocolo)`, que chama `window.mostrarProtocolo(protocolo)` no navegador via `page.evaluate()` — o mesmo número aparece no card de confirmação do portal fictício e no banco (`protocolo_gerado`), nunca dois valores divergentes gerados em lugares diferentes. Testado ponta a ponta com documento real: protocolo mostrado na tela (`NB-2026-701813`) idêntico ao gravado em `fato_processamento_automacoes.protocolo_gerado`.

## 1. Objetivo

Preencher e submeter automaticamente o formulário do portal governamental (Redesim/Junta Comercial no MVP) a partir dos dados estruturados extraídos pelo [Motor de OCR/NLP](04-motor-ocr-nlp.md), sem intervenção manual do contador.

## 2. Estado Atual / Gap

Já existe um robô funcional em [robot/registroEmpresa.js](../../robot/registroEmpresa.js): abre o Puppeteer (`headless: false`), navega até `http://localhost:3000/portal_fake.html`, autentica com `GOV_USER`/`GOV_PASSWORD` ([config/env.js](../../config/env.js)), preenche CNPJ/Razão Social/Capital/Sócios e submete. **O que falta:**
- Alvo real: hoje aponta para um mock local ([public/portal_fake.html](../../public/portal_fake.html)), não para o portal governamental de fato;
- Execução assíncrona: hoje roda inline dentro da requisição HTTP (`server.js:25`), bloqueando a resposta;
- Tratamento de exceção granular: hoje qualquer erro cai num `catch` genérico que apenas loga a mensagem ([robot/registroEmpresa.js:110-116](../../robot/registroEmpresa.js)) — não distingue "site fora do ar" de "campo mudou de lugar" de "captcha";
- Execução `headless: false` ([robot/registroEmpresa.js:11](../../robot/registroEmpresa.js)) não é viável em produção/servidor sem display — precisa rodar headless com evidência (screenshot/HTML) para depuração.

## 3. Requisitos Funcionais

### 3.1 Scripts de Navegação
- RF01 — Executar como worker consumidor da fila (ver [spec 03](03-webhooks-api.md)), recebendo o JSON já limpo pelo Motor de OCR/NLP.
- RF02 — Rodar em modo `headless: true` em produção, com captura de screenshot em cada etapa crítica (login, preenchimento, submissão) para auditoria e depuração — sem exigir display gráfico no servidor (diferente do `headless: false` atual).
- RF03 — Suportar múltiplos serviços de governo através de um roteador de scripts (`tipo_servico → script correspondente`), mantendo `registroEmpresa.js` como o primeiro caso implementado.
- RF04 — Reportar progresso incremental (cada `logger.log(...)` já existente) como eventos publicados no barramento da [spec 03](03-webhooks-api.md), não apenas acumulados para retorno síncrono como hoje.
- RF05 — Ao concluir, capturar e persistir o comprovante/protocolo gerado pelo portal (hoje o mock não gera nenhum comprovante real).

### 3.2 Tratamento de Exceções
- RF06 — Classificar falhas em categorias acionáveis: `PORTAL_INDISPONIVEL`, `CAPTCHA_DETECTADO`, `CAMPO_NAO_ENCONTRADO` (layout mudou), `DADOS_INVALIDOS` (ex.: CNPJ rejeitado pelo governo), `TIMEOUT`.
- RF07 — Cada categoria de erro deve ter uma política de retry própria (ex.: `PORTAL_INDISPONIVEL` → retry automático com backoff; `DADOS_INVALIDOS` → não retry, volta para revisão humana).
- RF08 — Toda falha deve notificar o Hub imediatamente com uma mensagem específica por categoria (consumido pela [spec 01, RF10](01-interface-conversacional.md)), nunca apenas "erro no robô".
- RF09 — `browser.close()` deve ocorrer mesmo em falhas de timeout/crash do processo (o `finally` atual já cobre o caminho feliz e erros síncronos — validar cobertura para crashes do processo do Chromium).

## 4. Requisitos Não Funcionais

- Cada execução do robô deve rodar isolada (não pode haver duas automações do mesmo `id_processamento` concorrentes).
- Screenshots/evidências devem ter retenção definida (LGPD) e não expor dados sensíveis desnecessariamente.
- Tempo máximo de execução por automação: timeout configurável (ex.: 3 min) após o qual a automação é marcada como falha e o browser é encerrado forçadamente.

## 5. Contrato de Entrada/Saída

Entrada: o mesmo JSON já consumido hoje por `executarRegistroEmpresa(dados, logger)`, agora vindo da fila em vez de `req.body` direto:
```json
{ "cnpj": "...", "razaoSocial": "...", "capitalSocial": "...", "socios": [...] }
```

Saída (evento final publicado, em vez do `res.json` síncrono atual):
```json
{
  "id_processamento": "uuid",
  "status": "sucesso" | "erro",
  "categoria_erro": "PORTAL_INDISPONIVEL" | null,
  "protocolo": "NB-2024-00487253" | null,
  "tempo_processamento_seg": 47,
  "evidencias": ["s3://.../screenshot_login.png", "..."]
}
```
`tempo_processamento_seg` alimenta diretamente o cálculo de ROI (ver [spec 06](06-banco-dados-dw.md) e [spec 08](08-graficos-roi.md)).

## 6. Critérios de Aceite

- [ ] O robô continua completando o fluxo de ponta a ponta contra o portal fake (regressão zero em relação à PoC atual).
- [ ] Rodando em modo headless, sem display, o robô completa a mesma automação e gera as mesmas evidências.
- [ ] Uma falha simulada (ex.: `GOV_URL` apontando para endereço inexistente) é classificada como `PORTAL_INDISPONIVEL` e não como erro genérico.
- [ ] `tempo_processamento_seg` é registrado e corresponde ao tempo real de execução do robô.

## 7. Dependências

- [Spec 03 — Webhooks e APIs](03-webhooks-api.md) (fila de trabalho e barramento de eventos).
- [Spec 04 — Motor de OCR/NLP](04-motor-ocr-nlp.md) (fonte dos dados de entrada).
- Acesso real (credenciais/homologação) ao portal Redesim/Junta Comercial para a fase de piloto — no MVP de banca, o alvo continua sendo `portal_fake.html`.

## 8. Fora de Escopo

- Resolução automática de CAPTCHA via serviço terceiro (mencionada no fluxo conceitual do dashboard mock, [public/page.html:1330-1332](../../public/page.html)) — no MVP, CAPTCHA é tratado como falha classificada (`CAPTCHA_DETECTADO`) que aciona revisão humana, não resolução automática.
- Suporte a portais que exigem certificado digital A1/A3 — avaliar na fase de piloto.
