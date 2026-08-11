# Spec 07 — Painel de Acompanhamento (Status Board)

**Camada:** 3 — Painel de Gestão / Dashboard
**Status:** Existe uma versão puramente visual e mockada ([public/page.html](../../public/page.html)); precisa ser conectada a dados reais.

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
