const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { getSession, resetSession } = require("./sessionStore");
const { handleTexto, mensagensMenu } = require("./flowEngine");
const { iniciarPipeline, confirmarEnvio, iniciarConsultaEcac, iniciarConsultaEcacParaCliente } = require("./pipeline");
const eventBus = require("./eventBus");
const { requireSessaoApi } = require("../auth/middleware");
const automacaoRepository = require("../db/repositories/automacaoRepository");
const relatorioRepository = require("../db/repositories/relatorioRepository");
const usuarioRepository = require("../db/repositories/usuarioRepository");
const clienteEcacRepository = require("../db/repositories/clienteEcacRepository");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg"];
const TAMANHO_MAXIMO = 15 * 1024 * 1024; // RF01: até 15MB

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const usuarioId = String(req.body.usuario_id || req.clienteId || "anonimo").replace(/[^a-zA-Z0-9_-]/g, "_");
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

  // Consulta e-CAC não passa pelo upload de documento (RF01-RF03 acima) —
  // handleTexto já deixou o estado em "processando" ao escolher o serviço,
  // então dispara o robô aqui (fire-and-forget, evolui via SSE) igual o
  // upload dispara iniciarPipeline em POST /arquivos.
  if (session.servico === "consulta_ecac" && session.estado === "processando" && !session.consultaEcacEmAndamento) {
    session.consultaEcacEmAndamento = true;
    iniciarConsultaEcac(session).finally(() => {
      session.consultaEcacEmAndamento = false;
    });
  }

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

// spec 09 (Freemium): verifica a cota ANTES de aceitar o upload — nunca gasta
// OCR/RPA numa automação que será recusada. Roda antes até do multer, pra nem
// receber o arquivo se o cliente já estourou o limite do mês.
async function bloquearSeCotaExcedida(req, res, next) {
  const consumo = await automacaoRepository.consumoMensalCliente(req.clienteId);
  const usoAtual = parseInt(consumo.automacoes_no_mes, 10) || 0;
  if (usoAtual >= consumo.limite_documentos_mes) {
    return res.status(402).json({
      erro: `Limite de ${consumo.limite_documentos_mes} automações do plano ${consumo.plano_saas} atingido este mês.`,
    });
  }
  next();
}

// Canal Portal Web (autenticado via SSO, spec 02) — dashboard em /page.html.
// Sem menu/estado de conversa: o serviço é sempre "abertura_redesim" (único
// implementado no MVP), então o upload já dispara o pipeline diretamente.
router.post("/portal/arquivos", requireSessaoApi, bloquearSeCotaExcedida, (req, res) => {
  upload.single("arquivo")(req, res, async (err) => {
    if (err) {
      const motivo =
        err.message === "TIPO_INVALIDO"
          ? "Não consegui ler esse arquivo. Envie um PDF, JPG ou PNG."
          : "Arquivo muito grande. O limite é 15MB.";
      return res.status(400).json({ erro: motivo });
    }
    if (!req.file) {
      return res.status(400).json({ erro: "Nenhum arquivo recebido." });
    }

    const usuarioId = `portal-${req.clienteId}`;
    const sessaoPortal = { usuarioId, estado: "processando", servico: "abertura_redesim", idProcessamento: null };

    const idProcessamento = await iniciarPipeline({
      session: sessaoPortal,
      arquivo: req.file,
      idClienteConhecido: req.clienteId,
      canal: "portal_web",
      aguardarConfirmacao: true, // RPA só roda quando o usuário clicar "Enviar ao Gov.br"
    });

    res.status(202).json({ id_processamento: idProcessamento, usuario_id: usuarioId });
  });
});

// Confirmação explícita do usuário — só agora o robô é acionado de verdade
// contra o portal do governo. Nunca dispara sozinho a partir do upload.
// (express.json() já é aplicado globalmente em server.js — não repetir aqui)
router.post("/portal/enviar", requireSessaoApi, async (req, res) => {
  const { id_processamento: idProcessamento } = req.body || {};
  if (!idProcessamento) return res.status(400).json({ erro: "id_processamento é obrigatório" });

  try {
    await confirmarEnvio(idProcessamento, req.clienteId);
    res.status(202).json({ ok: true });
  } catch (error) {
    res.status(404).json({ erro: error.message });
  }
});

// RF01-RF02 (spec 07): histórico de automações do escritório autenticado.
router.get("/portal/automacoes", requireSessaoApi, async (req, res) => {
  const { status = null, pagina = "1" } = req.query;
  const resultado = await automacaoRepository.listarPorCliente(req.clienteId, {
    status: status || null,
    pagina: Math.max(1, parseInt(pagina, 10) || 1),
    tamanho: 20,
  });
  res.json(resultado);
});

// spec 08: gráficos analíticos de ROI (tempo economizado + distribuição por canal).
router.get("/portal/roi", requireSessaoApi, async (req, res) => {
  const dados = await relatorioRepository.roiPorCliente(req.clienteId);
  res.json(dados);
});

// spec 09 (RF02): consumo do plano Freemium no mês corrente.
router.get("/portal/plano", requireSessaoApi, async (req, res) => {
  const consumo = await automacaoRepository.consumoMensalCliente(req.clienteId);
  const agora = new Date();
  res.json({
    plano_saas: consumo.plano_saas,
    limite_mensal: consumo.limite_documentos_mes,
    uso_mes_atual: parseInt(consumo.automacoes_no_mes, 10) || 0,
    periodo: `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, "0")}`,
  });
});

// Gestão de usuários da organização — painel de configurações do dashboard.
router.get("/portal/usuarios", requireSessaoApi, async (req, res) => {
  const usuarios = await usuarioRepository.listarPorCliente(req.clienteId);
  res.json({ itens: usuarios });
});

router.post("/portal/usuarios", requireSessaoApi, async (req, res) => {
  const { nome, email } = req.body || {};
  if (!nome || !email) {
    return res.status(400).json({ erro: "Nome e e-mail são obrigatórios." });
  }

  const existente = await usuarioRepository.buscarPorEmail(email);
  if (existente) {
    return res.status(409).json({ erro: "Já existe um usuário cadastrado com esse e-mail." });
  }

  const usuario = await usuarioRepository.criar({ idCliente: req.clienteId, nome, email, papel: "membro" });
  res.status(201).json(usuario);
});

// Página "Consulta e-CAC" do dashboard: clientes do escritório cadastrados
// para consulta de declarações de IR via e-CAC simulado.
router.get("/portal/ecac/clientes", requireSessaoApi, async (req, res) => {
  const clientes = await clienteEcacRepository.listarPorCliente(req.clienteId);
  res.json({ itens: clientes });
});

router.post("/portal/ecac/clientes", requireSessaoApi, async (req, res) => {
  const { nome, cpf, senha } = req.body || {};
  if (!nome || !cpf || !senha) {
    return res.status(400).json({ erro: "Nome, CPF e senha (simulada) são obrigatórios." });
  }

  const existente = await clienteEcacRepository.buscarPorCpf(req.clienteId, cpf);
  if (existente) {
    return res.status(409).json({ erro: "Já existe um cliente cadastrado com esse CPF." });
  }

  const clienteEcac = await clienteEcacRepository.criar({ idCliente: req.clienteId, nome, cpf, senha });
  res.status(201).json(clienteEcac);
});

router.put("/portal/ecac/clientes/:id", requireSessaoApi, async (req, res) => {
  const { nome, cpf, senha } = req.body || {};
  if (!nome || !cpf) {
    return res.status(400).json({ erro: "Nome e CPF são obrigatórios." });
  }

  const atual = await clienteEcacRepository.buscarPorId(req.params.id, req.clienteId);
  if (!atual) {
    return res.status(404).json({ erro: "Cliente não encontrado." });
  }

  const conflito = await clienteEcacRepository.buscarPorCpf(req.clienteId, cpf);
  if (conflito && conflito.id_cliente_ecac !== req.params.id) {
    return res.status(409).json({ erro: "Já existe outro cliente cadastrado com esse CPF." });
  }

  const atualizado = await clienteEcacRepository.atualizarDados(req.params.id, req.clienteId, { nome, cpf, senha });
  res.json(atualizado);
});

router.delete("/portal/ecac/clientes/:id", requireSessaoApi, async (req, res) => {
  const atual = await clienteEcacRepository.buscarPorId(req.params.id, req.clienteId);
  if (!atual) {
    return res.status(404).json({ erro: "Cliente não encontrado." });
  }
  if (atual.status_consulta === "processando") {
    return res.status(409).json({ erro: "Não é possível excluir um cliente com consulta em andamento." });
  }

  await clienteEcacRepository.deletar(req.params.id, req.clienteId);
  res.status(204).end();
});

// Dispara (ou reprocessa) a consulta e-CAC simulada para um cliente já
// cadastrado. Fire-and-forget: evolui via SSE no mesmo canal do usuário
// logado, igual ao restante do pipeline.
router.post("/portal/ecac/clientes/:id/consultar", requireSessaoApi, async (req, res) => {
  const clienteEcac = await clienteEcacRepository.buscarPorId(req.params.id, req.clienteId);
  if (!clienteEcac) {
    return res.status(404).json({ erro: "Cliente não encontrado." });
  }
  if (clienteEcac.status_consulta === "processando") {
    return res.status(409).json({ erro: "Já existe uma consulta em andamento para esse cliente." });
  }

  const usuarioId = req.claims && req.claims.usuarioId ? req.claims.usuarioId : `portal-${req.clienteId}`;
  iniciarConsultaEcacParaCliente(clienteEcac, usuarioId).catch(() => {});

  res.status(202).json({ ok: true });
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
