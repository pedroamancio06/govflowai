const fs = require("fs");
const path = require("path");

// Duas implementações atrás da mesma interface { query(sql, params), exec(sql), close() }:
//   - DATABASE_URL definida  -> Postgres real (Neon/AWS RDS/etc.) via `pg`
//   - DATABASE_URL vazia     -> PGlite local (Postgres/WASM embutido), para dev sem rede
// Repositórios (db/repositories/*) só chamam `db.query(sql, params)` — nunca sabem
// qual dos dois está por trás.
const DATABASE_URL = process.env.DATABASE_URL;
const DATA_DIR = path.join(__dirname, "..", "data", "govflow.pglite");

let instancia = null;

function criarInstanciaCloud() {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: DATABASE_URL });
  return {
    query: (sql, params) => pool.query(sql, params),
    exec: (sql) => pool.query(sql), // protocolo simples do pg roda múltiplos statements sem params
    close: () => pool.end(),
  };
}

function criarInstanciaLocal() {
  const { PGlite } = require("@electric-sql/pglite");
  fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true });
  const pglite = new PGlite(DATA_DIR);
  return {
    query: (sql, params) => pglite.query(sql, params),
    exec: (sql) => pglite.exec(sql),
    close: () => pglite.close(),
  };
}

function getDb() {
  if (!instancia) {
    instancia = DATABASE_URL ? criarInstanciaCloud() : criarInstanciaLocal();
  }
  return instancia;
}

// PGlite local não tem recuperação tipo WAL contra um kill abrupto do processo
// (SIGKILL) — um encerramento sem passar por aqui pode corromper o diretório de
// dados. SIGTERM/SIGINT (Ctrl+C, stop gracioso) são suficientes; SIGKILL/`taskkill /F`
// não dá chance nenhuma. Contra o Postgres em nuvem isso não é um risco (o servidor
// real trata conexões derrubadas normalmente), mas fechar o pool continua sendo boa prática.
async function fechar() {
  if (instancia) {
    await instancia.close();
    instancia = null;
  }
}

process.on("SIGINT", async () => {
  await fechar();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await fechar();
  process.exit(0);
});

module.exports = { getDb, fechar };
