const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { getSession, resetSession } = require("./sessionStore");
const { handleTexto, mensagensMenu } = require("./flowEngine");
const { iniciarPipeline } = require("./pipeline");
const eventBus = require("./eventBus");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg"];
const TAMANHO_MAXIMO = 15 * 1024 * 1024; // RF01: até 15MB

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const usuarioId = String(req.body.usuario_id || "anonimo").replace(/[^a-zA-Z0-9_-]/g, "_");
      cb(null, `${usuarioId}_${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: TAMANHO_MAXIMO },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_ACEITOS.includes(file.mimetype)) {
      return cb(new Error("TIPO_INVALIDO"));
    }
    cb(null, true);
  },
});

// Bootstrap da conversa: retorna o menu inicial (RF04) se a sessão for nova.
router.get("/sessao/:usuarioId", (req, res) => {
  const session = getSession(req.params.usuarioId);
  const mensagens = session.estado === "aguardando_servico" ? mensagensMenu() : [];
  res.json({ mensagens, estado: session.estado, servico: session.servico });
});

router.post("/sessao/:usuarioId/reset", (req, res) => {
  const session = resetSession(req.params.usuarioId);
  res.json({ mensagens: mensagensMenu(), estado: session.estado });
});

// RF04-RF06: mensagens de texto (seleção de menu / respostas fora do fluxo esperado)
router.post("/mensagens", (req, res) => {
  const { usuario_id: usuarioId, conteudo } = req.body || {};
  if (!usuarioId) return res.status(400).json({ erro: "usuario_id é obrigatório" });

  const session = getSession(usuarioId);
  const mensagens = handleTexto(session, conteudo);
  res.json({ mensagens, estado: session.estado });
});

// RF01-RF03: recepção de arquivos
router.post("/arquivos", (req, res) => {
  upload.single("arquivo")(req, res, async (err) => {
    const usuarioId = req.body.usuario_id;
    if (!usuarioId) return res.status(400).json({ erro: "usuario_id é obrigatório" });

    const session = getSession(usuarioId);

    if (err) {
      const motivo =
        err.message === "TIPO_INVALIDO"
          ? "Não consegui ler esse arquivo. Envie um PDF, JPG ou PNG."
          : "Arquivo muito grande. O limite é 15MB.";
      return res.status(400).json({ mensagens: [motivo], estado: session.estado });
    }

    if (!req.file) {
      return res.status(400).json({ mensagens: ["Nenhum arquivo recebido."], estado: session.estado });
    }

    if (session.estado !== "aguardando_documento") {
      fs.unlink(req.file.path, () => {});
      const mensagens = handleTexto(session, "");
      return res.status(409).json({ mensagens, estado: session.estado });
    }

    const idProcessamento = await iniciarPipeline({ session, arquivo: req.file });
    res.status(202).json({
      mensagens: ["📄 Recebido! Iniciando o processamento do seu documento..."],
      estado: session.estado,
      id_processamento: idProcessamento,
    });
  });
});

// RF07-RF10: feedback proativo em tempo real via Server-Sent Events
router.get("/eventos/:usuarioId/stream", (req, res) => {
  const { usuarioId } = req.params;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("retry: 2000\n\n");

  const unsubscribe = eventBus.subscribe(usuarioId, (evento) => {
    res.write(`data: ${JSON.stringify(evento)}\n\n`);
  });

  req.on("close", unsubscribe);
});

module.exports = router;
