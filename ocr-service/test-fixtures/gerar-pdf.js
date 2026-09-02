// Utilitário de teste: renderiza contrato-social.html em PDF usando o
// Puppeteer já instalado no projeto — usado para validar o pipeline de OCR
// contra um documento realista, sem depender de scanner/foto real.
const path = require("path");
const puppeteer = require(path.join(__dirname, "..", "..", "node_modules", "puppeteer"));

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${path.join(__dirname, "contrato-social.html")}`, { waitUntil: "networkidle0" });
  await page.pdf({ path: path.join(__dirname, "contrato-social.pdf"), format: "A4" });
  await browser.close();
  console.log("PDF gerado.");
})();
