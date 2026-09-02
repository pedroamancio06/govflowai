"""Microserviço de OCR/NLP (TECH-SPEC-MVP.md §2.2). Consumido internamente
pelo backend Node — nunca deve ser exposto publicamente (sem auth própria)."""
import time

from fastapi import FastAPI, UploadFile, File, Form

from pipeline import processar_documento

app = FastAPI(title="GovFlow AI — Motor de OCR/NLP", version="1.0.0")


@app.get("/saude")
def saude():
    return {"status": "ok"}


@app.post("/extrair")
async def extrair(id_processamento: str = Form(...), arquivo: UploadFile = File(...)):
    conteudo = await arquivo.read()
    inicio = time.time()

    resultado = processar_documento(conteudo, arquivo.filename, arquivo.content_type)

    resultado["id_processamento"] = id_processamento
    resultado["tempo_processamento_ms"] = int((time.time() - inicio) * 1000)
    return resultado
