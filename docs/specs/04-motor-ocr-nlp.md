# Spec 04 — Motor de OCR e Tratamento de Strings via IA (NLP)

**Camada:** 2 — Aplicação (Backend/Core)
**Status:** Não implementado. Hoje os dados chegam ao robô já estruturados em JSON (`dadosParaObroro` hardcoded em [public/page.html:1284-1292](../../public/page.html)) — não existe leitura real de documento nenhuma.

## 1. Objetivo

Transformar um documento não estruturado (PDF/imagem de RG, contrato social) enviado pelo Hub em um JSON limpo e validado, no formato que o Motor de RPA ([spec 05](05-motor-rpa.md)) já consome hoje (`{ cnpj, razaoSocial, capitalSocial, socios: [{ nome, participacao }] }`, ver [robot/registroEmpresa.js:54-93](../../robot/registroEmpresa.js)).

## 2. Estado Atual / Gap

O dashboard atual (`page.html`) já **simula visualmente** essa etapa: existe um `mockData` fixo (Nome, CPF, Data de Nascimento, Tipo de Documento, confiança de extração "97.3%" — ver [public/page.html:1201-1210](../../public/page.html)) exibido como se fosse resultado de IA, mas é texto estático, sem OCR nem NLP reais rodando. Esta spec substitui esse mock por um pipeline real.

## 3. Requisitos Funcionais

### 3.1 Leitor de Documentos
- RF01 — Aceitar como entrada um `arquivo_url` (PDF ou imagem) recebido via fila (ver [spec 03](03-webhooks-api.md)).
- RF02 — Rodar OCR sobre o documento usando um motor definido (Tesseract para MVP local; AWS Textract como opção de produção para maior acurácia em documentos governamentais).
- RF03 — Classificar automaticamente o tipo de documento recebido (RG, CNH, Contrato Social) antes de tentar extrair campos — o dashboard mock já expõe esse conceito como "Tipo de Documento: CNH — Categoria B".
- RF04 — Se o OCR não conseguir extrair texto com confiança mínima (ex.: imagem ilegível), retornar erro específico `documento_ilegivel` para o Hub notificar o usuário a reenviar (ver RF10 da [spec 01](01-interface-conversacional.md)).

### 3.2 Higienização de Dados (NLP)
- RF05 — Extrair entidades nomeadas relevantes por tipo de documento: CNPJ, Razão Social, Nome, CPF, QSA (quadro de sócios e participação).
- RF06 — Normalizar formatos (ex.: CNPJ com/sem máscara, capital social em texto numérico) para o schema esperado pelo robô.
- RF07 — Limpar caracteres corrompidos/ruído típico de OCR (ex.: `Ø`↔`0`, `l`↔`1`) antes da normalização.
- RF08 — Mascarar dados sensíveis (CPF) em qualquer superfície voltada ao usuário (dashboard, logs), mantendo apenas os 3 últimos dígitos visíveis — como já sinalizado no mock (`***.***.234-87`).
- RF09 — Calcular e anexar um score de confiança da extração por campo e um score agregado do documento.
- RF10 — Se o score agregado estiver abaixo de um limiar configurável, marcar o processamento como `pendente_revisao_humana` em vez de seguir automaticamente para o RPA.

## 4. Requisitos Não Funcionais

- Tempo de processamento alvo: < 15s por documento (P95) no MVP.
- Nenhum dado bruto do OCR deve ser persistido além do necessário para auditoria (retenção mínima, LGPD).
- O componente deve ser desacoplado do motor de RPA — comunica-se apenas via o schema de saída (contrato abaixo), permitindo trocar o provedor de OCR sem impactar o robô.

## 5. Contrato de Saída (→ consumido pelo Motor RPA, spec 05)

```json
{
  "id_processamento": "uuid",
  "tipo_documento": "contrato_social",
  "confianca_agregada": 0.973,
  "dados": {
    "cnpj": "12.345.678/0001-90",
    "razaoSocial": "TECHGOV SOLUCOES LTDA",
    "capitalSocial": "50000",
    "socios": [
      { "nome": "Pedro Lopes", "participacao": "60%", "confianca": 0.98 },
      { "nome": "Ana Silva", "participacao": "40%", "confianca": 0.95 }
    ]
  },
  "status": "pronto_para_rpa" | "pendente_revisao_humana" | "documento_ilegivel"
}
```

Este é exatamente o formato que [robot/registroEmpresa.js](../../robot/registroEmpresa.js) já espera em `dados` — a extração apenas precisa popular esse objeto a partir do documento real, em vez de ele vir hardcoded do frontend.

## 6. Critérios de Aceite

- [ ] Um PDF de contrato social real de teste gera um JSON de saída no formato acima, com campos preenchidos corretamente.
- [ ] Um documento ilegível/corrompido retorna `documento_ilegivel` em vez de dados incorretos.
- [ ] Um documento com confiança abaixo do limiar é marcado `pendente_revisao_humana` e não segue automaticamente para o robô.
- [ ] CPF nunca aparece completo em nenhuma resposta de API ou tela.

## 7. Dependências

- [Spec 03 — Webhooks e APIs](03-webhooks-api.md) (fila de entrada, eventos de progresso).
- Escolha de provedor de OCR (Tesseract vs. Textract) — decisão técnica a validar conforme orçamento do piloto.

## 8. Fora de Escopo

- Assinatura digital / validação de autenticidade do documento.
- OCR de documentos manuscritos.
