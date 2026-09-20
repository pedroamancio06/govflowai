# Roteiro do Vídeo-Pitch — Startup One (FIAP)
**Duração alvo: até 5 minutos — YouTube não listado**

Estrutura alinhada às 6 seções avaliadas (5 pts cada, 30 pts totais): (a) Problema e Solução,
(b) Detalhes do Negócio — mercado, proposta de valor, concorrentes e diferenciais, receita e
projeções financeiras com breakeven, (c) Produto, (d) Go to Market, (e) Road Map, (f) Time
(com disponibilidade para o NEXT 2026). Cada slide traz, no canto superior direito, um selo com
a letra do critério e a faixa de tempo — facilita a correção.

Este roteiro reflete o **estado atual do projeto** (não o instantâneo da entrega da Fase 5, que
foi registrada antes do projeto avançar): dois robôs de RPA, login real via banco, gestão de
usuários e de clientes, e histórico completo com CNPJ/Razão Social já estão prontos e testados.

Sugestão de gravação: tela dividida ou alternada entre os slides (`GovFlow-AI-Apresentacao.pptx`
em modo apresentação) e o navegador/terminal para o trecho ao vivo do Produto. OBS Studio, Loom
ou a gravação nativa do Windows (Win+Alt+R) resolvem.

---

## 0:00 – 0:10 — Capa
**[Slide 1]**
> "Olá! Este é o GovFlow AI — automação inteligente de processos governamentais para escritórios
> de contabilidade. Nos próximos cinco minutos: o problema e a solução, o mercado, o produto, a
> estratégia de entrada, o que vem a seguir, e quem está por trás do projeto."

## 0:10 – 0:45 — Problema e Solução (Critério A)
**[Slide 2]**
> "Roberto, nosso persona, é sócio de um escritório de contabilidade. Ele perde boa parte do
> tempo útil do escritório em trabalho manual: triagem de documentos, redigitação de dados,
> protocolo em portais como o Redesim e o e-CAC — um processo que leva em média 40 minutos só
> pra abrir uma empresa, e se repete a cada cliente. O GovFlow AI resolve isso: o contador envia
> um documento pelo webchat ou pelo portal, com login validado contra o banco de dados; uma IA
> extrai CNPJ, Razão Social e sócios em segundos; um robô preenche o portal do governo e devolve
> o protocolo, exibido na própria tela; e o processo cai para poucos minutos, com histórico
> completo gravado."

## 0:45 – 1:20 — Mercado, Proposta de Valor e Receita (Critério B)
**[Slide 3]**
> "O mercado-alvo são escritórios de contabilidade de pequeno e médio porte no Brasil — a mesma
> persona Roberto, multiplicada por milhares de escritórios que fazem esse trabalho manualmente
> todo santo dia. A proposta de valor é objetiva: transformar um processo de 40 minutos em um
> fluxo de poucos minutos, com cada automação já nascendo com o tempo economizado registrado —
> prova de ROI mensurável desde o primeiro uso, sem precisar confiar na nossa palavra. O modelo
> de receita é Freemium: plano Free com 5 documentos por mês, plano Pro a R$299 com 100
> documentos, e onboarding assistido gratuito para os primeiros 50 escritórios-piloto."

## 1:20 – 1:55 — Concorrentes e Diferenciais (Critério B)
**[Slide 4]**
> "Pesquisamos o mercado e não encontramos nenhum concorrente direto — nenhum assistente
> conversacional com IA e RPA cobrindo múltiplos portais do governo, voltado a escritórios de
> contabilidade. Existe concorrência indireta: ERPs contábeis tradicionais, como Domínio,
> Alterdata e Questor, que são sistemas de gestão completos mas sem IA conversacional nem RPA
> ponta a ponta; ferramentas de captura pontual, como e-Auditoria e Robolabs, que só automatizam
> arquivos já estruturados, não documentos como um Contrato Social escaneado; e plataformas de
> gestão e BI, como Nibo, focadas em gestão financeira, não em executar ações reais contra
> portais do governo. Nosso diferencial: hub conversacional como porta de entrada, leitura de
> documento não estruturado, confirmação humana antes de qualquer ação real, cobertura de
> múltiplos serviços num único painel, e um preço Freemium acessível."

## 1:55 – 2:35 — Projeções Financeiras e Breakeven (Critério B)
**[Slide 5]**
> "Os números: margem de contribuição de R$219 por cliente do plano Pro por mês, CAC de R$250,
> uma relação LTV sobre CAC de 15,77 vezes — bem acima do benchmark de mercado, que considera
> saudável qualquer coisa acima de 3 vezes. O breakeven operacional — quando a margem de
> contribuição dos clientes pagos cobre o custo fixo mensal de R$3.800 — é atingido no Mês 3, com
> 18 clientes pagos ativos, exatamente conforme a meta. O fluxo de caixa acumulado, por causa do
> investimento em aquisição de clientes, só se aproxima do equilíbrio no Mês 6, com breakeven de
> caixa projetado para o Mês 8 — um padrão esperado e saudável para uma startup SaaS em estágio
> inicial."

## 2:35 – 3:20 — Produto (Critério C)
**[Slide 6]**
> "Como o produto funciona, na prática: o contador envia o documento — login real, não
> simulado; a IA extrai os dados com OCR e NLP; o usuário revisa e confirma o envio; e o robô
> preenche o portal e devolve o protocolo, gravado no banco em nuvem. E não é um robô só: são
> dois. O robô da Redesim, em Node.js com Puppeteer, cuida da abertura de empresa. O robô de
> Consulta e-CAC, em Python com Playwright, loga como o cliente selecionado e extrai a situação
> da declaração de Imposto de Renda. Os dois seguem a mesma regra: nunca agem sozinhos, sempre
> esperam a confirmação explícita do usuário."
- Se sobrar tempo/for gravar uma versão estendida: cortar rapidamente para o app real, mostrando
  o upload, o card "Dados Extraídos" populando, e o clique em "Enviar ao Gov.br".

## 3:20 – 3:50 — Go to Market (Critério D)
**[Slide 7]**
> "Nossa estratégia de entrada no mercado tem quatro frentes: o Hub de Convergência, com
> parceria Claro e WhatsApp Business, aproveitando a base corporativa da operadora sem custo de
> mídia paga; marketing direto a escritórios contábeis, com conteúdo educativo; parcerias
> institucionais com Conselhos Regionais de Contabilidade e sindicatos de classe; e um programa
> de indicação entre contadores. Para acelerar a curva de aprendizado, a promoção de lançamento
> oferece onboarding assistido gratuito para os primeiros 50 escritórios-piloto."

## 3:50 – 4:15 — Road Map (Critério E)
**[Slide 8]**
> "Desde a última entrega, o projeto avançou bastante: o segundo robô, o login real via banco,
> a gestão de usuários e clientes, e o histórico completo com CNPJ e Razão Social já estão
> prontos e testados. O que continua como próximo passo real: integração de verdade com a
> WhatsApp Business API — hoje o webchat já usa o mesmo contrato de eventos, pronto pra isso
> entrar sem reescrever nada; uma fila de mensagens assíncrona de verdade, com Redis; migração
> do front-end para React e Tailwind; e extração de atos societários pelo motor de OCR — hoje a
> gente lê CNPJ, Razão Social, Capital Social e o quadro de sócios, mas ainda não o tipo de ato
> registrado na Junta Comercial, como constituição ou alteração contratual."

## 4:15 – 4:45 — Time e NEXT 2026 (Critério F)
**[Slide 9]**
> "Esse projeto foi desenvolvido por Pedro Henrique Amancio Lopes, RM551682, e Felipe Vazamim,
> RM97856."
- Mostrar o slide com foto + nome completo + RM de cada integrante.
> "Sobre o NEXT 2026: não, infelizmente não conseguiremos expor no NEXT 2026."

## 4:45 – 5:00 — Conclusão
**[Slide 10]**
> "Resumindo: dois robôs de RPA reais, gestão completa de usuários e clientes, requests reais de
> gravação e leitura contra o PostgreSQL no Neon, e um unit economics saudável. GovFlow AI —
> menos tempo em portal, mais tempo com o cliente. Obrigado!"

---

## Checklist antes de gravar
- [ ] Slides abertos em modo apresentação (`docs/apresentacao/GovFlow-AI-Apresentacao.pptx`)
- [ ] Se for incluir o corte ao vivo no Produto (slide 6): servidor Node e serviço de OCR
      rodando, ambos conectados ao Neon (`DATABASE_URL` preenchida no `.env`), login de teste já
      configurado, documento de teste pronto
- [ ] Fotos dos integrantes prontas para substituir os placeholders `[FOTO]` no slide 9
- [ ] Frase do NEXT 2026 decorada ou escrita na tela: *"Não, infelizmente não conseguiremos
      expor no NEXT 2026."*
- [ ] Cronômetro visível para não estourar os 5 minutos

## Após gravar
1. Publicar no YouTube como **"Não listado"** (não "Privado")
2. Substituir `[PREENCHER: link do vídeo]` pelo link, na seção 4 (Anexos) e no cabeçalho de
   `docs/entrega-fase5/GovFlow-AI-Documentacao-Fase5.docx`, depois reexportar para PDF
3. Conferir que o vídeo não ultrapassa 5 minutos
