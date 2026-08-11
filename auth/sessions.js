const crypto = require("crypto");

// RF04: sessão expira, mas é renovada (sliding window) a cada acesso válido.
const SESSAO_TTL_MS = 30 * 60 * 1000; // 30 min

const sessoes = new Map();

function criar(idCliente, claims) {
  const token = crypto.randomBytes(32).toString("hex");
  sessoes.set(token, {
    idCliente,
    claims,
    criadoEm: Date.now(),
    expiraEm: Date.now() + SESSAO_TTL_MS,
  });
  return token;
}

function validar(token) {
  const sessao = sessoes.get(token);
  if (!sessao) return null;
  if (Date.now() > sessao.expiraEm) {
    sessoes.delete(token);
    return null;
  }
  sessao.expiraEm = Date.now() + SESSAO_TTL_MS;
  return sessao;
}

function destruir(token) {
  sessoes.delete(token);
}

module.exports = { criar, validar, destruir, SESSAO_TTL_MS };
