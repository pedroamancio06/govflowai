# Spec 05 — Motor de Automação Robótica (RPA)

**Camada:** 2 — Aplicação (Backend/Core)
**Status:** Implementado como PoC funcional contra um portal fake — precisa evoluir para portal real, execução em background e tratamento de exceções robusto.

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
