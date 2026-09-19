const { getDb } = require("../connection");

// spec 08 (Gráficos de ROI) — reaproveita a view vw_roi_por_periodo já criada
// em db/schema.sql desde a Sprint 1, mais uma agregação simples por canal.
// Sempre restrito a id_cliente (isolamento multi-tenant).
async function roiPorCliente(idCliente) {
  const db = getDb();

  const serie = await db.query(
    `SELECT ano, mes, manual_estimado_seg, real_seg, economizado_seg
     FROM vw_roi_por_periodo
     WHERE id_cliente = $1
     ORDER BY ano, mes`,
    [idCliente]
  );

  const distribuicao = await db.query(
    `SELECT c.nome_canal, COUNT(*) AS quantidade
     FROM fato_processamento_automacoes f
     JOIN dim_canal c ON c.id_canal = f.id_canal
     WHERE f.id_cliente = $1
     GROUP BY c.nome_canal
     ORDER BY quantidade DESC`,
    [idCliente]
  );

  const totalAutomacoes = distribuicao.rows.reduce((acc, r) => acc + parseInt(r.quantidade, 10), 0);

  const tempoEconomizadoSegTotal = serie.rows.reduce(
    (acc, r) => acc + parseInt(r.economizado_seg || 0, 10),
    0
  );

  return {
    tempo_economizado_seg_total: tempoEconomizadoSegTotal,
    serie_temporal: serie.rows.map((r) => ({
      mes: `${r.ano}-${String(r.mes).padStart(2, "0")}`,
      manual_estimado_seg: parseInt(r.manual_estimado_seg, 10),
      real_seg: parseInt(r.real_seg, 10),
    })),
    distribuicao_canal: distribuicao.rows.map((r) => ({
      canal: r.nome_canal,
      quantidade: parseInt(r.quantidade, 10),
      percentual: totalAutomacoes > 0 ? Math.round((parseInt(r.quantidade, 10) / totalAutomacoes) * 100) : 0,
    })),
  };
}

module.exports = { roiPorCliente };
