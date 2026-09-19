const express = require("express");
const idp = require("./idpMock");
const sessions = require("./sessions");
const tenantStore = require("./tenantStore");
const usuarioRepository = require("../db/repositories/usuarioRepository");
const {
  requireSessaoApi,
  setCookie,
  clearCookie,
  parseCookies,
  COOKIE_SESSAO,
  COOKIE_STATE,
} = require("./middleware");

const router = express.Router();

// ── Mock do IdP Claro ────────────────────────────────────────────────
router.get("/idp/login", (req, res) => {
  const { redirect_uri: redirectUri, state } = req.query;
  res.send(idp.paginaLogin({ redirectUri, state }));
});

router.post("/idp/login", express.urlencoded({ extended: false }), (req, res) => {
  const { redirect_uri: redirectUri, state, nome, escritorio, email } = req.body;

  if (!nome || !escritorio || !email) {
    return res.status(400).send(idp.paginaLogin({ redirectUri, state, erro: "Preencha todos os campos." }));
  }

  const code = idp.gerarCodigo({ nome, escritorio, email });
  res.redirect(`${redirectUri}?code=${code}&state=${state}`);
});

// ── Callback do GovFlow AI (RF01 + RF03) ────────────────────────────
// Login "de verdade": a existência do e-mail na tabela `usuarios` decide o
// caminho. E-mail já cadastrado -> entra na organização já existente
// (o nome do escritório digitado é ignorado, o usuário já pertence a uma).
// E-mail novo -> primeiro acesso: cria a organização e o usuário como "owner".
router.get("/portal/callback", async (req, res) => {
  const { code, state } = req.query;
  const cookies = parseCookies(req);

  if (!state || state !== cookies[COOKIE_STATE]) {
    return res.status(400).send("Falha de segurança: state inválido. Tente entrar novamente em /page.html.");
  }

  const claims = idp.trocarCodigoPorClaims(code);
  if (!claims) {
    return res.status(400).send("Código de autenticação inválido ou expirado. Tente entrar novamente em /page.html.");
  }

  let usuario = await usuarioRepository.buscarPorEmail(claims.email);
  let cliente;

  if (usuario) {
    cliente = await tenantStore.buscarPorId(usuario.id_cliente);
  } else {
    cliente = await tenantStore.resolverOuProvisionar({ escritorio: claims.escritorio, email: claims.email });
    usuario = await usuarioRepository.criar({
      idCliente: cliente.id_cliente,
      nome: claims.nome,
      email: claims.email,
      papel: "owner",
    });
  }

  const token = sessions.criar(cliente.id_cliente, {
    ...claims,
    usuarioId: usuario.id_usuario,
    usuarioNome: usuario.nome,
  });

  clearCookie(res, COOKIE_STATE);
  setCookie(res, COOKIE_SESSAO, token, { maxAgeMs: sessions.SESSAO_TTL_MS });

  res.redirect("/page.html");
});

router.post("/portal/logout", (req, res) => {
  const cookies = parseCookies(req);
  if (cookies[COOKIE_SESSAO]) sessions.destruir(cookies[COOKIE_SESSAO]);
  clearCookie(res, COOKIE_SESSAO);
  res.json({ ok: true });
});

// Exemplo de API protegida (RF05) — o padrão a seguir nas specs 07/08/09.
router.get("/portal/whoami", requireSessaoApi, async (req, res) => {
  const cliente = await tenantStore.buscarPorId(req.clienteId);
  res.json({
    id_cliente: req.clienteId,
    nome_escritorio: cliente ? cliente.nome_escritorio : null,
    email: req.claims ? req.claims.email : null,
    plano_saas: cliente ? cliente.plano_saas : null,
    id_usuario: req.claims ? req.claims.usuarioId : null,
    nome_usuario: req.claims ? req.claims.usuarioNome : null,
  });
});

module.exports = router;
