const puppeteer = require("puppeteer");
const { govUser, govPassword, govUrl } = require("../config/env");

async function executarRegistroEmpresa(dados, logger) {
  let browser;

  try {
    logger.log("Abrindo navegador...");

    browser = await puppeteer.launch({
      headless: false,
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

    await page.type("#username", govUser, { delay: 100 });
    await page.type("#password", govPassword, { delay: 100 });

    await Promise.all([page.click("#login-button"), page.waitForNavigation()]);

    /*
    ======================
    NAVEGAR PARA FORMULÁRIO
    ======================
    */

    logger.log("Abrindo formulário de Registro de Empresa...");

    await page.click("#menu-registro-empresa");

    await page.waitForSelector("#form-registro");

    /*
    ======================
    PREENCHER CAMPOS
    ======================
    */

    logger.log("Preenchendo CNPJ...");
    await page.type("#cnpj", dados.cnpj, { delay: 100 });

    logger.log("Preenchendo Razão Social...");
    await page.type("#razaoSocial", dados.razaoSocial, { delay: 100 });

    logger.log("Preenchendo Capital Social...");
    await page.type("#capitalSocial", dados.capitalSocial || "10000");

    /*
    ======================
    SOCIOS
    ======================
    */

    logger.log("Preenchendo quadro societário...");

    for (const socio of dados.socios) {
      logger.log(`Adicionando sócio: ${socio.nome}`);

      await page.click("#add-socio");

      await page.waitForSelector(".socio-row:last-child input.nome");

      const rows = await page.$$(".socio-row");

      const ultimaLinha = rows[rows.length - 1];

      await ultimaLinha.$eval(
        "input.nome",
        (el, nome) => (el.value = nome),
        socio.nome,
      );

      await ultimaLinha.$eval(
        "input.participacao",
        (el, part) => (el.value = part),
        socio.participacao,
      );
    }

    logger.log("Formulário preenchido com sucesso!");

    /*
    ======================
    SUBMIT
    ======================
    */

    await page.click("#submit-registro");

    logger.log("Registro enviado!");

    return {
      success: true,
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
