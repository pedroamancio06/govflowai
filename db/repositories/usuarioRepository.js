const crypto = require("crypto");
const { getDb } = require("../connection");

// Login "real" (spec de gestão de usuários): a existência de um usuário na
// tabela `usuarios` é que decide se o login é aceito como um usuário já
// conhecido (organização existente) ou como primeiro acesso (bootstrap de
// uma organização nova) — ver auth/router.js.

async function buscarPorEmail(email) {
  const db = getDb();
  const r = await db.query(`SELECT * FROM usuarios WHERE email = $1`, [(email || "").trim().toLowerCase()]);
  return r.rows[0] || null;
}

async function listarPorCliente(idCliente) {
  const db = getDb();
  const r = await db.query(
    `SELECT id_usuario, nome, email, papel, criado_em
     FROM usuarios WHERE id_cliente = $1 ORDER BY criado_em ASC`,
    [idCliente]
  );
  return r.rows;
}

async function criar({ idCliente, nome, email, papel = "membro" }) {
  const db = getDb();
  const idUsuario = crypto.randomUUID();
  const r = await db.query(
    `INSERT INTO usuarios (id_usuario, id_cliente, nome, email, papel)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_usuario, nome, email, papel, criado_em`,
    [idUsuario, idCliente, nome, (email || "").trim().toLowerCase(), papel]
  );
  return r.rows[0];
}

module.exports = { buscarPorEmail, listarPorCliente, criar };
