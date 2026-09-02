const crypto = require("crypto");
const { getDb } = require("../connection");

// Substitui o Map em memória de auth/tenantStore.js (DIM_CLIENTE real).
// RF03 da spec 02: resolve por e-mail; provisiona automaticamente se não existir.
async function resolverOuProvisionar(claims) {
  const db = getDb();
  const email = (claims.email || "").trim().toLowerCase();

  const existente = await db.query(`SELECT * FROM dim_cliente WHERE email_admin = $1`, [email]);
  if (existente.rows.length > 0) return existente.rows[0];

  const idCliente = crypto.randomUUID();
  const inserido = await db.query(
    `INSERT INTO dim_cliente (id_cliente, nome_escritorio, email_admin, plano_saas, limite_documentos_mes)
     VALUES ($1, $2, $3, 'free', 5)
     ON CONFLICT (email_admin) DO UPDATE SET email_admin = EXCLUDED.email_admin
     RETURNING *`,
    [idCliente, claims.escritorio, email]
  );
  return inserido.rows[0];
}

async function buscarPorId(idCliente) {
  const db = getDb();
  const r = await db.query(`SELECT * FROM dim_cliente WHERE id_cliente = $1`, [idCliente]);
  return r.rows[0] || null;
}

module.exports = { resolverOuProvisionar, buscarPorId };
