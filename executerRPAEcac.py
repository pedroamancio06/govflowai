"""
RPA Simulação - Login e consulta de declarações no Portal eCAC (Receita Federal)
Projeto acadêmico: GovFlow AI - TCC/Enterprise Challenge FIAP

Este script NUNCA acessa o eCAC/gov.br real: todas as URLs abaixo apontam para
public/ecac_fake/ (portal fictício servido pelo próprio Express da aplicação,
mesmo padrão já usado em portal_fake.html para o robô da Redesim). Captcha e
2FA são telas simuladas dentro desse portal fictício — a pausa manual abaixo
continua existindo por design (nunca automatizar/burlar esses passos), mesmo
não havendo proteção real por trás.

Dependências: pip install playwright python-dotenv && playwright install chromium
Requer o servidor Express rodando (node server.js) para servir public/ecac_fake/.
Disparado automaticamente pela opção [2] do menu do webchat OU pela página
"Consulta e-CAC" do dashboard (ambas via robot/consultaEcac.js), mas pode
rodar isolado via `python executerRPAEcac.py` para gravar o vídeo de demo.

Uso: python executerRPAEcac.py [cpf] [senha] [arquivo_saida.json]
Todos os argumentos são opcionais — sem eles, cai em ECAC_CPF/ECAC_SENHA do
.env (fluxo original do webchat) e "declaracoes.json" como saída padrão.
"""

import os
import sys
import json
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

load_dotenv()

CPF = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else os.getenv("ECAC_CPF")
SENHA = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else os.getenv("ECAC_SENHA")
ARQUIVO_SAIDA = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else "declaracoes.json"

# ECAC_URL aponta para o portal fictício local — nunca para o eCAC real.
# Respeita a porta em que o servidor Express está rodando (ver .env.example).
URL_INICIAL = os.getenv("ECAC_URL", "http://localhost:3000/ecac_fake/autenticacao.html")
TIMEOUT_PADRAO = 30000  # 30s
ANOS_DESEJADOS = 3  # quantidade de exercícios mais recentes a extrair


def log(msg):
    print(f"[RPA] {msg}")


def main():
    if not CPF or not SENHA:
        raise RuntimeError(
            "Defina ECAC_CPF e ECAC_SENHA no arquivo .env antes de rodar."
        )

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=150)
        context = browser.new_context()
        page = context.new_page()
        page.set_default_timeout(TIMEOUT_PADRAO)

        try:
            # 1. Acessa a página inicial do eCAC (fictícia)
            log("Acessando página de autenticação do eCAC (simulação local)...")
            page.goto(URL_INICIAL)

            # 2. Clica no botão "Entrar com gov.br" (abre o captcha simulado)
            log("Clicando em 'Entrar com gov.br'...")
            page.click("#btn-entrar-govbr")

            # Captcha simulado aparece aqui. Resolver (marcar a caixinha + clicar
            # "Verificar") continua 100% manual na janela do navegador — nunca
            # automatizado. Ao resolver, a página simulada navega sozinha para o
            # próximo passo, e é isso que o wait_for_url abaixo espera: não existe
            # pausa de terminal aqui de propósito (dependeria do stdin do processo
            # do servidor estar anexado a um terminal interativo, o que nem sempre
            # é verdade) — o próprio navegador já é o ponto de confirmação manual.
            log("Aguardando você resolver o captcha simulado na janela do navegador...")
            page.wait_for_url("**/ecac_fake/sso-login.html**", timeout=120000)
            log("Página de login gov.br (simulada) carregada.")

            # 4. Preenche o CPF
            log("Preenchendo CPF...")
            page.fill("#accountId", CPF)
            page.click("#enter-account-id")

            # 5. Aguarda o campo de senha aparecer e preenche
            log("Aguardando campo de senha...")
            page.wait_for_selector("#password", state="visible")
            page.fill("#password", SENHA)
            page.click("#submit-button")

            # 2FA simulado pode aparecer aqui — mesmo raciocínio do captcha acima:
            # confirmar o 2FA (botão "Confirmar") é manual na janela do navegador,
            # e o wait_for_url abaixo é o que espera por isso, sem pausa de terminal.
            log("Aguardando você confirmar o 2FA simulado na janela do navegador...")
            page.wait_for_url("**/ecac_fake/home.html**", timeout=120000)
            page.wait_for_load_state("networkidle")
            log("Login concluído e página principal do eCAC carregada.")

            # 7. Clica em "Meu Imposto de Renda" (abre em nova aba)
            log("Clicando em 'Meu Imposto de Renda'...")
            with context.expect_page() as nova_aba_info:
                page.get_by_role("link", name="Meu Imposto de Renda").click()
            mir_page = nova_aba_info.value
            mir_page.set_default_timeout(TIMEOUT_PADRAO)

            # 8. Aguarda a página inicial do Portal MIR carregar
            log("Aguardando página inicial do Portal MIR...")
            mir_page.wait_for_url("**/ecac_fake/portalmir.html**", timeout=60000)
            mir_page.wait_for_load_state("networkidle")
            log("Portal MIR carregado.")

            # 9. Extrai status das declarações (linhas .declaracao-ano)
            log("Extraindo status das declarações...")
            declaracoes = []

            try:
                mir_page.wait_for_selector(".declaracao-ano", timeout=15000)
            except PlaywrightTimeoutError:
                log("ERRO: não encontrei nenhum elemento '.declaracao-ano'. "
                    "Verifique se o layout da página mudou.")
                raise

            linhas = mir_page.query_selector_all(".declaracao-ano")
            log(f"{len(linhas)} exercício(s) encontrado(s) na tela.")

            for linha in linhas[:ANOS_DESEJADOS]:
                botao_ano = linha.query_selector("button")
                situacao_div = linha.query_selector(".situacao")

                ano_texto = botao_ano.inner_text().strip() if botao_ano else "N/A"
                situacao_texto = (
                    situacao_div.inner_text().strip() if situacao_div else "N/A"
                )

                declaracoes.append({
                    "exercicio": ano_texto,
                    "situacao": situacao_texto,
                })
                log(f"  -> {ano_texto}: {situacao_texto}")

            # 10. Salva em JSON
            with open(ARQUIVO_SAIDA, "w", encoding="utf-8") as f:
                json.dump(declaracoes, f, ensure_ascii=False, indent=2)
            log(f"Dados salvos em {ARQUIVO_SAIDA}")

        except Exception as e:
            log(f"ERRO durante a execução: {e}")
            page.screenshot(path="erro_screenshot.png")
            log("Screenshot do erro salvo em erro_screenshot.png")
            raise
        finally:
            # Sem input() aqui: se o processo não tiver stdin interativo (ex.:
            # rodando via robot/consultaEcac.js), input() derrubaria o script com
            # EOFError em vez de simplesmente fechar o navegador. Dá uma folga
            # visual antes de fechar, sem depender do terminal.
            page.wait_for_timeout(3000)
            browser.close()


if __name__ == "__main__":
    main()