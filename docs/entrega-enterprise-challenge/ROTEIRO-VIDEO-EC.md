# Roteiro do Vídeo-Pitch — Enterprise Challenge
**Duração alvo: até 7 minutos — YouTube não listado**

Estrutura calibrada pelo peso de cada critério da rubrica (40 pts totais): Representação (10),
Requisitos/Funcionalidades (10), Implementação Técnica (15 — a maior fatia), Apresentação do Time (5).
Por isso a demonstração técnica ocupa a maior parte do tempo, com **requests reais de gravação e leitura
no banco de dados em nuvem** — não é opcional, é item explícito da rubrica.

Sugestão de gravação: tela dividida ou alternada entre slides, navegador, terminal e o painel do Neon.
OBS Studio, Loom ou a gravação nativa do Windows (Win+Alt+R) resolvem.

---

## 0:00 – 0:40 — Abertura (Representação, critério A)
> "Olá! Somos o time do GovFlow AI — uma automação inteligente de processos governamentais para
> escritórios de contabilidade. Contadores como o Roberto, nosso persona, perdem boa parte do tempo
> útil do escritório em trabalho manual: triagem de documentos, redigitação de dados, protocolo em
> portais como o Redesim. O GovFlow AI transforma esse fluxo manual de ~40 minutos em um processo
> conversacional automatizado de poucos minutos."

## 0:40 – 1:20 — Alinhamento de mercado (Representação, critério A)
> "Essa solução segue a mesma direção de mercado apresentada no nosso vídeo-pitch do Startup One:
> modelo SaaS Freemium, R$299/mês no plano Pro, com CAC de R$250 e LTV projetado de quase R$4.000 —
> uma relação LTV sobre CAC de quase 16 vezes. O breakeven operacional é projetado para o terceiro mês
> de operação. [Detalhes completos na documentação financeira anexa.]"

## 1:20 – 2:20 — Funcionalidades essenciais e experiência do usuário (critério B)
**[Trocar para o navegador — demo rápida do fluxo do usuário]**
> "Na prática: o contador acessa o portal, faz login único, e envia um documento — pode ser pelo
> webchat ou direto pelo painel. A inteligência artificial lê o documento, mostra os dados extraídos
> na tela, e só depois de o usuário revisar e confirmar é que o robô é acionado contra o portal do
> governo. Essa pausa para confirmação humana é proposital: acionar um robô contra um portal
> governamental é uma ação real, de baixo custo de reverter, então o sistema nunca faz isso sozinho."

## 2:20 – 5:50 — Implementação Técnica (critério C — maior peso, 3min30)
Esta é a seção mais importante da rubrica. Sequência sugerida:

**(a) Arquitetura — 30s**
> "A arquitetura é dividida em 3 camadas: o Hub de Convergência (front-end — webchat e portal web),
> a camada de Aplicação (back-end — motor de OCR em Python e motor de RPA em Node.js), e o banco de
> dados analítico, hospedado em nuvem."
- Mostrar o slide do diagrama de arquitetura (`docs/apresentacao/GovFlow-AI-Apresentacao.pdf`).

**(b) Front-end e Back-end reais — 40s**
> "Do lado do front-end, é HTML, CSS e JavaScript real, consumindo eventos em tempo real via
> Server-Sent Events — sem simulação. Do lado do back-end, Node.js com Express cuida do fluxo
> conversacional, autenticação e orquestração; um microserviço Python com FastAPI roda o OCR de
> verdade — Tesseract mais OpenCV para pré-processamento de imagem."
- Mostrar rapidamente o VS Code aberto: `server.js`, `hub/pipeline.js`, `ocr-service/main.py`.

**(c) Demonstração ao vivo — upload e OCR real — 40s**
- Subir um documento real no painel, mostrar o console de eventos reagindo em tempo real e o card
  "Dados Extraídos" populando com CNPJ, Razão Social, Sócios — dados lidos de verdade do documento.

**(d) Interação técnica com a nuvem — REQUEST DE GRAVAÇÃO — 40s**
> "Agora o ponto mais importante: aqui está o painel do Neon, nosso provedor de banco de dados
> PostgreSQL em nuvem. Antes do envio, a tabela de automações está assim [mostrar contagem/última
> linha]. Vou confirmar o envio no sistema..." **[clicar "Enviar ao Gov.br"]** "...e agora, de volta
> no Neon, atualizando a tabela: aqui está a linha nova, gravada em tempo real, com o protocolo que
> o robô acabou de gerar."
- Usar a aba **Tables** do Neon (ou o **SQL Editor**), mostrando a tabela `fato_processamento_automacoes`
  antes e depois do clique.

**(e) Interação técnica com a nuvem — REQUEST DE LEITURA — 30s**
> "E para provar que não é só escrita: aqui no SQL Editor do Neon, vou rodar uma consulta que junta
> a tabela fato com as dimensões de cliente, canal e status..." **[rodar o SELECT com JOIN]**
> "...e recupero exatamente os dados da automação que acabamos de processar, incluindo o tempo
> economizado, calculado automaticamente pelo próprio banco."
- Query sugerida (ver seção "Query de apoio" abaixo).

**(f) Robô em ação — 30s**
- Cortar para o console mostrando o robô preenchendo o formulário (CNPJ, Razão Social, sócios) até o
  protocolo final aparecer.

**(g) Fechamento técnico — 20s**
> "Esse é o pipeline completo: front-end e back-end reais, processando um documento de verdade,
> gravando e consultando dados de um banco PostgreSQL hospedado na nuvem — sem nenhuma simulação."

## 5:50 – 6:40 — Apresentação do Time (critério D)
> "Esse projeto foi desenvolvido por [nome completo — RM], [nome completo — RM], [nome completo — RM]."
- Mostrar o slide com foto + nome completo + RM de cada integrante.
> "[RESPOSTA SOBRE O NEXT 2026 — usar a frase exata definida pelo grupo]"

## 6:40 – 7:00 — Encerramento
> "O GovFlow AI já tem cerca de 80% do MVP funcional rodando de ponta a ponta, com banco de dados em
> nuvem, IA e automação reais. Obrigado!"

---

## Query de apoio para a demonstração de leitura (item "e")

Rodar no SQL Editor do Neon, ao vivo, durante a gravação:

```sql
SELECT
    f.protocolo_gerado,
    f.confianca_ocr,
    f.tempo_processamento_total_seg,
    f.tempo_economizado_seg,
    s.nome_status,
    c.nome_canal,
    cl.nome_escritorio,
    f.criado_em
FROM fato_processamento_automacoes f
JOIN dim_status  s  ON s.id_status  = f.id_status
JOIN dim_canal   c  ON c.id_canal   = f.id_canal
JOIN dim_cliente cl ON cl.id_cliente = f.id_cliente
ORDER BY f.criado_em DESC
LIMIT 5;
```

## Checklist antes de gravar
- [ ] Servidor Node rodando (`node server.js`) e serviço de OCR rodando (`ocr-service`), ambos
      conectados ao Neon (`DATABASE_URL` preenchida no `.env`)
- [ ] Login de teste já configurado (evita perder tempo com formulários na gravação)
- [ ] Documento de teste pronto (`ocr-service/test-fixtures/contrato-social.pdf`) ou um documento real
- [ ] Aba do Neon aberta (Tables + SQL Editor) em outra janela/monitor, pronta para alternar
- [ ] Query de leitura (acima) já digitada, só faltando rodar
- [ ] Slides abertos em modo apresentação para a abertura, arquitetura e time
- [ ] Fotos + nomes + RMs de todos os integrantes prontos
- [ ] Frase de disponibilidade para o NEXT 2026 definida pelo grupo, decorada ou escrita na tela

## Após gravar
1. Publicar no YouTube como **"Não listado"** (não "Privado")
2. Copiar o link e inserir no documento de entrega (`docs/entrega-enterprise-challenge/`)
3. Conferir que o vídeo não ultrapassa 7 minutos
