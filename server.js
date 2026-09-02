// server.js
const path = require("path");
const express = require("express");
const cors = require("cors"); // Adicione isso
const executarRegistroEmpresa = require("./robot/registroEmpresa");
const Logger = require("./services/logger");
const hubRouter = require("./hub/router");
const authRouter = require("./auth/router");
const { requireSessaoPagina } = require("./auth/middleware");
const { migrar } = require("./db/migrate");
const { seed } = require("./db/seed");

const app = express();

app.use(cors()); // Ative o CORS aqui
app.use(express.json());

// Portal Web / SSO (spec 02) — protege o dashboard antes do static servir o arquivo
app.use(authRouter);
app.get("/page.html", requireSessaoPagina, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "page.html"));
});

// server.js
app.use(express.static("public")); // Isso faz o arquivo ser encontrado em http://localhost:3000/portal_fake.html

// Hub de Convergência (spec 01) — interface conversacional / webchat
app.use("/hub", hubRouter);

app.post("/registro-empresa", async (req, res) => {
  const dados = req.body;
  const logs = [];

  // O logger que você criou para capturar os passos do robô
  const logger = new Logger((logObj) => {
    console.log(`[ROBO] [${logObj.timestamp}]: ${logObj.message}`); 
  logs.push(logObj.message); // Salva só a mensagem para o frontend
  });

  // Executa o robô real
  const resultado = await executarRegistroEmpresa(dados, logger);

  res.json({
    resultado,
    logs
  });
});

async function iniciar() {
  // Confirma a porta livre ANTES de tocar no banco — o PGlite não suporta
  // dois processos apontando pro mesmo diretório de dados ao mesmo tempo
  // (single-writer, como SQLite); uma segunda instância migrando/gravando
  // em paralelo corrompe o diretório local (já aconteceu durante o desenvolvimento).
  const servidor = app.listen(3000);
  await new Promise((resolve, reject) => {
    servidor.once("listening", resolve);
    servidor.once("error", reject);
  });

  await migrar();
  await seed();

  console.log("Servidor GovFlow rodando em http://localhost:3000");
}

iniciar().catch((erro) => {
  if (erro.code === "EADDRINUSE") {
    console.error("Porta 3000 já está em uso — outra instância do servidor já está rodando. Pare-a antes de iniciar uma nova.");
  } else {
    console.error("Falha ao iniciar o servidor:", erro);
  }
  process.exit(1);
});