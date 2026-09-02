"""Orquestra o pipeline completo de OCR/NLP (TECH-SPEC-MVP.md §2.2.1)."""
import io
import os

import pytesseract
from pytesseract import Output
from PIL import Image
from pdf2image import convert_from_bytes

from preprocessamento import preprocessar
from higienizacao import limpar_texto_generico
from classificacao import classificar
from extracao import extrair_cnpj, extrair_razao_social, extrair_capital_social, extrair_qsa, extrair_endereco

TESSDATA_DIR = os.path.join(os.path.dirname(__file__), "tessdata")
# Sem aspas: pytesseract passa o config diretamente para o subprocess (sem
# shell), então aspas literais entrariam no caminho em vez de delimitá-lo.
TESSERACT_CONFIG = f"--psm 6 --tessdata-dir {TESSDATA_DIR}"

# Limiares de confiança (§2.2.3) — configuráveis via env, não hardcoded.
LIMIAR_PRONTO = float(os.environ.get("OCR_LIMIAR_PRONTO", "0.85"))
LIMIAR_REVISAO = float(os.environ.get("OCR_LIMIAR_REVISAO", "0.60"))


def processar_documento(conteudo_bytes, nome_arquivo, mime_type):
    try:
        paginas = _carregar_paginas(conteudo_bytes, mime_type)
    except Exception as erro:
        return _resultado_ilegivel(f"Falha ao abrir o arquivo: {erro}")

    texto_bruto_total = ""
    confiancas_total = []
    for pagina in paginas:
        texto_pagina, confiancas_pagina = _ocr_pagina(pagina)
        texto_bruto_total += " " + texto_pagina
        confiancas_total.extend(confiancas_pagina)

    if not confiancas_total:
        return _resultado_ilegivel("Nenhum texto reconhecido no documento.")

    confianca_base = (sum(confiancas_total) / len(confiancas_total)) / 100.0
    texto_limpo = limpar_texto_generico(texto_bruto_total)
    tipo_documento = classificar(texto_limpo)

    dados = {}
    for chave, extrator in (
        ("cnpj", extrair_cnpj),
        ("razao_social", extrair_razao_social),
        ("capital_social", extrair_capital_social),
        ("endereco", extrair_endereco),
    ):
        valor = extrator(texto_limpo, confianca_base)
        if valor:
            dados[chave] = valor

    qsa = extrair_qsa(texto_limpo, confianca_base)
    if qsa:
        dados["qsa"] = qsa

    confianca_agregada = _confianca_agregada(dados, confianca_base)
    status = _determinar_status(dados, confianca_agregada, confianca_base)

    return {
        "tipo_documento": tipo_documento,
        "confianca_agregada": confianca_agregada,
        "dados": dados,
        "status": status,
    }


def _carregar_paginas(conteudo_bytes, mime_type):
    if mime_type == "application/pdf":
        return convert_from_bytes(conteudo_bytes, dpi=300)
    return [Image.open(io.BytesIO(conteudo_bytes))]


def _ocr_pagina(imagem_pil):
    imagem_processada = preprocessar(imagem_pil)
    dados = pytesseract.image_to_data(
        imagem_processada, lang="por", config=TESSERACT_CONFIG, output_type=Output.DICT
    )
    palavras, confiancas = [], []
    for texto, conf in zip(dados["text"], dados["conf"]):
        conf_num = int(conf) if str(conf).lstrip("-").isdigit() else -1
        if texto.strip() and conf_num >= 0:
            palavras.append(texto)
            confiancas.append(conf_num)
    return " ".join(palavras), confiancas


def _confianca_agregada(dados, confianca_base):
    confiancas_campos = [v["confianca"] for k, v in dados.items() if k != "qsa" and "confianca" in v]
    if "qsa" in dados:
        confiancas_campos.extend(s["confianca"] for s in dados["qsa"])
    if not confiancas_campos:
        return round(confianca_base, 2)
    return round(sum(confiancas_campos) / len(confiancas_campos), 2)


def _determinar_status(dados, confianca_agregada, confianca_base):
    if not dados:
        return "documento_ilegivel" if confianca_base < LIMIAR_REVISAO else "pendente_revisao_humana"
    if confianca_agregada >= LIMIAR_PRONTO:
        return "pronto_para_rpa"
    if confianca_agregada >= LIMIAR_REVISAO:
        return "pendente_revisao_humana"
    return "documento_ilegivel"


def _resultado_ilegivel(motivo):
    return {
        "tipo_documento": "desconhecido",
        "confianca_agregada": 0.0,
        "dados": {},
        "status": "documento_ilegivel",
        "motivo": motivo,
    }
