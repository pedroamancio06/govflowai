// DIM_CLIENTE real (Star Schema, docs/TECH-SPEC-MVP.md §3), via db/repositories/clienteRepository.js.
// Mesma interface que a versão em memória anterior (resolverOuProvisionar/buscarPorId),
// agora assíncrona — nenhuma mudança necessária em auth/router.js além de `await`.
module.exports = require("../db/repositories/clienteRepository");
