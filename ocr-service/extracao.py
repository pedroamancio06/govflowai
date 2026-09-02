"""Extração de campos por regex (TECH-SPEC-MVP.md §2.2.1 passo 7 / §2.2.3).

Heurísticas de texto livre (Razão Social, QSA, endereço) são inerentemente
imprecisas contra documentos reais de formatos variados — por isso cada campo
carrega sua própria confiança, e a extração incompleta é o comportamento
esperado (aciona `pendente_revisao_humana` em vez de seguir com dado incerto).
Os padrões aqui foram validados contra o documento de referência em
`test-fixtures/` — precisam de ajuste fino com documentos reais no piloto.
"""
import re

from higienizacao import normalizar_cnpj, cnpj_digito_verificador_valido

PATTERN_CNPJ = re.compile(r"\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}")

PATTERN_CAPITAL = re.compile(
    # Formato de moeda BR (milhar com ponto, centavos com vírgula) — evita capturar
    # pontuação de fim de frase que [\d.,]+ genérico varreria junto (bug encontrado em teste).
    r"capital social (?:é|sera|será)?\s*(?:de|no valor de)?\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})",
    re.IGNORECASE,
)

PATTERN_RAZAO_SOCIAL = re.compile(
    # O OCR de aspas tipográficas (“ ”) costuma sair como sequências de 1-2
    # caracteres soltos (', ", ou combinações) — por isso [\"'“”]* (zero ou mais),
    # não um único caractere opcional (bug encontrado em teste: "LTDA'"," quebrava o match).
    r"(?:denomina(?:da|-se)|sob a denomina[çc][ãa]o de)\s*[:\-]?\s*[\"'“]*"
    r"([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .&\-]{4,80}?(?:LTDA|EIRELI|S\/?A|S\.A\.))[\"'”]*[,.\n]",
    re.IGNORECASE,
)

PATTERN_SOCIO = re.compile(
    r"([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})[^%\n]{0,80}?(\d{1,3}(?:,\d+)?)\s?%"
)

PATTERN_ENDERECO = re.compile(
    r"((?:Rua|Av\.?|Avenida|Alameda|Travessa)[^,\n]{3,60}),\s*"
    r"(?:n[º°o]?\s*\d+[^,\n]*,\s*)?"
    r"(?:Bairro\s+)?([A-ZÀ-Ú][a-zà-ú]+(?:\s[A-ZÀ-Ú][a-zà-ú]+)*)\s*[-,]\s*"
    r"([A-ZÀ-Ú][a-zà-ú]+(?:\s[A-ZÀ-Ú][a-zà-ú]+)*)\s*[-\/]\s*"
    r"([A-Z]{2})[^0-9]*(\d{5}-?\d{3})",
    re.IGNORECASE,
)


def extrair_cnpj(texto, confianca_base):
    match = PATTERN_CNPJ.search(texto)
    if not match:
        return None
    formatado = normalizar_cnpj(match.group())
    if not formatado:
        return None
    valido = cnpj_digito_verificador_valido(formatado)
    confianca = min(confianca_base + (0.05 if valido else -0.15), 0.99)
    return {"valor": formatado, "confianca": round(max(confianca, 0.1), 2), "digito_verificador_valido": valido}


def extrair_razao_social(texto, confianca_base):
    match = PATTERN_RAZAO_SOCIAL.search(texto)
    if not match:
        return None
    valor = re.sub(r"\s{2,}", " ", match.group(1)).strip(" .,\"'")
    return {"valor": valor, "confianca": round(confianca_base, 2)}


def extrair_capital_social(texto, confianca_base):
    match = PATTERN_CAPITAL.search(texto)
    if not match:
        return None
    valor = match.group(1).replace(".", "").replace(",", ".")
    return {"valor": valor, "confianca": round(confianca_base, 2)}


def extrair_qsa(texto, confianca_base):
    socios = []
    for match in PATTERN_SOCIO.finditer(texto):
        nome = match.group(1).strip()
        participacao = f"{match.group(2)}%"
        socios.append({"nome": nome, "participacao": participacao, "confianca": round(confianca_base, 2)})
    return socios


def extrair_endereco(texto, confianca_base):
    match = PATTERN_ENDERECO.search(texto)
    if not match:
        return None
    return {
        "logradouro": match.group(1).strip(),
        "bairro": match.group(2).strip(),
        "cidade": match.group(3).strip(),
        "uf": match.group(4).upper(),
        "cep": match.group(5),
        "confianca": round(confianca_base, 2),
    }
