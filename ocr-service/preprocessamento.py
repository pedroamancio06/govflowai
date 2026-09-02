"""Pré-processamento de imagem (TECH-SPEC-MVP.md §2.2.1, passo 3):
grayscale -> remoção de ruído -> binarização (Otsu).
"""
import cv2
import numpy as np


def preprocessar(imagem_pil):
    imagem = cv2.cvtColor(np.array(imagem_pil.convert("RGB")), cv2.COLOR_RGB2BGR)
    cinza = cv2.cvtColor(imagem, cv2.COLOR_BGR2GRAY)
    sem_ruido = cv2.fastNlMeansDenoising(cinza, h=10)
    # Otsu calcula o limiar a partir do histograma da própria imagem — mais
    # robusto entre documentos "nativos" (PDF gerado) e digitalizados/fotografados
    # do que um threshold adaptativo com block size fixo ajustado no escuro.
    binarizada = cv2.threshold(sem_ruido, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    return binarizada

# NOTA: uma etapa de correção de inclinação (deskew) baseada em cv2.minAreaRect
# foi implementada e testada nesta função, mas se mostrou instável em página de
# texto corrido/justificado — o ângulo estimado a partir do bounding box de
# TODOS os pixels de texto da página não representa de forma confiável a
# inclinação real do documento, e a rotação resultante destruía o texto mesmo
# em páginas sem nenhuma inclinação real (validado com test-fixtures/contrato-social.pdf:
# OCR ilegível com deskew ligado, 916 caracteres corretos com deskew desligado).
# Removida deste MVP. Uma implementação robusta (ex.: Hough Line Transform sobre
# linhas de texto, ou usar o OSD do próprio Tesseract) fica para o piloto, quando
# houver fotos reais de documentos para validar contra.
