"""Regras de higienização de string (TECH-SPEC-MVP.md §2.2.2)."""
import re


def limpar_texto_generico(texto):
    texto = re.sub(r"\s*\n\s*", " ", texto)
    texto = re.sub(r"\s{2,}", " ", texto)
    return texto.strip()


def limpar_numerico(fragmento):
    """Corrige confusões O/0 e l|I/1 — usar SÓ em campos já identificados como
    numéricos (nunca em texto livre como Razão Social)."""
    fragmento = fragmento.replace("O", "0").replace("o", "0")
    return re.sub(r"[lI]", "1", fragmento)


def normalizar_cnpj(bruto):
    digitos = re.sub(r"\D", "", bruto)
    if len(digitos) != 14:
        return None
    return f"{digitos[0:2]}.{digitos[2:5]}.{digitos[5:8]}/{digitos[8:12]}-{digitos[12:14]}"


def cnpj_digito_verificador_valido(cnpj_formatado):
    digitos = [int(d) for d in re.sub(r"\D", "", cnpj_formatado)]
    if len(digitos) != 14:
        return False

    def calcular_dv(nums, pesos):
        soma = sum(n * p for n, p in zip(nums, pesos))
        resto = soma % 11
        return 0 if resto < 2 else 11 - resto

    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    dv1 = calcular_dv(digitos[:12], pesos1)
    dv2 = calcular_dv(digitos[:12] + [dv1], pesos2)
    return digitos[12] == dv1 and digitos[13] == dv2


def mascarar_cpf(texto):
    """Nunca deixar CPF completo em nenhuma superfície voltada ao usuário (LGPD)."""
    return re.sub(r"(\d{3})\.?\d{3}\.?\d{3}-?(\d{2})", r"\1.***.**-\2", texto)
