const puppeteer = require("puppeteer");
const { govUser, govPassword, govUrl } = require("../config/env");

// Ritmo pensado para apresentação/gravação: dá tempo de acompanhar cada campo
// sendo preenchido com o dado que veio do OCR, em vez de piscar na tela.
const DELAY_DIGITACAO_MS = 90;
const PAUSA_ENTRE_ETAPAS_MS = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executarRegistroEmpresa(dados, logger, protocolo) {
  let browser;

  try {
    logger.log("Abrindo navegador...");

    browser = await puppeteer.launch({
      headless: false,
      slowMo: 60,
    });

    const page = await browser.newPage();
    // Antes hardcoded para localhost:3000 — quebrava silenciosamente se o
    // servidor subisse em outra porta (ex.: 3000 ocupada por outro projeto).
    // Agora respeita GOV_URL do .env, com esse mesmo valor como padrão.
    const urlLocal = govUrl || "http://localhost:3000/portal_fake.html";

    logger.log("Acessando sistema governamental...");
    await page.goto(urlLocal, { waitUntil: "networkidle2" });

    /*
    ======================
    LOGIN
    ======================
    */

    logger.log("Autenticando...");

    // Espera o campo aparecer antes de digitar
    await page.waitForSelector("#username");

    await page.type("#username", govUser, { delay: DELAY_DIGITACAO_MS });
    await page.type("#password", govPassword, { delay: DELAY_DIGITACAO_MS });
    await sleep(PAUSA_ENTRE_ETAPAS_MS);

    await Promise.all([page.click("#login-button"), page.waitForNavigation()]);
    await sleep(PAUSA_ENTRE_ETAPAS_MS);

    /*
    ======================
    NAVEGAR PARA FORMULÁRIO
    ======================
    */

    logger.log("Abrindo formulário de Registro de Empresa...");

    await page.click("#menu-registro-empresa");

    await page.waitForSelector("#form-registro");
    await sleep(PAUSA_ENTRE_ETAPAS_MS);

    /*
    ======================
    PREENCHER CAMPOS (dados extraídos pelo OCR — ver hub/pipeline.js: mapearParaRobo)
    ======================
    */

    logger.log(`Preenchendo CNPJ (extraído do documento): ${dados.cnpj}`);
    await page.type("#cnpj", dados.cnpj, { delay: DELAY_DIGITACAO_MS });
    await sleep(PAUSA_ENTRE_ETAPAS_MS);

    logger.log(`Preenchendo Razão Social (extraída do documento): ${dados.razaoSocial}`);
    await page.type("#razaoSocial", dados.razaoSocial, { delay: DELAY_DIGITACAO_MS });
    await sleep(PAUSA_ENTRE_ETAPAS_MS);

    logger.log("Preenchendo Capital Social...");
    await page.type("#capitalSocial", dados.capitalSocial || "10000", { delay: DELAY_DIGITACAO_MS });
    await sleep(PAUSA_ENTRE_ETAPAS_MS);

    /*
    ======================
    SOCIOS (também extraídos do documento — QSA do OCR)
    ======================
    */

    logger.log("Preenchendo quadro societário (extraído do documento)...");

    for (const socio of dados.socios) {
      logger.log(`Adicionando sócio: ${socio.nome} (${socio.participacao})`);

      await page.click("#add-socio");

      await page.waitForSelector(".socio-row:last-child input.nome");

      const rows = await page.$$(".socio-row");

      const ultimaLinha = rows[rows.length - 1];

      // .type() em vez de setar .value direto — digitação visível, igual aos
      // outros campos, para dar pra acompanhar em apresentação/gravação.
      const inputNome = await ultimaLinha.$("input.nome");
      await inputNome.type(socio.nome, { delay: DELAY_DIGITACAO_MS });

      const inputParticipacao = await ultimaLinha.$("input.participacao");
      await inputParticipacao.type(socio.participacao, { delay: DELAY_DIGITACAO_MS });

      await sleep(PAUSA_ENTRE_ETAPAS_MS);
    }

    logger.log("Formulário preenchido com sucesso!");
    await sleep(PAUSA_ENTRE_ETAPAS_MS);

    /*
    ======================
    SUBMIT
    ======================
    */

    await page.click("#submit-registro");
    await sleep(PAUSA_ENTRE_ETAPAS_MS);

    // Mostra na própria tela o protocolo já gerado no backend (hub/pipeline.js)
    // — mesmo valor que vai pro banco, nunca um número inventado aqui, senão
    // o que aparece no portal divergiria do que fica registrado.
    logger.log(`Protocolo gerado: ${protocolo}`);
    await page.evaluate((numeroProtocolo) => window.mostrarProtocolo(numeroProtocolo), protocolo);
    await sleep(PAUSA_ENTRE_ETAPAS_MS);

    logger.log("Registro enviado!");

    return {
      success: true,
      protocolo,
    };
  } catch (error) {
    logger.log("Erro no robô: " + error.message);

    return {
      success: false,
      error: error.message,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = executarRegistroEmpresa;
