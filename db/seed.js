const { getDb } = require("./connection");

// Dados de referência (dimensões de baixa cardinalidade). Idempotente via
// ON CONFLICT — seguro rodar a cada boot do servidor.
async function seed() {
  const db = getDb();

  await db.query(`
    INSERT INTO dim_canal (nome_canal, descricao) VALUES
      ('whatsapp', 'Canal WhatsApp Business (piloto)'),
      ('webchat', 'Webchat embutido no site/portal'),
      ('portal_web', 'Acesso via portal web autenticado')
    ON CONFLICT (nome_canal) DO NOTHING;
  `);

  await db.query(`
    INSERT INTO dim_status (nome_status) VALUES
      ('recebido'), ('processando'), ('aguardando_confirmacao'),
      ('pendente_revisao_humana'), ('sucesso'), ('erro')
    ON CONFLICT (nome_status) DO NOTHING;
  `);

  // tempo_manual_estimado_padrao_seg = 2400s (40min) — baseline de referência
  // para o cálculo de ROI (docs/TECH-SPEC-MVP.md §1.1), a validar com dados reais no piloto.
  await db.query(`
    INSERT INTO dim_servico_gov (codigo, nome_servico, orgao_responsavel, tempo_manual_estimado_padrao_seg) VALUES
      ('abertura_redesim', 'Abertura de Empresa (Redesim)', 'Junta Comercial / Redesim', 2400),
      ('consulta_ecac', 'Consulta e-CAC (Declarações de IR)', 'Receita Federal', 900)
    ON CONFLICT (codigo) DO NOTHING;
  `);
}

module.exports = { seed };
