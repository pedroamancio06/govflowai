const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

// Postgres real compilado para WASM — zero dependência de sistema (Docker/Postgres
// instalado). Troca para AWS RDS em produção é apenas mudar este módulo; toda a
// camada de repositórios (db/repositories/*) usa `db.query(sql, params)`, a mesma
// interface que o driver `pg` (node-postgres) usa contra um Postgres real.
const DATA_DIR = path.join(__dirname, "..", "data", "govflow.pglite");

let instancia = null;

function getDb() {
  if (!instancia) {
    fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true });
    instancia = new PGlite(DATA_DIR);
  }
  return instancia;
}

// PGlite persiste em arquivo mas não tem recuperação tipo WAL contra um kill
// abrupto do processo (SIGKILL) — um encerramento sem passar por aqui pode
// corromper o diretório de dados. SIGTERM/SIGINT (Ctrl+C, stop gracioso) são
// suficientes para chamar isto; SIGKILL/`taskkill /F` não dá chance nenhuma.
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
