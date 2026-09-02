# Motor de OCR/NLP — GovFlow AI

Microserviço Python (FastAPI) que implementa o pipeline de OCR/NLP descrito em
[docs/TECH-SPEC-MVP.md §2.2](../docs/TECH-SPEC-MVP.md#22-módulo-2--motor-de-ocr--nlp-python). Consumido internamente por `hub/pipeline.js` — **nunca deve ser exposto publicamente**, não tem autenticação própria.

## Dependências de sistema (fora do pip)

Tesseract e Poppler são binários nativos, não pacotes Python — precisam estar instalados e no `PATH` antes de rodar o serviço.

| Dependência | Windows | Verificar |
|---|---|---|
| Tesseract OCR 5.x | `winget install --id UB-Mannheim.TesseractOCR` | `tesseract --version` |
| Poppler (para PDF) | Baixar o build Windows em [github.com/oschwartz10612/poppler-windows/releases](https://github.com/oschwartz10612/poppler-windows/releases) e adicionar a pasta `Library/bin` ao PATH | `pdftoppm -v` |

O pacote de idioma português (`por.traineddata`) **não** vem no instalador padrão do Tesseract e é baixado à parte (ver Setup abaixo) — o serviço aponta para ele via `--tessdata-dir`, não depende do `tessdata` global do Tesseract nem de privilégio de admin.

## Setup

```bash
cd ocr-service
python -m venv venv
./venv/Scripts/pip install -r requirements.txt   # Windows
# source venv/bin/activate && pip install -r requirements.txt   # Linux/Mac

mkdir tessdata
curl -sL -o tessdata/por.traineddata https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/por.traineddata
```

## Rodar

```bash
./venv/Scripts/python.exe -m uvicorn main:app --port 8001
```

`hub/pipeline.js` espera o serviço em `http://localhost:8001` (configurável via `OCR_SERVICE_URL`).

## Testar isoladamente

```bash
# gera um Contrato Social sintético em PDF (via Puppeteer, já no projeto)
node test-fixtures/gerar-pdf.js

curl -X POST http://localhost:8001/extrair \
  -F "id_processamento=teste-manual" \
  -F "arquivo=@test-fixtures/contrato-social.pdf;type=application/pdf"
```

## Limitações conhecidas (documentadas, não escondidas)

- **Deskew removido.** Uma correção de inclinação baseada em `cv2.minAreaRect` foi implementada e descartada — instável em páginas de texto corrido, chegava a destruir documentos sem nenhuma inclinação real. Ver comentário em `preprocessamento.py`.
- **Extração por regex, não NER/ML.** Razão Social, QSA e Endereço usam heurísticas de expressão regular validadas contra o documento de referência em `test-fixtures/`. Formatos de documento reais variam — a confiança por campo existe exatamente para capturar essa incerteza (`pendente_revisao_humana` quando abaixo do limiar), não para escondê-la.
- **1 página assumida como suficiente** para o caso de uso do MVP (Contrato Social simples). Documentos multi-página são somados em um texto único antes da extração — funciona, mas sem tratamento especial de layout por página.
