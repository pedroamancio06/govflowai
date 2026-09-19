# Spec 07 — Painel de Acompanhamento (Status Board)

**Camada:** 3 — Painel de Gestão / Dashboard
**Status:** Implementado. O card de upload/processamento em [public/page.html](../../public/page.html) dispara o pipeline real (OCR via `POST /hub/portal/arquivos`, autenticado) e exibe os dados extraídos de verdade em "Dados Extraídos — Pré-Envio". Abaixo dele, o card **Histórico de Automações** lista as execuções passadas do escritório autenticado, com filtro por status e detalhe expansível por linha.

**Fluxo em duas etapas, não mais automático de ponta a ponta:** o upload roda o OCR e PARA — o robô só é acionado quando o usuário clica em "Enviar ao Gov.br" (`POST /hub/portal/enviar`), nunca sozinho. A automação fica com status `aguardando_confirmacao` na tabela fato nesse meio-tempo, guardada em `hub/automacoesPendentes.js` (memória, efêmero) até a confirmação — com checagem de que só o próprio escritório autenticado pode confirmar a sua automação. `tempo_processamento_total_seg` é calculado como OCR + RPA apenas, nunca incluindo o tempo em que ficou esperando o clique do usuário (senão a métrica de ROI ficaria distorcida).

## 0. Nota de Implementação — Histórico (RF01-RF02)

`GET /hub/portal/automacoes` (autenticado, `db/repositories/automacaoRepository.js::listarPorCliente`) lista as automações do escritório logado, paginadas (20/página) e com filtro opcional por status. A lista atualiza sozinha assim que a automação em andamento termina (sucesso ou erro), sem precisar recarregar a página. Clicar numa linha expande um detalhe com razão social, CNPJ, protocolo, tipo de documento, confiança do OCR, tempo de processamento e categoria do erro (quando houver) — lido direto da tabela fato, sem depender do stream de eventos (que é efêmero e não existe mais para automações já concluídas).

**CNPJ/Razão Social extraídos pelo OCR:** `fato_processamento_automacoes` ganhou as colunas `cnpj`/`razao_social` (migração idempotente em `db/schema.sql`), gravadas em `hub/pipeline.js` assim que o OCR termina — antes mesmo da confirmação de envio, então já aparecem no histórico mesmo numa automação ainda `aguardando_confirmacao`. Na lista, a razão social + CNPJ aparecem como subtítulo da linha (abaixo do nome do serviço); no detalhe expandido, aparecem como campos próprios. Testado ponta a ponta: upload real → OCR extrai CNPJ/razão social → gravados no banco imediatamente (confirmado via SQL direto, antes de qualquer clique em "Enviar ao Gov.br") → aparecem corretamente no `GET /hub/portal/automacoes` e na UI (linha + detalhe expandido, conferido via screenshot).

**Bug real encontrado e corrigido durante o teste:** a função de renderização limpava o `innerHTML` do container e, na sequência, tentava reaproveitar um elemento que morava dentro dele (`#historico-empty`) — o elemento já não existia mais, quebrando a montagem do estado vazio silenciosamente (erro engolido por uma Promise não tratada). Corrigido construindo o estado vazio como string a cada renderização, em vez de depender de um nó DOM persistente.

**Ainda falta**, desta spec: filtro por período (dia/semana/mês — hoje só filtra por status), e ações de "reenviar"/"revisar" diretamente na lista (RF05-RF06) — hoje o usuário só visualiza o histórico, sem ação de retry embutida.

## 1. Objetivo

Dar ao gestor do escritório visibilidade de todas as automações rodadas no dia/mês, com status individual, para responder rapidamente "o que já foi feito, o que está pendente e o que falhou".

## 2. Estado Atual / Gap

`public/page.html` já implementa toda a interação visual do pipeline (stepper de 4 etapas, console de logs em tempo real com `log()`, cartão de dados extraídos) — mas roda inteiramente client-side com dados fixos: `mockData` ([public/page.html:1201-1210](../../public/page.html)) e `dadosParaObroro` hardcoded ([public/page.html:1284-1292](../../public/page.html)). A única chamada real ao backend é o `fetch('http://localhost:3000/registro-empresa', ...)` de uma única automação disparada manualmente pelo botão "Iniciar Processamento" — não existe uma **lista** de automações históricas, nem status persistido.

Esta spec transforma esse protótipo em um painel real, listando automações vindas da tabela fato ([spec 06](06-banco-dados-dw.md)).

## 3. Requisitos Funcionais

- RF01 — Listar automações do escritório autenticado (via [spec 02 — SSO](02-portal-web-sso.md)) em ordem cronológica decrescente, com filtro por período (dia/semana/mês) e por status (Sucesso, Pendente, Erro).
- RF02 — Cada linha da lista exibe: serviço solicitado (`DIM_SERVICO_GOV`), canal de origem (`DIM_CANAL`), status atual, protocolo gerado (se houver), tempo de processamento.
- RF03 — Clicar em uma automação específica abre o detalhe: reaproveita a UI de "Live Feed — RPA Console" já existente no mock, mas alimentada pelo histórico real de eventos daquele `id_processamento` (mesmo formato de eventos definido na [spec 03](03-webhooks-api.md)), em vez do `log()` local simulado com `sleep()`.
- RF04 — Automações em andamento devem atualizar o status na tela automaticamente (via polling curto ou WebSocket/SSE), sem precisar recarregar a página — substitui a simulação local de `startProcessing()` ([public/page.html:1248-1348](../../public/page.html)) por consumo real dos eventos da fila.
- RF05 — Automações com status "Erro" exibem a categoria de erro (`PORTAL_INDISPONIVEL`, `CAPTCHA_DETECTADO`, etc. — ver [spec 05](05-motor-rpa.md)) de forma legível, com opção de reprocessar manualmente.
- RF06 — Automações marcadas `pendente_revisao_humana` ([spec 04, RF10](04-motor-ocr-nlp.md)) aparecem destacadas, com ação para o gestor revisar os dados extraídos antes de liberar o robô.

## 4. Requisitos Não Funcionais

- Lista paginada (não carregar todo o histórico de uma vez) — a tabela fato pode crescer rapidamente com uso.
- Toda consulta filtrada implicitamente por `id_cliente` da sessão (reforça isolamento multi-tenant da [spec 02](02-portal-web-sso.md)/[06](06-banco-dados-dw.md)).
- Atualização de status em tela: latência alvo < 5s entre evento real e reflexo na UI.

## 5. Contrato de API

```
GET /dashboard/automacoes?status=erro&periodo=2026-08
→ 200
{
  "itens": [
    {
      "id_processamento": "uuid",
      "servico": "Abertura Redesim",
      "canal": "whatsapp",
      "status": "erro",
      "categoria_erro": "PORTAL_INDISPONIVEL",
      "protocolo": null,
      "tempo_processamento_seg": null,
      "criado_em": "2026-08-10T14:02:00Z"
    }
  ],
  "pagina": 1,
  "total": 42
}

GET /dashboard/automacoes/{id}/eventos   -- histórico para o "Live Feed" de detalhe
```

## 6. Critérios de Aceite

- [ ] A lista reflete automações reais persistidas na tabela fato, não dados mockados.
- [ ] Uma automação disparada pelo chat ([spec 01](01-interface-conversacional.md)) aparece no Status Board em tempo real, sem ação manual do gestor.
- [ ] Filtrar por "Erro" mostra apenas automações com falha, com a categoria correta.
- [ ] Usuário de um escritório nunca vê automações de outro escritório.

## 7. Dependências

- [Spec 02 — Portal Web/SSO](02-portal-web-sso.md) (autenticação e contexto de tenant).
- [Spec 06 — Banco de Dados/DW](06-banco-dados-dw.md) (fonte dos dados).
- [Spec 03 — Webhooks e APIs](03-webhooks-api.md) (eventos em tempo real para o detalhe/live feed).

## 8. Fora de Escopo

- Exportação de relatórios em PDF/Excel (pode ser incremento pós-MVP).
- Edição manual de dados diretamente na automação já processada.
