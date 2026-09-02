"""Classificação heurística de tipo de documento por palavras-chave
(TECH-SPEC-MVP.md §2.2.1, passo 6). MVP cobre apenas o serviço de Abertura
Redesim (docs/PRD.md §6) — outros tipos ficam mapeados para quando novos
serviços de governo entrarem."""

PALAVRAS_CHAVE = {
    "contrato_social": ["contrato social", "quadro societário", "capital social", "sócios", "cláusula", "clausula"],
    "rg": ["carteira de identidade", "registro geral", "secretaria de segurança"],
    "cnh": ["carteira nacional de habilitação", "categoria", "detran"],
}


def classificar(texto_limpo):
    texto_lower = texto_limpo.lower()
    melhor_tipo = "desconhecido"
    melhor_pontuacao = 0
    for tipo, palavras in PALAVRAS_CHAVE.items():
        pontuacao = sum(1 for p in palavras if p in texto_lower)
        if pontuacao > melhor_pontuacao:
            melhor_pontuacao = pontuacao
            melhor_tipo = tipo
    return melhor_tipo
