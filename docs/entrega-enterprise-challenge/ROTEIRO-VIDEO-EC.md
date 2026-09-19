# Roteiro do Vídeo-Pitch — Enterprise Challenge
**Duração alvo: até 7 minutos — YouTube não listado**

Estrutura calibrada pelo peso de cada critério da rubrica (40 pts totais): Representação (10),
Requisitos/Funcionalidades (10), Implementação Técnica (15 — a maior fatia), Apresentação do Time (5).
Por isso a demonstração técnica ocupa a maior parte do tempo, com **requests reais de gravação e leitura
no banco de dados em nuvem** — não é opcional, é item explícito da rubrica — e agora também mostra os
**dois robôs de RPA** do projeto (Redesim e Consulta e-CAC).

Sugestão de gravação: tela dividida ou alternada entre slides, navegador, terminal e o painel do Neon.
OBS Studio, Loom ou a gravação nativa do Windows (Win+Alt+R) resolvem. Os slides atualizados estão em
`GovFlow-AI-Apresentacao-EC.pptx`/`.pdf` (11 slides, com o tempo de cada um já marcado no canto superior
direito).

---

## 0:00 – 0:35 — Abertura (Representação, critério A)
**[Slide 1 → Slide 2]**
> "Olá! Somos o time do GovFlow AI — uma automação inteligente de processos governamentais para
> escritórios de contabilidade. Contadores como o Roberto, nosso persona, perdem boa parte do tempo
> útil do escritório em trabalho manual: triagem de documentos, redigitação de dados, protocolo em
> portais como o Redesim e o e-CAC. O GovFlow AI transforma esse fluxo manual de ~40 minutos em um
> processo conversacional automatizado de poucos minutos."

## 0:35 – 1:10 — Alinhamento de mercado (Representação, critério A)
**[Slide 3]**
> "Essa solução segue a mesma direção de mercado apresentada no nosso vídeo-pitch do Startup One:
> modelo SaaS Freemium, R$299/mês no plano Pro, com CAC de R$250 e LTV projetado de quase R$4.000 —
> uma relação LTV sobre CAC de quase 16 vezes. O breakeven operacional é projetado para o terceiro mês
> de operação. Detalhes completos na documentação financeira anexa."

## 1:10 – 1:50 — Funcionalidades essenciais (critério B)
**[Slide 4]**
> "Na prática, seis coisas já funcionam de ponta a ponta: login único validado contra o banco de dados,
> com dono e membros por escritório; upload com OCR real, que lê CNPJ, Razão Social e sócios direto do
> documento; confirmação humana antes de qualquer robô agir; o protocolo gerado aparecendo na própria
> tela do portal; um histórico completo com CNPJ e Razão Social de cada automação; e um segundo robô,
> para consulta de declarações no e-CAC, com gestão completa dos clientes do escritório. Vamos ver tudo
> isso funcionando agora."

## 1:50 – 2:20 — Arquitetura (critério C)
**[Slide 5]**
> "A arquitetura é dividida em 3 camadas: o Hub de Convergência no front-end — webchat, portal web e o
> painel de clientes do e-CAC — a camada de Aplicação no back-end, com o motor de OCR em Python e dois
> motores de RPA, um em Node.js e outro em Python, e o banco de dados analítico, hospedado em nuvem."

## 2:20 – 2:45 — Stack tecnológico (critério C)
**[Slide 6]**
> "Do lado do front-end é HTML, CSS e JavaScript real, consumindo eventos em tempo real via
> Server-Sent Events. Do lado do back-end, Node.js com Express orquestra o fluxo e a autenticação; um
> microserviço Python com FastAPI roda o OCR de verdade — Tesseract mais OpenCV; e dois robôs de RPA
> distintos, um em Puppeteer para o Redesim, outro em Playwright para o e-CAC."
- Mostrar rapidamente o VS Code aberto: `server.js`, `hub/pipeline.js`, `ocr-service/main.py`,
  `robot/registroEmpresa.js`, `executerRPAEcac.py`.

## 2:45 – 3:55 — Interação técnica com a nuvem (critério C — o ponto mais importante da rubrica)
**[Slide 7]**

**(a) Demonstração ao vivo — upload e OCR real — 30s**
- Subir um documento real no painel, mostrar o console de eventos reagindo em tempo real e o card
  "Dados Extraídos" populando com CNPJ, Razão Social, Sócios — dados lidos de verdade do documento.

**(b) REQUEST DE GRAVAÇÃO — 40s**
> "Agora o ponto mais importante: aqui está o painel do Neon, nosso provedor de banco de dados
> PostgreSQL em nuvem. Antes do envio, a linha desta automação está assim [mostrar status
> 'aguardando_confirmação', já com CNPJ e Razão Social preenchidos]. Vou confirmar o envio no
> sistema..." **[clicar "Enviar ao Gov.br"]** "...e agora, de volta no Neon: a mesma linha atualizada
> em tempo real, com o protocolo que o robô acabou de gerar — o mesmo número que aparece na tela do
> portal."
- Usar a aba **Tables** do Neon (ou o **SQL Editor**), mostrando a linha antes e depois do clique.

**(c) REQUEST DE LEITURA — 30s**
> "E para provar que não é só escrita: aqui no SQL Editor do Neon, vou rodar uma consulta que junta
> a tabela fato com as dimensões de cliente, canal e status..." **[rodar o SELECT com JOIN]**
> "...e recupero exatamente os dados da automação que acabamos de processar, incluindo o tempo
> economizado, calculado automaticamente pelo próprio banco."
- Query sugerida (ver seção "Queries de apoio" abaixo).

## 3:55 – 4:35 — Segundo robô: Consulta e-CAC (critério B + C)
**[Slide 8]**
> "Além da Redesim, o GovFlow AI tem um segundo robô: a Consulta e-CAC. No painel, o contador cadastra
> os clientes do próprio escritório, cada um com seu CPF e senha — aqui, sempre contra um ambiente
> simulado, nunca o e-CAC real. Ao clicar em 'Consultar', o robô em Python e Playwright loga como
> aquele cliente específico e extrai a situação da declaração."
- **[Demonstração ao vivo]** Cadastrar (ou reutilizar) dois clientes com CPFs de paridades diferentes,
  disparar a consulta de cada um.
> "Repare: o Cliente A, com CPF terminado em dígito par, volta com tudo regular. Já o Cliente B, com
> CPF terminado em dígito ímpar, volta com uma pendência em 2024. Dois clientes diferentes, dois
> resultados diferentes — prova de que o robô está lendo o que está na tela, não repetindo um valor
> fixo."
- Opcional, se sobrar tempo: mostrar a mesma linha aparecendo/atualizando no Neon (mais um request de
  gravação, desta vez do segundo robô).

## 4:35 – 5:35 — Robôs em ação (critério C)
**[Slide 9]**
- Cortar para o console mostrando o robô da Redesim preenchendo o formulário (CNPJ, Razão Social,
  sócios) até o protocolo final aparecer na própria tela do portal fictício.
- Em seguida, cortar rapidamente para o console do robô do e-CAC completando o login simulado e
  extraindo a declaração.
> "Esse é o pipeline completo dos dois robôs: front-end e back-end reais, processando documentos e
> credenciais de verdade, gravando e consultando dados de um banco PostgreSQL hospedado na nuvem —
> sem nenhuma simulação no resultado final."

## 5:35 – 6:15 — Apresentação do Time (critério D)
**[Slide 10]**
> "Esse projeto foi desenvolvido por Pedro Henrique Amancio Lopes, RM551682, e Felipe Vazamim,
> RM97856."
- Mostrar o slide com foto + nome completo + RM de cada integrante.

## 6:15 – 7:00 — NEXT 2026 e Encerramento (critério D + fechamento)
**[Slide 11]**
> "Sobre o NEXT 2026: não, infelizmente não conseguiremos expor no NEXT 2026."
> "O GovFlow AI já tem cerca de 90% do MVP funcional rodando de ponta a ponta, com dois robôs de RPA,
> gestão de usuários e clientes, banco de dados em nuvem, IA e automação reais — tudo com requests
> reais de gravação e leitura demonstrados ao vivo. GovFlow AI: menos tempo em portal, mais tempo com
> o cliente. Obrigado!"

---

## Queries de apoio para a demonstração de leitura

Rodar no SQL Editor do Neon, ao vivo, durante a gravação.

**Automações da Redesim (com CNPJ/Razão Social já extraídos):**
```sql
SELECT
    f.protocolo_gerado,
    f.cnpj,
    f.razao_social,
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

**Clientes cadastrados para consulta e-CAC (segundo robô), com o resultado da última consulta:**
```sql
SELECT nome, cpf, status_consulta, declaracoes, atualizado_em
FROM clientes_ecac
ORDER BY atualizado_em DESC NULLS LAST
LIMIT 5;
```

## Checklist antes de gravar
- [ ] Servidor Node rodando (`node server.js`) e serviço de OCR rodando (`ocr-service`), ambos
      conectados ao Neon (`DATABASE_URL` preenchida no `.env`)
- [ ] Login de teste já configurado (evita perder tempo com formulários na gravação)
- [ ] Documento de teste pronto (`ocr-service/test-fixtures/contrato-social.pdf`) ou um documento real
- [ ] Pelo menos dois clientes já cadastrados em "Consulta e-CAC" com CPFs de paridades diferentes
      (ou prontos para cadastrar ao vivo)
- [ ] Aba do Neon aberta (Tables + SQL Editor) em outra janela/monitor, pronta para alternar
- [ ] Queries de leitura (acima) já digitadas, só faltando rodar
- [ ] Slides abertos em modo apresentação (`GovFlow-AI-Apresentacao-EC.pptx`)
- [ ] Fotos + nomes + RMs de todos os integrantes prontos (substituir os placeholders `[FOTO]` no
      slide 10 antes de exportar a versão final)
- [ ] Frase de disponibilidade para o NEXT 2026 definida pelo grupo — já cravada nos slides e no
      roteiro: "Não, infelizmente não conseguiremos expor no NEXT 2026."

## Após gravar
1. Publicar no YouTube como **"Não listado"** (não "Privado")
2. Copiar o link e inserir no documento de entrega (`docs/entrega-enterprise-challenge/`)
3. Conferir que o vídeo não ultrapassa 7 minutos
