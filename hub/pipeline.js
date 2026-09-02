const crypto = require("crypto");
const fs = require("fs/promises");
const Logger = require("../services/logger");
const executarRegistroEmpresa = require("../robot/registroEmpresa");
const eventBus = require("./eventBus");
const clienteRepository = require("../db/repositories/clienteRepository");
const automacaoRepository = require("../db/repositories/automacaoRepository");
const automacoesPendentes = require("./automacoesPendentes");
const { resolverIdTempoHoje, resolverIdCanal, resolverServicoPorCodigo } = require("../db/repositories/dimensaoRepository");

// Motor de OCR/NLP real (spec 04 / TECH-SPEC-MVP.md §2.2) — microserviço Python
// interno, nunca exposto publicamente. Consumido aqui via HTTP simples; vira
// fila real (spec 03) quando o volume justificar desacoplar melhor.
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://localhost:8001";

async function chamarServicoOcr(idProcessamento, arquivo) {
  const buffer = await fs.readFile(arquivo.path);
  const form = new FormData();
  form.append("id_processamento", idProcessamento);
  form.append("arquivo", new Blob([buffer], { type: arquivo.mimetype }), arquivo.originalname);

  const resposta = await fetch(`${OCR_SERVICE_URL}/extrair`, { method: "POST", body: form });
  if (!resposta.ok) {
    throw new Error(`Serviço de OCR respondeu ${resposta.status}`);
  }
  return resposta.json();
}

// Contrato de saída do OCR (snake_case, qsa) -> contrato de entrada do robô
// (camelCase, socios) já existente em robot/registroEmpresa.js.
function mapearParaRobo(dadosOcr) {
  return {
    cnpj: dadosOcr.cnpj ? dadosOcr.cnpj.valor : null,
    razaoSocial: dadosOcr.razao_social ? dadosOcr.razao_social.valor : null,
    capitalSocial: dadosOcr.capital_social ? dadosOcr.capital_social.valor : null,
    socios: (dadosOcr.qsa || []).map((s) => ({ nome: s.nome, participacao: s.participacao })),
  };
}

// O robô não roda sem esses dois campos, independente do que o limiar de
// confiança agregada (calculado sobre TODOS os campos) tenha decidido.
function faltamCamposObrigatorios(dadosOcr) {
  return !dadosOcr.cnpj || !dadosOcr.razao_social;
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

// O canal de chat (webchat) ainda não tem login (spec 02 protege só o portal
// web) — resolve/provisiona um DIM_CLIENTE "sintético" a partir do próprio
// usuarioId, para que a automação sempre tenha um tenant real e mensurável.
// Quando o WhatsApp real entrar (spec 01), o telefone assume esse mesmo papel.
async function resolverClienteDoChat(usuarioId) {
  return clienteRepository.resolverOuProvisionar({
    escritorio: "Atendimento via Webchat (não identificado)",
    email: `${usuarioId}@webchat.govflow.local`,
  });
}

// Etapa de RPA — compartilhada entre o disparo automático (webchat) e o
// disparo por confirmação explícita (portal, ver confirmarEnvio abaixo).
// tempoProcessamentoTotalSeg é OCR + RPA apenas — nunca inclui o tempo em que
// a automação ficou parada esperando o clique de confirmação do usuário,
// senão a métrica de ROI (tempo economizado) ficaria distorcida por quanto
// tempo a pessoa demorou para clicar, não pelo desempenho real do sistema.
async function executarEtapaRpa({ idProcessamento, usuarioId, dados, tempoOcrMs, session }) {
  const publicar = (texto, tipo = "info", etapa, extras = {}) =>
    eventBus.publish(usuarioId, { idProcessamento, texto, tipo, etapa, ...extras });

  publicar("🤖 Robô acessando o portal Redesim...", "info", "rpa_iniciado");
  const inicioRpa = Date.now();
  const logger = new Logger((logObj) => publicar(logObj.message, "info", "rpa_progresso"));

  const resultado = await executarRegistroEmpresa(dados, logger);
  const tempoRpaMs = Date.now() - inicioRpa;
  const tempoProcessamentoTotalSeg = Math.round((tempoOcrMs + tempoRpaMs) / 1000);

  if (resultado.success) {
    const protocolo = gerarProtocoloFake();
    if (session) session.estado = "concluido";
    await automacaoRepository.atualizar(idProcessamento, {
      status: "sucesso",
      protocoloGerado: protocolo,
      tentativasRpa: 1,
      tempoRpaMs,
      tempoProcessamentoTotalSeg,
    });
    publicar(`✅ Protocolo finalizado: ${protocolo}! Processo concluído com sucesso.`, "sucesso", "concluido");
  } else {
    if (session) session.estado = "aguardando_documento";
    await automacaoRepository.atualizar(idProcessamento, {
      status: "erro",
      tentativasRpa: 1,
      tempoRpaMs,
      tempoProcessamentoTotalSeg,
    });
    publicar(
      `⚠️ Erro no robô: ${resultado.error}. Você pode reenviar o documento para tentar novamente.`,
      "erro",
      "erro"
    );
  }
}

// RF07-RF10: dispara o processamento em segundo plano, publica cada etapa
// como evento proativo (SSE) e persiste o ciclo de vida na tabela fato
// (docs/TECH-SPEC-MVP.md §3).
//
// `idClienteConhecido` é usado pelo canal Portal Web (autenticado via SSO,
// spec 02) para vincular a automação ao DIM_CLIENTE real da sessão — sem
// isso, cairia no mesmo caminho do webchat e criaria um cliente sintético
// duplicado. Omitido (default), mantém o comportamento original do webchat.
//
// `aguardarConfirmacao: true` faz o pipeline PARAR logo após o OCR bem-sucedido
// (não aciona o robô sozinho) — usado pelo Portal Web, onde "Enviar ao Gov.br"
// é uma ação humana explícita antes de qualquer coisa acontecer no portal do
// governo. O webchat mantém o comportamento automático original (RF07-RF09 da
// spec 01 pressupõem o fluxo hands-off).
async function iniciarPipeline({ session, arquivo, idClienteConhecido = null, canal = "webchat", aguardarConfirmacao = false }) {
  const idProcessamento = crypto.randomUUID();
  session.estado = "processando";
  session.idProcessamento = idProcessamento;

  const usuarioId = session.usuarioId;
  const publicar = (texto, tipo = "info", etapa, extras = {}) =>
    eventBus.publish(usuarioId, { idProcessamento, texto, tipo, etapa, ...extras });

  setImmediate(async () => {
    try {
      const [cliente, idTempo, idCanal, servico] = await Promise.all([
        idClienteConhecido ? clienteRepository.buscarPorId(idClienteConhecido) : resolverClienteDoChat(usuarioId),
        resolverIdTempoHoje(),
        resolverIdCanal(canal),
        resolverServicoPorCodigo(session.servico),
      ]);

      await automacaoRepository.criar({
        idProcessamento,
        idTempo,
        idCliente: cliente.id_cliente,
        idCanal,
        idServicoGov: servico.id_servico_gov,
        tempoManualEstimadoSeg: servico.tempo_manual_estimado_padrao_seg,
      });

      publicar(`📄 Documento "${arquivo.originalname}" recebido! Iniciando processamento...`, "info", "recebido");
      await sleep(300);

      publicar("🧠 Extraindo dados do documento (OCR)...", "info", "ocr_iniciado");
      const inicioOcr = Date.now();
      const resultadoOcr = await chamarServicoOcr(idProcessamento, arquivo);
      const tempoOcrMs = Date.now() - inicioOcr;
      const confiancaPct = Math.round((resultadoOcr.confianca_agregada || 0) * 100);

      await automacaoRepository.atualizar(idProcessamento, {
        tipoDocumento: resultadoOcr.tipo_documento,
        confiancaOcr: resultadoOcr.confianca_agregada,
        tempoOcrMs,
      });

      if (resultadoOcr.status === "documento_ilegivel") {
        session.estado = "aguardando_documento";
        await automacaoRepository.atualizar(idProcessamento, {
          status: "erro",
          tempoProcessamentoTotalSeg: Math.round(tempoOcrMs / 1000),
        });
        publicar(
          "⚠️ Não consegui ler esse documento com confiança suficiente. Envie uma foto mais nítida ou um PDF de melhor qualidade.",
          "erro",
          "erro"
        );
        return;
      }

      if (resultadoOcr.status === "pendente_revisao_humana" || faltamCamposObrigatorios(resultadoOcr.dados || {})) {
        session.estado = "aguardando_documento";
        await automacaoRepository.atualizar(idProcessamento, {
          status: "pendente_revisao_humana",
          tempoProcessamentoTotalSeg: Math.round(tempoOcrMs / 1000),
        });
        publicar(
          `⚠️ Extraí os dados, mas com confiança de ${confiancaPct}% — abaixo do necessário para seguir automaticamente. ` +
            "Reenvie um documento mais legível para eu tentar novamente.",
          "erro",
          "erro"
        );
        return;
      }

      const dados = mapearParaRobo(resultadoOcr.dados);
      publicar(`✅ Dados extraídos com sucesso (confiança ${confiancaPct}%).`, "info", "ocr_concluido", {
        dadosExtraidos: resultadoOcr.dados,
        tipoDocumento: resultadoOcr.tipo_documento,
        confiancaAgregada: resultadoOcr.confianca_agregada,
      });

      if (aguardarConfirmacao) {
        automacoesPendentes.salvar(idProcessamento, { usuarioId, idCliente: cliente.id_cliente, dados, tempoOcrMs });
        session.estado = "aguardando_confirmacao";
        await automacaoRepository.atualizar(idProcessamento, { status: "aguardando_confirmacao" });
        publicar(
          "✋ Dados prontos para envio. Confira e clique em \"Enviar ao Gov.br\" quando quiser acionar o robô.",
          "info",
          "aguardando_confirmacao"
        );
        return;
      }

      await executarEtapaRpa({ idProcessamento, usuarioId, dados, tempoOcrMs, session });
    } catch (error) {
      session.estado = "aguardando_documento";
      publicar(`⚠️ Falha inesperada no processamento: ${error.message}. Tente reenviar o documento.`, "erro", "erro");
    }
  });

  return idProcessamento;
}

// Chamada pela confirmação explícita do usuário ("Enviar ao Gov.br", Portal Web).
// `idClienteEsperado` garante isolamento multi-tenant — ninguém aciona o robô
// de uma automação que não é do próprio escritório, mesmo sabendo o id_processamento.
async function confirmarEnvio(idProcessamento, idClienteEsperado) {
  const pendente = automacoesPendentes.buscar(idProcessamento);
  if (!pendente) {
    throw new Error("Automação não encontrada ou já processada.");
  }
  if (pendente.idCliente !== idClienteEsperado) {
    throw new Error("Automação não pertence a este usuário.");
  }

  automacoesPendentes.remover(idProcessamento);

  setImmediate(() => {
    executarEtapaRpa({
      idProcessamento,
      usuarioId: pendente.usuarioId,
      dados: pendente.dados,
      tempoOcrMs: pendente.tempoOcrMs,
    }).catch((error) => {
      eventBus.publish(pendente.usuarioId, {
        idProcessamento,
        texto: `⚠️ Falha inesperada ao acionar o robô: ${error.message}.`,
        tipo: "erro",
        etapa: "erro",
      });
    });
  });
}

module.exports = { iniciarPipeline, confirmarEnvio };
