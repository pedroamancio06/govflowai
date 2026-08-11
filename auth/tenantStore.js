const crypto = require("crypto");

// Stand-in para DIM_CLIENTE (spec 06 — banco de dados — ainda não existe).
// Provisiona automaticamente um "escritório" na primeira vez que os claims
// aparecem (RF03), mapeando por e-mail.
const clientesPorChave = new Map();
const clientesPorId = new Map();

function chaveDeClaims(claims) {
  return (claims.email || "").trim().toLowerCase();
}

function resolverOuProvisionar(claims) {
  const chave = chaveDeClaims(claims);
  if (clientesPorChave.has(chave)) {
    return clientesPorChave.get(chave);
  }

  const cliente = {
    id_cliente: crypto.randomUUID(),
    nome_escritorio: claims.escritorio,
    email_admin: claims.email,
    plano_saas: "free",
    criado_em: new Date().toISOString(),
  };

  clientesPorChave.set(chave, cliente);
  clientesPorId.set(cliente.id_cliente, cliente);
  return cliente;
}

function buscarPorId(idCliente) {
  return clientesPorId.get(idCliente) || null;
}

module.exports = { resolverOuProvisionar, buscarPorId };
