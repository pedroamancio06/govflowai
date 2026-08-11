# Spec 08 — Gráficos Analíticos de ROI

**Camada:** 3 — Painel de Gestão / Dashboard
**Status:** Não implementado. O dashboard atual não possui nenhum gráfico agregado — apenas o cartão de dados de uma única automação simulada.

## 1. Objetivo

Provar, visualmente e com números, o valor gerado pelo GovFlow AI: quanto tempo o escritório economizou e como as solicitações se distribuem entre canais — os dois principais argumentos de venda/retenção do produto (Enterprise Challenge Claro e banca FIAP pedem explicitamente essa prova de ROI).

## 2. Estado Atual / Gap

Não existe nenhuma agregação hoje — nem base de dados para agregar (ver [spec 06](06-banco-dados-dw.md), que ainda precisa ser criada). Este é o primeiro componente verdadeiramente analítico do produto.

## 3. Requisitos Funcionais

### 3.1 Gráfico de Tempo Economizado (Manual vs. GovFlow AI)
- RF01 — Gráfico comparativo (barras ou área) mostrando, por período selecionado, `tempo_manual_estimado_seg` somado vs. `tempo_processamento_seg` somado, ambos vindos de `FATO_PROCESSAMENTO_AUTOMACOES` ([spec 06](06-banco-dados-dw.md)).
- RF02 — Exibir também o valor agregado em destaque (ex.: "Você economizou 38h este mês"), não apenas o gráfico — replicando o tom de "prova de ROI" que a `confidence-label`/destaques já usados no mock sugerem visualmente.
- RF03 — Permitir alternar o período de análise (dia, semana, mês, trimestre — mapeado para `DIM_TEMPO`).

### 3.2 Distribuição de Solicitações por Canal
- RF04 — Gráfico de distribuição (pizza/donut ou barras empilhadas) mostrando volume de automações por `DIM_CANAL` (WhatsApp vs. Portal Web vs. Webchat) no período selecionado.
- RF05 — Permitir drill-down: clicar em um canal filtra o [Status Board (spec 07)](07-painel-status-board.md) por aquele canal.

### 3.3 Geral
- RF06 — Todos os gráficos respeitam o isolamento multi-tenant (`id_cliente` da sessão SSO, [spec 02](02-portal-web-sso.md)) — um escritório nunca vê agregados de outro.
- RF07 — Estado vazio (nenhuma automação no período) deve comunicar isso claramente, não renderizar um gráfico zerado sem contexto.

## 4. Requisitos Não Funcionais

- Consultas agregadas devem usar a view `vw_roi_por_periodo` (ver [spec 06, RF06](06-banco-dados-dw.md)) — evitar cálculo de ROI espalhado em múltiplas queries divergentes.
- Tempo de carregamento do dashboard de ROI: < 2s para períodos de até 12 meses de histórico.

## 5. Contrato de API

```
GET /dashboard/roi?periodo=mensal&de=2026-01&ate=2026-08
→ 200
{
  "tempo_economizado_seg_total": 136800,
  "serie_temporal": [
    { "mes": "2026-06", "manual_estimado_seg": 48000, "real_seg": 9600 },
    { "mes": "2026-07", "manual_estimado_seg": 52000, "real_seg": 10400 }
  ],
  "distribuicao_canal": [
    { "canal": "whatsapp", "quantidade": 34, "percentual": 68 },
    { "canal": "portal_web", "quantidade": 16, "percentual": 32 }
  ]
}
```

## 6. Critérios de Aceite

- [ ] O valor de tempo economizado exibido bate com a soma manual de `(tempo_manual_estimado_seg - tempo_processamento_seg)` da tabela fato para o mesmo período.
- [ ] Alternar o período recalcula os gráficos corretamente, sem misturar dados de outros períodos.
- [ ] Clicar em uma fatia do gráfico de canal filtra corretamente o Status Board.
- [ ] Dados de um escritório nunca aparecem nos gráficos de outro (teste com 2 tenants de exemplo).

## 7. Dependências

- [Spec 06 — Banco de Dados/DW](06-banco-dados-dw.md) (view `vw_roi_por_periodo`).
- [Spec 02 — Portal Web/SSO](02-portal-web-sso.md) (contexto de tenant).
- Definição de `tempo_manual_estimado_seg` por serviço — precisa ser um valor de referência validado com contadores reais no piloto, não um número arbitrário.

## 8. Fora de Escopo

- Comparação de ROI entre escritórios (benchmarking) — levantaria questões de dados agregados cross-tenant, fora do escopo do MVP.
- Exportação de gráficos como imagem/PDF.
