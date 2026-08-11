// server.js
const path = require("path");
const express = require("express");
const cors = require("cors"); // Adicione isso
const executarRegistroEmpresa = require("./robot/registroEmpresa");
const Logger = require("./services/logger");
const hubRouter = require("./hub/router");
const authRouter = require("./auth/router");
const { requireSessaoPagina } = require("./auth/middleware");

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

app.listen(3000, () => {
  console.log("Servidor GovFlow rodando em http://localhost:3000");
});