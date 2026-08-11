const crypto = require("crypto");
const sessions = require("./sessions");

const COOKIE_SESSAO = "govflow_sessao";
const COOKIE_STATE = "govflow_oauth_state";

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((par) => {
    const idx = par.indexOf("=");
    if (idx === -1) return;
    const nome = par.slice(0, idx).trim();
    const valor = par.slice(idx + 1).trim();
    cookies[nome] = decodeURIComponent(valor);
  });
  return cookies;
}

function setCookie(res, nome, valor, opcoes = {}) {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (opcoes.maxAgeMs) partes.push(`Max-Age=${Math.floor(opcoes.maxAgeMs / 1000)}`);
  // NFR: token de sessão nunca em URL; cookie httpOnly. `Secure` exige HTTPS —
  // ligar em produção (atrás de TLS), aqui em localhost/http fica desligado.
  if (process.env.NODE_ENV === "production") partes.push("Secure");
  res.append("Set-Cookie", partes.join("; "));
}

function clearCookie(res, nome) {
  res.append("Set-Cookie", `${nome}=; Path=/; HttpOnly; Max-Age=0`);
}

function resolverSessao(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_SESSAO];
  return token ? sessions.validar(token) : null;
}

// NFR: auditoria — todo acesso ao dashboard gera log (quem, quando, de onde).
function auditar(req, sessao) {
  console.log(
    `[AUDITORIA] ${new Date().toISOString()} cliente=${sessao.idCliente} rota=${req.originalUrl} ip=${req.ip}`
  );
}

// RF02: sem sessão válida, inicia o Authorization Code flow contra o IdP Claro (simulado).
function iniciarLoginSSO(req, res) {
  const state = crypto.randomBytes(16).toString("hex");
  setCookie(res, COOKIE_STATE, state, { maxAgeMs: 5 * 60 * 1000 });
  res.redirect(`/idp/login?redirect_uri=/portal/callback&state=${state}`);
}

// Protege páginas HTML: sem sessão, redireciona para o login (não quebra a navegação).
function requireSessaoPagina(req, res, next) {
  const sessao = resolverSessao(req);
  if (!sessao) return iniciarLoginSSO(req, res);
  req.clienteId = sessao.idCliente;
  req.claims = sessao.claims;
  auditar(req, sessao);
  next();
}

// RF05: protege APIs do dashboard — sem sessão, 401 JSON (nunca redireciona um fetch/XHR).
// Toda API futura do dashboard (specs 07/08/09) deve usar este middleware, nunca
// aceitar id_cliente vindo do client.
function requireSessaoApi(req, res, next) {
  const sessao = resolverSessao(req);
  if (!sessao) return res.status(401).json({ erro: "sessao_invalida" });
  req.clienteId = sessao.idCliente;
  req.claims = sessao.claims;
  auditar(req, sessao);
  next();
}

module.exports = {
  requireSessaoPagina,
  requireSessaoApi,
  iniciarLoginSSO,
  setCookie,
  clearCookie,
  parseCookies,
  COOKIE_SESSAO,
  COOKIE_STATE,
};
