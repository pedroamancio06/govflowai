# Roteiro do Vídeo de Demonstração — GovFlow AI
**Duração alvo: até 5 minutos — YouTube não listado**

Sugestão de gravação: compartilhar tela alternando entre os slides (`docs/apresentacao/GovFlow-AI-Apresentacao.pdf` ou o `.pptx` em modo apresentação) e o navegador com o sistema rodando. Ferramentas simples como OBS Studio, Loom ou a gravação de tela nativa do Windows (Win+Alt+R) funcionam bem.

---

## 0:00 – 0:30 — Abertura (Slide 1: Capa)
> "Olá! Eu sou [seu nome], e este é o GovFlow AI — uma automação inteligente de processos governamentais
> para contadores. Contadores como o Roberto, nosso persona, perdem boa parte do tempo útil do escritório
> em trabalho manual: triagem de documentos, redigitação de dados, protocolo em portais como o Redesim.
> Nos próximos minutos vou mostrar a evolução do projeto e o sistema rodando de verdade."

## 0:30 – 1:15 — O que evoluiu (Slide 2)
> "Desde a última entrega, o projeto saiu de uma prova de conceito — uma única rota sem banco de dados,
> sem autenticação, com dashboard todo simulado — para um MVP funcional de ponta a ponta: Hub conversacional
> com eventos em tempo real, SSO real, banco de dados em nuvem, motor de OCR real em Python, e um robô RPA
> que só age depois de uma confirmação humana explícita."

## 1:15 – 2:00 — Arquitetura e decisão de produto (Slides 3 e 4)
> "A arquitetura é dividida em 3 camadas: o Hub de Convergência, que é a porta de entrada — hoje um webchat,
> pronto para receber o WhatsApp Business real sem mudar a lógica; a camada de Aplicação, com o motor de OCR
> e o motor RPA; e o Painel de Gestão, o dashboard do contador.
>
> Uma decisão de produto que quero destacar: o robô não age sozinho. A IA extrai os dados do documento
> automaticamente, mas acionar o robô contra o portal do governo — uma ação real, de baixo custo de reverter —
> exige um clique explícito do usuário depois de ele revisar os dados extraídos."

## 2:00 – 4:00 — Demonstração ao vivo (sistema rodando)
**[Trocar para o navegador]**

1. **Login SSO** — mostrar o acesso ao dashboard, login único.
2. **Upload de documento** — arrastar um documento real (ou o PDF de teste em
   `ocr-service/test-fixtures/contrato-social.pdf`) e clicar "Iniciar Processamento".
3. **OCR em tempo real** — apontar o console mostrando os eventos reais chegando, e o card "Dados Extraídos"
   populando com CNPJ, Razão Social, Capital Social, Sócios — dados de verdade, extraídos pelo Tesseract.
4. **Pausa para confirmação** — destacar que o processamento parou e o botão "Enviar ao Gov.br" está
   habilitado, esperando o clique.
5. **Clicar "Enviar ao Gov.br"** — mostrar o robô preenchendo o portal em tempo real pelo console, até o
   protocolo final aparecer.

> "Viram: o documento foi lido de verdade, os dados aparecem aqui no painel, e só depois que eu clico em
> Enviar é que o robô entra em ação — preenche o formulário e volta com o protocolo."

## 4:00 – 4:40 — Viabilidade financeira (Slide 7)
> "Do lado do negócio: o modelo é Freemium, R$299 por mês no plano Pro. A margem de contribuição por
> cliente é de R$219, o CAC é R$250, e o LTV projetado é de quase R$4.000 — uma relação LTV sobre CAC de
> quase 16 vezes, bem acima do que o mercado considera saudável. Com esses números, o breakeven operacional
> — 18 clientes pagos — é atingido já no terceiro mês de operação."

## 4:40 – 5:00 — Encerramento (Slide 9)
> "O GovFlow AI já tem cerca de 80% do MVP funcional rodando de ponta a ponta, com programação real de
> front-end, back-end, IA e banco de dados em nuvem. O código está público no GitHub, e a documentação
> completa acompanha esta entrega. Obrigado!"

---

## Checklist antes de gravar
- [ ] Servidor Node rodando (`node server.js`) e serviço de OCR rodando (`ocr-service`)
- [ ] Banco de dados em nuvem conectado (não local)
- [ ] Login de teste já configurado (evita perder tempo com formulários na gravação)
- [ ] Documento de teste pronto (`ocr-service/test-fixtures/contrato-social.pdf`) ou um documento real
- [ ] Slides abertos em modo apresentação, prontos para alternar com o navegador

## Após gravar
1. Publicar no YouTube como **"Não listado"** (não "Privado" — o professor precisa acessar sem login)
2. Copiar o link e substituir os placeholders `[PREENCHER: link do vídeo]` em:
   - `docs/entrega-fase5/GovFlow-AI-Documentacao-Fase5.docx` (seção 4)
   - `docs/apresentacao/GovFlow-AI-Apresentacao.pptx` (adicionar na capa ou conclusão)
3. Reexportar os dois para PDF novamente após colar o link
