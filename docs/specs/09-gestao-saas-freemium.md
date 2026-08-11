# Spec 09 — Gestão de Assinatura SaaS (Freemium)

**Camada:** 3 — Painel de Gestão / Dashboard
**Status:** Não implementado. Não existe conceito de plano/limite hoje — qualquer chamada a `POST /registro-empresa` é aceita sem restrição.

## 1. Objetivo

Sustentar o modelo de negócio Freemium: permitir que um escritório use um número limitado de automações gratuitas por mês, visualize seu consumo, e seja direcionado a um upgrade quando o limite for atingido — sem processar cobrança real neste escopo (ver Fora de Escopo).

## 2. Estado Atual / Gap

Não há `DIM_CLIENTE`, plano, nem contador de uso — pré-requisito direto da [spec 06](06-banco-dados-dw.md) (`DIM_CLIENTE.plano_saas`) e da [spec 02](02-portal-web-sso.md) (resolução do tenant via SSO). Esta spec depende de ambas já estarem implementadas.

## 3. Requisitos Funcionais

- RF01 — Cada `DIM_CLIENTE` possui um `plano_saas` (`free` | `pago`) e um limite mensal de automações associado ao plano (ex.: `free = 5/mês`).
- RF02 — Exibir no dashboard um contador de uso do período corrente (ex.: "Você usou 3/5 automações gratuitas este mês"), calculado a partir da contagem de linhas em `FATO_PROCESSAMENTO_AUTOMACOES` filtradas por `id_cliente` e pelo mês corrente (`DIM_TEMPO`).
- RF03 — Antes de aceitar uma nova solicitação de automação (ponto de entrada: [spec 03, `POST /hub/eventos`](03-webhooks-api.md)), verificar se o cliente `free` já atingiu o limite mensal — se sim, rejeitar a criação da automação e retornar motivo claro (`limite_plano_atingido`), propagado como mensagem ao usuário no chat ([spec 01](01-interface-conversacional.md)).
- RF04 — Ao se aproximar do limite (ex.: última automação disponível), notificar proativamente o usuário no chat e/ou no dashboard, incentivando upgrade — sem bloquear o uso corrente.
- RF05 — Reset do contador é automático na virada do mês (`DIM_TEMPO`), sem job manual.
- RF06 — Tela/seção de "Meu Plano" no dashboard mostrando: plano atual, uso do mês, histórico de uso dos últimos meses (reaproveitando `vw_roi_por_periodo` ou equivalente da [spec 06](06-banco-dados-dw.md)).

## 4. Requisitos Não Funcionais

- A verificação de limite deve acontecer **antes** de enfileirar o processamento (RF03) — nunca processar e depois recusar, o que desperdiçaria OCR/RPA em uma automação que não deveria ter rodado.
- Contagem de uso deve ser consistente sob concorrência (dois disparos simultâneos no limite não podem ambos passar) — usar transação/lock ao verificar-e-incrementar.

## 5. Contrato de API

```
GET /dashboard/plano
→ 200
{
  "plano_saas": "free",
  "limite_mensal": 5,
  "uso_mes_atual": 3,
  "periodo": "2026-08"
}

-- Verificação interna (chamada pelo hub antes de enfileirar, spec 03):
POST /interno/plano/verificar-limite
{ "id_cliente": "uuid" }
→ 200 { "permitido": true, "uso_mes_atual": 3, "limite_mensal": 5 }
   ou
→ 200 { "permitido": false, "motivo": "limite_plano_atingido" }
```

## 6. Critérios de Aceite

- [ ] Um cliente `free` no limite tem sua 6ª automação do mês recusada com mensagem clara, antes de qualquer processamento de OCR/RPA ser iniciado.
- [ ] O contador de uso exibido no dashboard bate exatamente com o número de automações daquele cliente naquele mês na tabela fato.
- [ ] Na virada do mês, o contador reinicia automaticamente sem intervenção manual.
- [ ] Duas solicitações simultâneas no limite não resultam em ambas sendo aceitas (teste de concorrência).

## 7. Dependências

- [Spec 06 — Banco de Dados/DW](06-banco-dados-dw.md) (`DIM_CLIENTE.plano_saas`, tabela fato para contagem de uso).
- [Spec 02 — Portal Web/SSO](02-portal-web-sso.md) (resolução do `id_cliente`).
- [Spec 03 — Webhooks e APIs](03-webhooks-api.md) (ponto de verificação antes de enfileirar).

## 8. Fora de Escopo

- Processamento de pagamento/cobrança recorrente (gateway de pagamento, nota fiscal) — esta spec cobre apenas o controle de limite e a exibição de uso, não a transação financeira em si.
- Planos com precificação por variável (ex.: por serviço de governo) — no MVP, o plano é um limite único de automações/mês.
- Downgrade/cancelamento self-service.
