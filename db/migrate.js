const fs = require("fs");
const path = require("path");
const { getDb } = require("./connection");

async function migrar() {
  const db = getDb();
  const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await db.exec(schemaSql);
}

module.exports = { migrar };
