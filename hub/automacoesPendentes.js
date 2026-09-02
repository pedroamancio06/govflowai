// Guarda, em memória, automações que já passaram pelo OCR (confiança >= limiar)
// e estão aguardando confirmação explícita do usuário antes de acionar o RPA
// — ação com efeito real no portal do governo, não deve disparar sozinha.
// Efêmero por natureza (expira ao ser confirmada ou ao servidor reiniciar);
// não precisa de tabela própria no banco.
const pendentes = new Map();

function salvar(idProcessamento, info) {
  pendentes.set(idProcessamento, { ...info, criadoEm: Date.now() });
}

function buscar(idProcessamento) {
  return pendentes.get(idProcessamento) || null;
}

function remover(idProcessamento) {
  pendentes.delete(idProcessamento);
}

module.exports = { salvar, buscar, remover };
