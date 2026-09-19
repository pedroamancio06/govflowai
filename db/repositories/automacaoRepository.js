const { getDb } = require("../connection");
const { resolverIdStatus } = require("./dimensaoRepository");

async function criar({ idProcessamento, idTempo, idCliente, idCanal, idServicoGov, tempoManualEstimadoSeg }) {
  const db = getDb();
  const idStatusInicial = await resolverIdStatus("recebido");

  const r = await db.query(
    `INSERT INTO fato_processamento_automacoes
       (id_processamento, id_tempo, id_cliente, id_canal, id_servico_gov, id_status, tempo_manual_estimado_seg)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [idProcessamento, idTempo, idCliente, idCanal, idServicoGov, idStatusInicial, tempoManualEstimadoSeg]
  );
  return r.rows[0];
}

const MAPA_COLUNAS = {
  status: null, // tratado à parte (resolve nome -> id_status)
  categoriaErro: "categoria_erro",
  tipoDocumento: "tipo_documento",
  confiancaOcr: "confianca_ocr",
  tempoOcrMs: "tempo_ocr_ms",
  tempoRpaMs: "tempo_rpa_ms",
  protocoloGerado: "protocolo_gerado",
  tentativasRpa: "tentativas_rpa",
  tempoProcessamentoTotalSeg: "tempo_processamento_total_seg",
};

// Atualização parcial — só altera as colunas presentes em `campos`.
async function atualizar(idProcessamento, campos) {
  const db = getDb();
  const sets = [];
  const valores = [];
  let i = 1;

  if (campos.status) {
    sets.push(`id_status = $${i++}`);
    valores.push(await resolverIdStatus(campos.status));
  }

  for (const [chave, coluna] of Object.entries(MAPA_COLUNAS)) {
    if (coluna && Object.prototype.hasOwnProperty.call(campos, chave)) {
      sets.push(`${coluna} = $${i++}`);
      valores.push(campos[chave]);
    }
  }

  if (sets.length === 0) return;

  sets.push(`atualizado_em = now()`);
  valores.push(idProcessamento);

  await db.query(
    `UPDATE fato_processamento_automacoes SET ${sets.join(", ")} WHERE id_processamento = $${i}`,
    valores
  );
}

async function buscarPorId(idProcessamento) {
  const db = getDb();
  const r = await db.query(
    `SELECT f.*, s.nome_status, c.nome_canal, g.nome_servico
     FROM fato_processamento_automacoes f
     JOIN dim_status s ON s.id_status = f.id_status
     JOIN dim_canal c ON c.id_canal = f.id_canal
     JOIN dim_servico_gov g ON g.id_servico_gov = f.id_servico_gov
     WHERE f.id_processamento = $1`,
    [idProcessamento]
  );
  return r.rows[0] || null;
}

// RF01-RF02 (spec 07): histórico paginado de automações do escritório autenticado.
// Filtro por status opcional; sempre restrito a id_cliente (isolamento multi-tenant).
async function listarPorCliente(idCliente, { status = null, pagina = 1, tamanho = 20 } = {}) {
  const db = getDb();
  const offset = (pagina - 1) * tamanho;

  const condicoes = ["f.id_cliente = $1"];
  const params = [idCliente];
  let i = 2;

  if (status) {
    condicoes.push(`s.nome_status = $${i++}`);
    params.push(status);
  }
  const whereClause = condicoes.join(" AND ");

  const itens = await db.query(
    `SELECT f.id_processamento, f.protocolo_gerado, f.confianca_ocr, f.tipo_documento,
            f.tempo_processamento_total_seg, f.categoria_erro, f.criado_em,
            s.nome_status, c.nome_canal, g.nome_servico
     FROM fato_processamento_automacoes f
     JOIN dim_status s ON s.id_status = f.id_status
     JOIN dim_canal c ON c.id_canal = f.id_canal
     JOIN dim_servico_gov g ON g.id_servico_gov = f.id_servico_gov
     WHERE ${whereClause}
     ORDER BY f.criado_em DESC
     LIMIT $${i++} OFFSET $${i}`,
    [...params, tamanho, offset]
  );

  const total = await db.query(
    `SELECT COUNT(*) AS total
     FROM fato_processamento_automacoes f
     JOIN dim_status s ON s.id_status = f.id_status
     WHERE ${whereClause}`,
    params
  );

  return { itens: itens.rows, total: parseInt(total.rows[0].total, 10), pagina, tamanho };
}

async function consumoMensalCliente(idCliente) {
  const db = getDb();
  const agora = new Date();
  const r = await db.query(
    `SELECT automacoes_no_mes, limite_documentos_mes, plano_saas
     FROM vw_consumo_mensal_cliente
     WHERE id_cliente = $1 AND ano = $2 AND mes = $3`,
    [idCliente, agora.getUTCFullYear(), agora.getUTCMonth() + 1]
  );
  return r.rows[0] || { automacoes_no_mes: 0, limite_documentos_mes: 5, plano_saas: "free" };
}

module.exports = { criar, atualizar, buscarPorId, listarPorCliente, consumoMensalCliente };
