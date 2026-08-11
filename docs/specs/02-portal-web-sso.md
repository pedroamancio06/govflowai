# Spec 02 — Aba/Módulo Portal Web (Single Sign-On)

**Camada:** 1 — Hub de Convergência
**Status:** MVP implementado (SSO simulado) — ver nota abaixo.

## 0. Nota de Implementação (MVP)

Implementado o fluxo completo de Authorization Code (padrão OIDC) em `auth/` (`router.js`, `middleware.js`, `sessions.js`, `tenantStore.js`, `idpMock.js`), protegendo `/page.html` em `server.js` antes do `express.static`. Cobre RF01-RF05 com as seguintes simplificações conscientes:

- **IdP:** como não há credenciais reais do ecossistema Claro disponíveis, `auth/idpMock.js` simula o Identity Provider localmente (mesmo padrão usado em `portal_fake.html` para o robô) — implementa o protocolo real (Authorization Code + `state` anti-CSRF + código de uso único com TTL de 60s), então trocar pelo IdP real da Claro é troca de um módulo, não do fluxo.
- **`DIM_CLIENTE` (spec 06):** `auth/tenantStore.js` é um Map em memória que provisiona um "escritório" automaticamente no primeiro login por e-mail (RF03) — vira persistente quando a spec 06 existir.
- **Sessão (RF04):** cookie `httpOnly`/`SameSite=Lax` com TTL de 30 min, renovado a cada requisição válida (sliding window) — não é um refresh-token OIDC real, que só faz sentido contra um IdP de verdade.
- **RF05 (isolamento multi-tenant):** `auth/middleware.js` expõe `requireSessaoApi`/`requireSessaoPagina`, que resolvem `req.clienteId` a partir da sessão — nenhuma rota deve aceitar `id_cliente` vindo do cliente. `GET /portal/whoami` é o exemplo de referência; specs 07/08/09 devem seguir o mesmo padrão.
- **Testado:** acesso sem sessão (redirect HTML / 401 JSON), fluxo completo de login, dois escritórios distintos resolvendo para `id_cliente` diferentes, `state` forjado rejeitado, `code` de uso único rejeitado no replay, logout, e confirmação de que `/webchat.html` (canal da spec 01) permanece público — sessão só é exigida no portal web.

## 1. Objetivo

Permitir que o Roberto (ou o gestor do escritório) acesse o GovFlow AI como uma aba dentro do ecossistema/portal Claro, sem precisar de um login separado — reduzindo fricção de adoção e reforçando o posicionamento de "hub único".

## 2. Estado Atual / Gap

O `public/page.html` atual é servido publicamente por `express.static("public")` ([server.js:12](../../server.js)) sem nenhuma autenticação — qualquer pessoa com a URL acessa o dashboard. Não há conceito de usuário, sessão, ou tenant/escritório associado aos dados.

## 3. Requisitos Funcionais

- RF01 — O GovFlow AI deve aceitar um token de identidade emitido pelo Identity Provider (IdP) do ecossistema Claro (padrão OIDC/SAML) e trocá-lo por uma sessão interna válida.
- RF02 — Ao acessar a URL do módulo sem sessão válida, redirecionar para o fluxo de autenticação do IdP Claro (não para uma tela de login própria).
- RF03 — O token/claims recebidos do IdP devem mapear para uma entidade `DIM_CLIENTE` (escritório) existente no banco (ver [spec 06](06-banco-dados-dw.md)) — se não houver mapeamento, iniciar fluxo de provisionamento (onboarding do escritório).
- RF04 — Sessão expira e força reautenticação silenciosa (refresh) sem derrubar o usuário no meio de uma visualização.
- RF05 — Toda chamada às APIs do dashboard (specs 07/08/09) deve carregar o contexto do `DIM_CLIENTE` autenticado — nenhuma consulta cross-tenant é permitida.

## 4. Requisitos Não Funcionais

- Nenhum dado do dashboard (specs 07-09) deve ser acessível sem sessão válida — remover o `express.static` público atual como caminho de acesso a dados reais.
- Tokens não devem ser expostos em URL (query string); usar cookies `httpOnly`/`secure` ou header `Authorization`.
- Auditoria: todo acesso ao dashboard deve gerar um log de acesso (quem, quando, de qual escritório) para requisitos de LGPD/segurança.

## 5. Contrato (alto nível)

```
GET /portal/callback?code=...        -- recebido do IdP Claro (Authorization Code flow)
     → troca code por token, cria sessão, resolve DIM_CLIENTE
     → redireciona para /portal/dashboard

Toda API do dashboard exige:
  Authorization: Bearer <session_token>
  → resolve automaticamente id_cliente no backend a partir da sessão
```

## 6. Critérios de Aceite

- [ ] Acessar a URL do módulo sem sessão redireciona corretamente para o login Claro.
- [ ] Após login, o usuário só enxerga dados do próprio escritório (`DIM_CLIENTE`), mesmo havendo outros tenants no banco.
- [ ] Sessão expirada força reautenticação sem perda do estado de navegação.
- [ ] Nenhuma rota de dashboard responde sem token válido (testar com `curl` sem header `Authorization` → 401).

## 7. Dependências

- Definição do IdP/protocolo do ecossistema Claro (OIDC vs. SAML) — a confirmar com o time Claro do challenge.
- [Spec 06 — Banco de Dados/DW](06-banco-dados-dw.md) para o modelo `DIM_CLIENTE`.

## 8. Fora de Escopo

- Login social (Google/Facebook) — apenas SSO corporativo Claro no MVP.
- Gestão de múltiplos usuários por escritório com perfis diferentes (RBAC granular) — no MVP, 1 sessão = 1 escritório com acesso total aos próprios dados.
