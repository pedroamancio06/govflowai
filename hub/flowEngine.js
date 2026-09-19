// Fluxo guiado (RF04-RF06): máquina de estados simples por sessão.
// aguardando_servico -> aguardando_documento -> processando -> concluido

const SERVICOS = {
  1: { codigo: "abertura_redesim", nome: "Abertura de Empresa (Redesim)", disponivel: true, exigeDocumento: true },
  2: { codigo: "consulta_ecac", nome: "Consulta e-CAC", disponivel: true, exigeDocumento: false },
};

function mensagensMenu() {
  return [
    [
      "Olá! 👋 Sou o assistente do GovFlow AI.",
      "Qual serviço deseja realizar hoje?",
      "[1] Abertura de Empresa (Redesim)",
      "[2] Consulta e-CAC",
    ].join("\n"),
  ];
}

function handleTexto(session, textoRecebido) {
  const conteudo = (textoRecebido || "").trim();

  if (session.estado === "aguardando_servico" || session.estado === "concluido") {
    const escolha = SERVICOS[conteudo];

    if (!escolha) {
      return session.estado === "concluido"
        ? ["Deseja iniciar um novo atendimento?", ...mensagensMenu()]
        : mensagensMenu();
    }

    if (!escolha.disponivel) {
      return [`O serviço "${escolha.nome}" ainda não está disponível nesta versão. Em breve! 🚧`, ...mensagensMenu()];
    }

    session.servico = escolha.codigo;
    session.idProcessamento = null;

    if (!escolha.exigeDocumento) {
      // Consulta e-CAC: sem upload de documento — dispara o robô direto
      // (hub/router.js observa esse estado e chama iniciarConsultaEcac).
      session.estado = "processando";
      return [
        `Perfeito! Vamos iniciar: ${escolha.nome}.`,
        "🤖 Vou abrir o navegador para a simulação do eCAC. Acompanhe aqui as etapas — em alguns pontos (captcha/2FA simulados) será preciso confirmar manualmente no terminal do servidor.",
      ];
    }

    session.estado = "aguardando_documento";
    return [
      `Perfeito! Vamos iniciar: ${escolha.nome}.`,
      "📎 Envie o PDF ou foto do Contrato Social (PDF, JPG ou PNG, até 15MB) para eu começar.",
    ];
  }

  if (session.estado === "aguardando_documento") {
    return ["Ainda estou aguardando o documento 📎 (PDF, JPG ou PNG) para continuar. Envie o arquivo quando estiver pronto."];
  }

  if (session.estado === "processando") {
    return ["⏳ Sua solicitação já está em processamento. Vou te avisando por aqui a cada etapa — só aguardar!"];
  }

  return mensagensMenu();
}

module.exports = { handleTexto, mensagensMenu, SERVICOS };
