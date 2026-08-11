# Spec 03 — Webhooks e APIs de Conexão (Backend do Hub)

**Camada:** 1 — Hub de Convergência
**Status:** Parcialmente implementado — existe 1 rota síncrona (`POST /registro-empresa`); falta o receptor genérico, a fila e o barramento de eventos de status.

## 1. Objetivo

Ser a "cola" entre o canal conversacional/portal (Camada 1) e o motor de processamento (Camada 2): recebe a mensagem/arquivo, enfileira o processamento em background, e republica eventos de progresso de volta para o canal de origem.

## 2. Estado Atual / Gap

`server.js` hoje expõe `app.post("/registro-empresa", async (req, res) => { ... await executarRegistroEmpresa(dados, logger) ... res.json(...) })` ([server.js:14-31](../../server.js)) — **isso é uma chamada síncrona e bloqueante**: a requisição HTTP fica aberta até o Puppeteer terminar (podendo levar dezenas de segundos) e devolve os logs inteiros de uma vez no final. Não há:
- Fila/job assíncrono (o processamento roda no mesmo processo do servidor HTTP);
- Emissão incremental de eventos (o `Logger` atual só acumula mensagens em um array e as retorna no `res.json` final — ver [services/logger.js](../../services/logger.js));
- Endpoint genérico de recepção por canal (hoje é uma rota acoplada a "registro de empresa").

## 3. Requisitos Funcionais

- RF01 — Endpoint genérico `POST /hub/eventos` que recebe qualquer solicitação de automação (arquivo + metadados + canal de origem) e retorna imediatamente um `id_processamento` (HTTP 202 Accepted), sem esperar o processamento terminar.
- RF02 — A solicitação recebida é publicada em uma fila (ex.: BullMQ/Redis, ou similar) consumida por workers do motor de OCR/RPA — desacoplando recepção de execução.
- RF03 — Cada worker, ao mudar de etapa (`recebido → ocr_iniciado → ocr_concluido → rpa_iniciado → concluido/erro`), publica um evento no barramento (ex.: Redis Pub/Sub ou fila de notificação).
- RF04 — Um serviço assinante desses eventos traduz cada um em uma mensagem para o canal de origem (chat) e em uma atualização de status consultável pelo dashboard (Camada 3).
- RF05 — Reexpor a funcionalidade atual de `registro-empresa` como um caso específico desse fluxo genérico (`tipo_servico = "abertura_redesim"`), sem quebrar o robô existente ([robot/registroEmpresa.js](../../robot/registroEmpresa.js)).
- RF06 — Idempotência: reenvio do mesmo `id_processamento` (ex.: retry de webhook) não deve duplicar a execução do robô.

## 4. Requisitos Não Funcionais

- Timeout do endpoint de recepção: responder em < 1s independente da duração real do processamento.
- Todo evento publicado carrega `id_processamento`, `timestamp`, `etapa`, `status`, `canal_origem` — este é o contrato mínimo consumido tanto pelo bot (spec 01) quanto pelo Status Board (spec 07).
- Falha de um worker não deve derrubar o servidor HTTP principal (isolamento de processo/queue, ao contrário do modelo atual onde tudo roda no mesmo processo Express).

## 5. Contrato de API

```
POST /hub/eventos
Body: {
  "canal": "whatsapp" | "webchat" | "portal_web",
  "tipo_servico": "abertura_redesim" | "consulta_ecac",
  "cliente_id": "uuid",
  "arquivo_url": "https://...",
  "dados_extra": { ... }
}
→ 202 Accepted
{ "id_processamento": "uuid" }

GET /hub/eventos/{id_processamento}/status
→ 200
{
  "id_processamento": "uuid",
  "etapa_atual": "rpa_iniciado",
  "historico": [
    { "etapa": "recebido", "timestamp": "..." },
    { "etapa": "ocr_iniciado", "timestamp": "..." },
    { "etapa": "ocr_concluido", "timestamp": "..." }
  ]
}
```

## 6. Critérios de Aceite

- [ ] `POST /hub/eventos` responde em menos de 1s mesmo que o processamento total leve minutos.
- [ ] É possível consultar `GET /hub/eventos/{id}/status` a qualquer momento e ver a etapa atual.
- [ ] Dois eventos publicados com o mesmo `id_processamento` (simulando retry) não disparam o robô duas vezes.
- [ ] O fluxo atual de `registro-empresa` continua funcionando via o novo endpoint genérico, sem regressão no robô Puppeteer existente.

## 7. Dependências

- Infraestrutura de fila (Redis/BullMQ ou equivalente) — novo componente, não existe hoje no projeto.
- [Spec 04](04-motor-ocr-nlp.md) e [Spec 05](05-motor-rpa.md) como consumidores da fila.
- [Spec 06](06-banco-dados-dw.md) como destino de persistência dos eventos/status.

## 8. Fora de Escopo

- Garantias de entrega "exactly-once" completas (at-least-once com idempotência é suficiente para o MVP).
- Suporte a múltiplos provedores de fila simultâneos.
