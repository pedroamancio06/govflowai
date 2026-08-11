// Estado da conversa por usuário (RF05). Em memória por enquanto — sobrevive a
// reconexões do mesmo processo, mas não a um restart do servidor. Vira uma
// tabela real quando a spec 06 (banco de dados) existir.
const ESTADO_INICIAL = "aguardando_servico";

const sessions = new Map();

function sessaoVazia(usuarioId) {
  return {
    usuarioId,
    estado: ESTADO_INICIAL,
    servico: null,
    idProcessamento: null,
  };
}

function getSession(usuarioId) {
  if (!sessions.has(usuarioId)) {
    sessions.set(usuarioId, sessaoVazia(usuarioId));
  }
  return sessions.get(usuarioId);
}

function resetSession(usuarioId) {
  sessions.set(usuarioId, sessaoVazia(usuarioId));
  return sessions.get(usuarioId);
}

module.exports = { getSession, resetSession, ESTADO_INICIAL };
