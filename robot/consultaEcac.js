const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs/promises");

const PROJETO_ROOT = path.join(__dirname, "..");
const SCRIPT_PATH = path.join(PROJETO_ROOT, "executerRPAEcac.py");
const DECLARACOES_PATH = path.join(PROJETO_ROOT, "declaracoes.json");

// Ponte Node -> Python (mesma responsabilidade de robot/registroEmpresa.js,
// só que o robô em si é escrito em Playwright/Python, não Puppeteer/Node —
// stack diferente porque esse fluxo simula captcha/2FA em janela visível e
// pausa em input() no terminal, esperando confirmação manual de quem está
// gravando o vídeo de demonstração).
//
// stdio: stdin herdado do processo do servidor Node -> os prompts input() do
// script Python são respondidos no MESMO terminal onde "node server.js" está
// rodando. stdout/stderr são capturados linha a linha e repassados ao logger
// (mesmo padrão de robot/registroEmpresa.js), que o pipeline usa para
// publicar cada etapa via SSE no webchat.
async function executarConsultaEcac(logger) {
  return new Promise((resolve) => {
    const pythonBin = process.env.PYTHON_BIN || "python";

    logger.log(
      "Abrindo navegador para simulação do eCAC — resolva o captcha/2FA simulados na janela e confirme no terminal do servidor quando solicitado."
    );

    const processo = spawn(pythonBin, [SCRIPT_PATH], {
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
        const conteudo = await fs.readFile(DECLARACOES_PATH, "utf-8");
        resolve({ success: true, declaracoes: JSON.parse(conteudo) });
      } catch (erro) {
        resolve({ success: false, error: `Script concluiu, mas não encontrei declaracoes.json: ${erro.message}` });
      }
    });
  });
}

module.exports = executarConsultaEcac;
