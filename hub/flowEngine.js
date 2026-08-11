// Fluxo guiado (RF04-RF06): máquina de estados simples por sessão.
// aguardando_servico -> aguardando_documento -> processando -> concluido

const SERVICOS = {
  1: { codigo: "abertura_redesim", nome: "Abertura de Empresa (Redesim)", disponivel: true },
  2: { codigo: "consulta_ecac", nome: "Consulta e-CAC", disponivel: false },
};

function mensagensMenu() {
  return [
    [
      "Olá! 👋 Sou o assistente do GovFlow AI.",
      "Qual serviço deseja realizar hoje?",
      "[1] Abertura de Empresa (Redesim)",
      "[2] Consulta e-CAC (em breve)",
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

    session.estado = "aguardando_documento";
    session.servico = escolha.codigo;
    session.idProcessamento = null;

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
