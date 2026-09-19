const crypto = require("crypto");
const { getDb } = require("../connection");

// Clientes do escritório cadastrados para consulta de IR via e-CAC simulado
// (página "Consulta e-CAC" do dashboard) — ver db/schema.sql (clientes_ecac).

async function listarPorCliente(idCliente) {
  const db = getDb();
  const r = await db.query(
    `SELECT id_cliente_ecac, nome, cpf, status_consulta, declaracoes, erro_mensagem, atualizado_em, criado_em
     FROM clientes_ecac WHERE id_cliente = $1 ORDER BY criado_em ASC`,
    [idCliente]
  );
  return r.rows;
}

async function buscarPorId(idClienteEcac, idCliente) {
  const db = getDb();
  const r = await db.query(
    `SELECT * FROM clientes_ecac WHERE id_cliente_ecac = $1 AND id_cliente = $2`,
    [idClienteEcac, idCliente]
  );
  return r.rows[0] || null;
}

async function buscarPorCpf(idCliente, cpf) {
  const db = getDb();
  const r = await db.query(`SELECT * FROM clientes_ecac WHERE id_cliente = $1 AND cpf = $2`, [idCliente, cpf]);
  return r.rows[0] || null;
}

async function criar({ idCliente, nome, cpf, senha }) {
  const db = getDb();
  const id = crypto.randomUUID();
  const r = await db.query(
    `INSERT INTO clientes_ecac (id_cliente_ecac, id_cliente, nome, cpf, senha_simulada)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_cliente_ecac, nome, cpf, status_consulta, declaracoes, erro_mensagem, atualizado_em, criado_em`,
    [id, idCliente, nome, cpf, senha]
  );
  return r.rows[0];
}

async function atualizarStatus(idClienteEcac, { status, declaracoes = null, erroMensagem = null }) {
  const db = getDb();
  await db.query(
    `UPDATE clientes_ecac
     SET status_consulta = $2, declaracoes = $3, erro_mensagem = $4, atualizado_em = now()
     WHERE id_cliente_ecac = $1`,
    [idClienteEcac, status, declaracoes ? JSON.stringify(declaracoes) : null, erroMensagem]
  );
}

// senha vazia/ausente mantém a senha_simulada atual (edição sem trocar credencial).
async function atualizarDados(idClienteEcac, idCliente, { nome, cpf, senha }) {
  const db = getDb();
  const r = await db.query(
    `UPDATE clientes_ecac
     SET nome = $3, cpf = $4, senha_simulada = COALESCE(NULLIF($5, ''), senha_simulada)
     WHERE id_cliente_ecac = $1 AND id_cliente = $2
     RETURNING id_cliente_ecac, nome, cpf, status_consulta, declaracoes, erro_mensagem, atualizado_em, criado_em`,
    [idClienteEcac, idCliente, nome, cpf, senha || ""]
  );
  return r.rows[0] || null;
}

async function deletar(idClienteEcac, idCliente) {
  const db = getDb();
  const r = await db.query(
    `DELETE FROM clientes_ecac WHERE id_cliente_ecac = $1 AND id_cliente = $2 RETURNING id_cliente_ecac`,
    [idClienteEcac, idCliente]
  );
  return r.rows.length > 0;
}

module.exports = { listarPorCliente, buscarPorId, buscarPorCpf, criar, atualizarStatus, atualizarDados, deletar };
