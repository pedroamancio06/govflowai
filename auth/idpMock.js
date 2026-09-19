const crypto = require("crypto");

// Simulador do Identity Provider do ecossistema Claro (Authorization Code flow,
// padrão OIDC). Numa integração real isso é o IdP da Claro — aqui é um stand-in
// local que implementa o mesmo protocolo para permitir demonstrar o SSO ponta
// a ponta (RF01). Trocar por um provedor OIDC/SAML real é uma troca de
// implementação deste único módulo, sem impacto no restante da spec.
const CODIGO_TTL_MS = 60 * 1000;
const codigosPendentes = new Map();

function paginaLogin({ redirectUri, state, erro }) {
  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8" />
<title>Login — Identity Provider Claro (simulado)</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: sans-serif; background:#0e1a0c; color:#fff; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
  .box { background:#132b0f; padding:32px; border-radius:12px; width:320px; border:1px solid #2d5a27; }
  .box h1 { font-size:1rem; margin-bottom:4px; }
  .box p { font-size:0.75rem; color:#9db99a; margin-bottom:20px; }
  label { font-size:0.75rem; display:block; margin-bottom:6px; color:#dcefd9; }
  input { width:100%; padding:8px 10px; margin-bottom:14px; border-radius:6px; border:1px solid #2d5a27; background:#0e1a0c; color:#fff; }
  button { width:100%; padding:10px; background:#2d5a27; color:#fff; border:none; border-radius:6px; font-weight:700; cursor:pointer; }
  button:hover { background:#3d7a35; }
  .erro { color:#f87171; font-size:0.75rem; margin-bottom:12px; }
  .badge { display:inline-block; font-size:0.65rem; background:#3d7a35; padding:3px 8px; border-radius:100px; margin-bottom:14px; }
</style>
</head>
<body>
  <div class="box">
    <span class="badge">SIMULAÇÃO — IdP Claro</span>
    <h1>Entrar no ecossistema Claro</h1>
    <p>Autentique-se para acessar o GovFlow AI via SSO.</p>
    ${erro ? `<div class="erro">${erro}</div>` : ""}
    <form method="POST" action="/idp/login">
      <input type="hidden" name="redirect_uri" value="${redirectUri || ""}" />
      <input type="hidden" name="state" value="${state || ""}" />
      <label>Seu nome</label>
      <input type="text" name="nome" placeholder="Ex: Roberto Silva" required />
      <label>Nome do escritório</label>
      <input type="text" name="escritorio" placeholder="Ex: Contabilidade Roberto & Associados" required />
      <label>E-mail corporativo</label>
      <input type="email" name="email" placeholder="roberto@escritorio.com.br" required />
      <p style="font-size:0.68rem;color:#6b8a68;margin:-8px 0 14px;">Se seu e-mail já foi cadastrado por alguém da sua organização, o nome do escritório acima é ignorado — você entra direto na organização existente.</p>
      <button type="submit">Entrar com Claro ID</button>
    </form>
  </div>
</body>
</html>`;
}

function gerarCodigo(claims) {
  const code = crypto.randomBytes(20).toString("hex");
  codigosPendentes.set(code, { claims, expiraEm: Date.now() + CODIGO_TTL_MS });
  return code;
}

// Uso único: o code some do mapa assim que trocado, mesmo que a troca falhe por expiração.
function trocarCodigoPorClaims(code) {
  const entrada = codigosPendentes.get(code);
  if (!entrada) return null;
  codigosPendentes.delete(code);
  if (Date.now() > entrada.expiraEm) return null;
  return entrada.claims;
}

module.exports = { paginaLogin, gerarCodigo, trocarCodigoPorClaims };
