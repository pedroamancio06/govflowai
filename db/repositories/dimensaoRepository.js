const { getDb } = require("../connection");

const DIAS_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

// Find-or-create: garante que sempre existe uma linha DIM_TEMPO para "hoje"
// antes de qualquer INSERT na fato.
async function resolverIdTempoHoje() {
  const db = getDb();
  const hoje = new Date();
  const dataCompleta = hoje.toISOString().slice(0, 10);

  const existente = await db.query(`SELECT id_tempo FROM dim_tempo WHERE data_completa = $1`, [dataCompleta]);
  if (existente.rows.length > 0) return existente.rows[0].id_tempo;

  const diaSemana = DIAS_SEMANA[hoje.getUTCDay()];
  const isDiaUtil = hoje.getUTCDay() !== 0 && hoje.getUTCDay() !== 6;

  const inserido = await db.query(
    `INSERT INTO dim_tempo (data_completa, dia, mes, ano, trimestre, dia_semana, is_dia_util)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (data_completa) DO UPDATE SET data_completa = EXCLUDED.data_completa
     RETURNING id_tempo`,
    [
      dataCompleta,
      hoje.getUTCDate(),
      hoje.getUTCMonth() + 1,
      hoje.getUTCFullYear(),
      Math.floor(hoje.getUTCMonth() / 3) + 1,
      diaSemana,
      isDiaUtil,
    ]
  );
  return inserido.rows[0].id_tempo;
}

async function resolverIdCanal(nomeCanal) {
  const db = getDb();
  const r = await db.query(`SELECT id_canal FROM dim_canal WHERE nome_canal = $1`, [nomeCanal]);
  if (r.rows.length === 0) throw new Error(`Canal desconhecido: ${nomeCanal}`);
  return r.rows[0].id_canal;
}

async function resolverServicoPorCodigo(codigo) {
  const db = getDb();
  const r = await db.query(
    `SELECT id_servico_gov, tempo_manual_estimado_padrao_seg FROM dim_servico_gov WHERE codigo = $1`,
    [codigo]
  );
  if (r.rows.length === 0) throw new Error(`Serviço desconhecido: ${codigo}`);
  return r.rows[0];
}

async function resolverIdStatus(nomeStatus) {
  const db = getDb();
  const r = await db.query(`SELECT id_status FROM dim_status WHERE nome_status = $1`, [nomeStatus]);
  if (r.rows.length === 0) throw new Error(`Status desconhecido: ${nomeStatus}`);
  return r.rows[0].id_status;
}

module.exports = { resolverIdTempoHoje, resolverIdCanal, resolverServicoPorCodigo, resolverIdStatus };
