const crypto = require("crypto");
const Logger = require("../services/logger");
const executarRegistroEmpresa = require("../robot/registroEmpresa");
const eventBus = require("./eventBus");

// TODO(spec 04 — Motor de OCR/NLP): substituir por extração real do arquivo
// recebido. O formato já segue o contrato de saída de docs/specs/04-motor-ocr-nlp.md
// para que a troca não exija mudar o restante do pipeline.
function extrairDadosStub() {
  return {
    cnpj: "12.345.678/0001-90",
    razaoSocial: "TECHGOV SOLUCOES LTDA",
    capitalSocial: "50000",
    socios: [
      { nome: "Pedro Lopes", participacao: "60%" },
      { nome: "Ana Silva", participacao: "40%" },
    ],
  };
}

// TODO(spec 05 — Motor RPA): o protocolo real deve ser capturado do portal
// governamental. Aqui é um placeholder só para o fluxo de chat ficar completo.
function gerarProtocoloFake() {
  const numero = Math.floor(100000 + Math.random() * 900000);
  return `NB-2026-${numero}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// RF07-RF10: dispara o processamento em segundo plano e publica cada etapa
// como um evento proativo (consumido via SSE pelo hub/router.js).
async function iniciarPipeline({ session, arquivo }) {
  const idProcessamento = crypto.randomUUID();
  session.estado = "processando";
  session.idProcessamento = idProcessamento;

  const usuarioId = session.usuarioId;
  const publicar = (texto, tipo = "info", etapa) =>
    eventBus.publish(usuarioId, { idProcessamento, texto, tipo, etapa });

  setImmediate(async () => {
    try {
      publicar(`📄 Documento "${arquivo.originalname}" recebido! Iniciando processamento...`, "info", "recebido");
      await sleep(500);

      publicar("🧠 Extraindo dados do documento (OCR)...", "info", "ocr_iniciado");
      const dados = extrairDadosStub();
      await sleep(900);
      publicar("✅ Dados extraídos com sucesso.", "info", "ocr_concluido");

      publicar("🤖 Robô acessando o portal Redesim...", "info", "rpa_iniciado");
      const logger = new Logger((logObj) => publicar(logObj.message, "info", "rpa_progresso"));

      const resultado = await executarRegistroEmpresa(dados, logger);

      if (resultado.success) {
        const protocolo = gerarProtocoloFake();
        session.estado = "concluido";
        publicar(`✅ Protocolo finalizado: ${protocolo}! Processo concluído com sucesso.`, "sucesso", "concluido");
      } else {
        session.estado = "aguardando_documento";
        publicar(
          `⚠️ Erro no robô: ${resultado.error}. Você pode reenviar o documento para tentar novamente.`,
          "erro",
          "erro"
        );
      }
    } catch (error) {
      session.estado = "aguardando_documento";
      publicar(`⚠️ Falha inesperada no processamento: ${error.message}. Tente reenviar o documento.`, "erro", "erro");
    }
  });

  return idProcessamento;
}

module.exports = { iniciarPipeline };
