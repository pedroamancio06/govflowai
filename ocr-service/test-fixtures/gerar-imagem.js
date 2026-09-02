const path = require("path");
const puppeteer = require(path.join(__dirname, "..", "..", "node_modules", "puppeteer"));

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await page.setViewport({ width: 900, height: 1200 });
  await page.goto(`file://${path.join(__dirname, "contrato-social.html")}`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(__dirname, "contrato-social.png"), fullPage: true });
  await browser.close();
  console.log("PNG gerado.");
})();
