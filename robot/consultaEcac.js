const { spawn } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs/promises");

const PROJETO_ROOT = path.join(__dirname, "..");
const SCRIPT_PATH = path.join(PROJETO_ROOT, "executerRPAEcac.py");
const DECLARACOES_PATH_PADRAO = path.join(PROJETO_ROOT, "declaracoes.json");

// Ponte Node -> Python (mesma responsabilidade de robot/registroEmpresa.js,
// só que o robô em si é escrito em Playwright/Python, não Puppeteer/Node —
// stack diferente porque esse fluxo abre uma janela visível para captcha/2FA
// simulados serem resolvidos manualmente por quem está gravando o vídeo).
//
// stdout/stderr são capturados linha a linha e repassados ao logger (mesmo
// padrão de robot/registroEmpresa.js), que o pipeline usa para publicar cada
// etapa via SSE. `credenciais` é opcional: sem ela, o script cai em
// ECAC_CPF/ECAC_SENHA do .env (fluxo original do menu do webchat); com ela
// (id_cliente_ecac, cpf, senha da página "Consulta e-CAC"), cada execução usa
// um arquivo de saída próprio (evita duas consultas simultâneas colidirem no
// mesmo declaracoes.json).
async function executarConsultaEcac(logger, credenciais = {}) {
  return new Promise((resolve) => {
    const pythonBin = process.env.PYTHON_BIN || "python";
    const arquivoSaida = credenciais.cpf
      ? path.join(PROJETO_ROOT, `declaracoes_${crypto.randomUUID()}.json`)
      : DECLARACOES_PATH_PADRAO;

    logger.log(
      "Abrindo navegador para simulação do eCAC — resolva o captcha/2FA simulados na janela do navegador."
    );

    const processo = spawn(pythonBin, [SCRIPT_PATH, credenciais.cpf || "", credenciais.senha || "", arquivoSaida], {
      cwd: PROJETO_ROOT,
      stdio: ["inherit", "pipe", "pipe"],
    });

    const repassarLinhas = (buffer, prefixo = "") => {
      buffer
        .toString("utf-8")
        .split(/\r?\n/)
        .filter((linha) => linha.trim().length > 0)
        .forEach((linha) => logger.log(`${prefixo}${linha}`));
    };

    processo.stdout.on("data", (chunk) => repassarLinhas(chunk));
    processo.stderr.on("data", (chunk) => repassarLinhas(chunk, "[stderr] "));

    processo.on("error", (erro) => {
      resolve({ success: false, error: `Falha ao iniciar o script Python: ${erro.message}` });
    });

    processo.on("close", async (codigo) => {
      if (codigo !== 0) {
        resolve({ success: false, error: `Script Python encerrou com código ${codigo}.` });
        return;
      }
      try {
        const conteudo = await fs.readFile(arquivoSaida, "utf-8");
        resolve({ success: true, declaracoes: JSON.parse(conteudo) });
      } catch (erro) {
        resolve({ success: false, error: `Script concluiu, mas não encontrei ${path.basename(arquivoSaida)}: ${erro.message}` });
      } finally {
        if (arquivoSaida !== DECLARACOES_PATH_PADRAO) {
          fs.unlink(arquivoSaida).catch(() => {});
        }
      }
    });
  });
}

module.exports = executarConsultaEcac;
