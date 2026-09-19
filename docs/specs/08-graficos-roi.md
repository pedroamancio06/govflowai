# Spec 08 — Gráficos Analíticos de ROI

**Camada:** 3 — Painel de Gestão / Dashboard
**Status:** Implementado. Card "ROI — Tempo Economizado" no dashboard, com destaque numérico, gráfico de barras (manual vs. real, por mês) e distribuição por canal — todos com dados reais.

## 0. Nota de Implementação

`GET /hub/portal/roi` (autenticado, `db/repositories/relatorioRepository.js::roiPorCliente`) reaproveita a view `vw_roi_por_periodo` já criada na Sprint 1 do banco, mais uma agregação simples por canal. O gráfico (barras manual vs. real por mês) e a distribuição por canal são renderizados com CSS puro — sem biblioteca externa de gráficos, consistente com o restante do projeto, que ficou deliberadamente enxuto em dependências de front-end.

**Correção de regra de negócio feita durante a implementação:** a view original somava `tempo_economizado_seg` de **todas** as automações, inclusive as que terminaram em erro — o que inflava o ROI com processos que não completaram a tarefa e não economizaram tempo nenhum. Corrigido para contar só automações com `status = 'sucesso'`.

**Testado:** cálculo validado batendo exatamente com os valores esperados (2400s manual − 31s real = 2369s economizados), e conferido visualmente via screenshot.

**Ainda falta** desta spec: drill-down (clicar num canal do gráfico para filtrar o histórico por aquele canal, RF05) e seleção de período customizado (hoje agrega por mês corrido, sem seletor de intervalo).

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
