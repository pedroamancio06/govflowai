# Spec 01 — Interface Conversacional (Chatbot / Webchat / WhatsApp)

**Camada:** 1 — Hub de Convergência
**Status:** MVP implementado (webchat) — ver nota abaixo.

## 0. Nota de Implementação (MVP)

Implementado um webchat funcional em `/webchat.html`, com backend em `hub/` (`router.js`, `flowEngine.js`, `sessionStore.js`, `pipeline.js`, `eventBus.js`), montado em `server.js` sob o prefixo `/hub`. Cobre RF01-RF10 desta spec com as seguintes simplificações conscientes, a revisitar quando as specs correspondentes forem implementadas:

- **Canal:** apenas webchat (sem WhatsApp Business API real ainda — RF01-RF10 foram desenhados para serem agnósticos de canal, então a integração com WhatsApp deve reaproveitar o mesmo `flowEngine`/`pipeline`).
- **Fila/barramento de eventos (spec 03):** `hub/eventBus.js` é um `EventEmitter` em memória fazendo esse papel — funciona para 1 servidor/1 processo, mas não substitui a fila real (Redis/BullMQ) prevista na spec 03. Eventos publicados antes de o cliente abrir a conexão SSE são perdidos (sem replay) — no navegador isso não é problema porque o `webchat.html` abre o stream antes de qualquer envio, mas fica registrado como limitação a resolver com uma fila persistente.
- **Extração de dados (spec 04):** `hub/pipeline.js` usa `extrairDadosStub()` com dados fixos, no mesmo formato do contrato de saída da spec 04 — não lê o conteúdo real do arquivo enviado ainda.
- **Estado de conversa (RF05):** em memória (`hub/sessionStore.js`), sobrevive a reconexões do mesmo processo mas não a um restart do servidor — vira persistente quando a spec 06 (banco de dados) existir.
- **Efeito colateral necessário:** para o robô (`robot/registroEmpresa.js`, spec 05) completar o fluxo de verdade, `public/portal_fake.html` precisou ganhar um `<script>` mínimo (login navega de fato, "Adicionar Sócio" gera as linhas `.socio-row`) — antes disso o robô sempre falhava por timeout de navegação, independente do Hub.

## 1. Objetivo

Ser o ponto de entrada principal do Roberto (contador) para iniciar uma automação: enviar um documento e acompanhar o processamento sem sair do chat, seja no WhatsApp, seja em um webchat embutido no portal.

## 2. Estado Atual / Gap

Hoje a única forma de disparar o robô é uma chamada HTTP direta a `POST /registro-empresa` ([server.js:14](../../server.js)) com um JSON já estruturado — não existe UI conversacional, nem recepção de arquivo, nem envio assíncrono de status. O `page.html` atual simula visualmente um "console live feed", mas é um front que já parte de dados prontos, sem um bot real por trás.

## 3. Requisitos Funcionais

### 3.1 Recepção de Arquivos
- RF01 — Aceitar upload de arquivo pelo canal (PDF, JPG, PNG) até 15MB.
- RF02 — Validar tipo/tamanho no recebimento e responder imediatamente no chat se o arquivo for inválido (ex: "Não consegui ler esse arquivo, envie um PDF ou foto legível.").
- RF03 — Persistir o arquivo recebido em storage (ex: S3/bucket compatível) e associá-lo a um `id_processamento` único antes de disparar o processamento assíncrono.

### 3.2 Fluxo Guiado
- RF04 — Ao iniciar conversa, apresentar menu de serviços disponíveis (ex.: `[1] Abertura Redesim` `[2] Consulta e-CAC`), modelado como uma máquina de estados por sessão de usuário (`aguardando_servico → aguardando_documento → processando → concluido`).
- RF05 — Persistir o estado da conversa por usuário (telefone/ID) para sobreviver a reconexões — sem isso, cada mensagem seria tratada isolada.
- RF06 — Se o usuário enviar algo fora do fluxo esperado (ex.: mensagem de texto quando se espera um arquivo), responder com instrução contextual, não com erro genérico.

### 3.3 Feedback Proativo em Tempo Real
- RF07 — Emitir mensagens de status push (não solicitadas pelo usuário) em pontos-chave do pipeline: recebimento do documento, início de OCR, início de RPA, conclusão/erro.
- RF08 — Cada mensagem de status deve ser disparada por eventos publicados pelo backend (ver [spec 03 — Webhooks e APIs](03-webhooks-api.md)), não por polling do bot.
- RF09 — Ao concluir, enviar link/anexo do comprovante e o número de protocolo.
- RF10 — Em caso de erro, a mensagem deve ser acionável (ex.: "documento ilegível, reenvie" vs. "portal do governo indisponível, tentaremos novamente em breve").

## 4. Requisitos Não Funcionais

- Canal desacoplado do core: o motor de OCR/RPA não deve conhecer se a origem foi WhatsApp ou webchat (ver `DIM_CANAL` na [spec 06](06-banco-dados-dw.md)).
- Tempo de resposta ao primeiro contato do usuário: < 2s (mesmo que o processamento real seja assíncrono).
- LGPD: o bot deve informar, no primeiro contato, que documentos serão usados apenas para o processamento solicitado (aviso de privacidade).

## 5. Contrato de Integração (canal → Hub)

```
POST /hub/mensagens
{
  "canal": "whatsapp" | "webchat",
  "usuario_id": "5511999999999",
  "tipo": "texto" | "arquivo",
  "conteudo": "texto da mensagem" | { "arquivo_url": "...", "mime": "application/pdf" }
}
```

Resposta assíncrona ao usuário via callback do provedor de mensageria (ex.: WhatsApp Business API) — não via resposta HTTP síncrona, dado que o processamento leva minutos.

## 6. Critérios de Aceite

- [ ] Usuário consegue completar o fluxo `menu → upload → status em tempo real → protocolo final` inteiramente dentro do canal de chat, sem abrir outra aba.
- [ ] Pelo menos 4 eventos de status distintos são recebidos automaticamente durante um processamento de ponta a ponta.
- [ ] Arquivo inválido é rejeitado com mensagem clara em < 3s.
- [ ] Estado da conversa sobrevive a uma reconexão do usuário (fechar e reabrir o WhatsApp).

## 7. Dependências

- [Spec 03 — Webhooks e APIs de Conexão](03-webhooks-api.md) (para publicar/consumir eventos de status)
- [Spec 04 — Motor de OCR/NLP](04-motor-ocr-nlp.md) e [Spec 05 — Motor RPA](05-motor-rpa.md) (fontes dos eventos)
- Provedor de WhatsApp Business API (piloto) — no MVP de banca, pode ser substituído por um webchat próprio com o mesmo contrato de mensagens.

## 8. Fora de Escopo

- Entendimento de linguagem natural livre (o fluxo é guiado por menus/opções, não um LLM aberto, no MVP).
- Suporte a múltiplos idiomas.
