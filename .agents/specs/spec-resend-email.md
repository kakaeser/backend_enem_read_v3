# Spec: E-mail com Resend (convite ADM, reset de senha, Excel pós-prova)

> Label triage alvo: `ready-for-agent`. Issue tracker não configurado — rode `/setup-matt-pocock-skills` para publicar automaticamente; este arquivo é a fonte do spec.

## Problem Statement

Como organizador do ENEM da Read, preciso convidar colegas ADMs sem repassar senha por canal informal, permitir que qualquer ADM recupere o próprio acesso quando esquecer a senha, e receber no e-mail uma planilha com o ranking assim que encerramos uma edição. Hoje o backend cria ADMs com `POST /users` exigindo senha no corpo da requisição, não existe fluxo de “esqueci minha senha”, e ao marcar a prova como `completed` apenas persiste `encerramento` — sem export nem notificação por e-mail.

## Solution

Adicionar integração com **Resend** atrás de um `MailService` injetável (mockável em testes), persistir tokens de convite e reset como hash SHA-256 (padrão análogo aos refresh tokens), expor rotas de convite/aceite e forgot/reset, substituir a criação direta de ADM com senha por convite por e-mail, e ao concluir uma prova gerar automaticamente um `.xlsx` com o ranking (mesmos dados de `ResultsService.getRanking`) e enviar como anexo para **todos** os e-mails cadastrados em `adms`.

Em paralelo, endurecer auth **ADM**: deixar de expor `refresh_token` no JSON para guardar em `localStorage`; manter **access JWT** curto no body (uso em memória + header `Authorization`) e enviar **refresh JWT** apenas em cookie **`HttpOnly` + `Secure` + `SameSite`**, com rotação/revogação já existente no banco — reduz roubo de sessão via XSS.

## User Stories

1. As an ADM logado, I want convidar um novo ADM informando apenas o e-mail, so that ele receba um link seguro para criar a senha sem eu expor credenciais.
2. As a novo ADM convidado, I want abrir o link do e-mail e definir minha senha uma única vez, so that eu possa fazer login normalmente em seguida.
3. As a novo ADM convidado, I want que links expirados sejam rejeitados com erro claro (4xx), so that eu saiba que preciso pedir novo convite.
4. As a novo ADM convidado, I want que um link já utilizado não possa ser reutilizado, so that não haja takeover de conta.
5. As an ADM logado, I want que convite para e-mail já cadastrado retorne conflito (409), so that não existam duas contas com o mesmo e-mail.
6. As an ADM logado, I want que convite para e-mail com convite pendente ainda válido substitua ou invalide o anterior (decisão: **invalidar tokens invite anteriores** para o mesmo e-mail ao emitir novo), so that só o link mais recente funcione.
7. As an ADM logado, I want deixar de criar ADM via body com `senha` em `POST /users`, so that o único caminho de onboarding seja o convite por e-mail.
8. As an ADM logado, I want continuar listando/editando/removendo ADMs existentes via CRUD `/users`, so that governança de contas permaneça no painel.
9. As an ADM, I want solicitar redefinição de senha em rota pública com meu e-mail, so that eu recupere acesso sem depender de outro ADM.
10. As an ADM, I want receber e-mail com link de redefinição quando meu e-mail existir no sistema, so that eu defina nova senha no frontend.
11. As an ADM, I want que a resposta de “esqueci senha” seja idêntica exista ou não o e-mail, so that terceiros não descubram quais e-mails são ADMs.
12. As an ADM, I want concluir o reset informando token opaco + nova senha, so that minha senha seja atualizada com bcrypt.
13. As an ADM, I want que após reset bem-sucedido todos os meus refresh tokens sejam revogados, so that sessões antigas não continuem válidas.
14. As an ADM, I want que token de reset expire em prazo curto (default 1h), so that janela de ataque seja pequena.
15. As an ADM, I want que convite expire em prazo maior (default 7d), so that colegas tenham tempo de aceitar antes do evento.
16. As an ADM, I want TTL de convite e reset configurável por variáveis de ambiente, so that produção e staging possam divergir.
17. As an ADM, I want que ao marcar a prova `in_progress → completed` todos os ADMs recebam e-mail com anexo Excel, so that a equipe tenha o ranking offline imediatamente após encerrar.
18. As an ADM, I want o Excel com uma aba de ranking ordenada como na API (total desc, nome asc), so that a planilha reflita a classificação oficial.
19. As an ADM, I want colunas no Excel: posição (1-based), nome, nota ponderada, redação, total, acertos, respondidas, so that eu analise desempenho sem abrir o painel.
20. As an ADM, I want o Excel incluir apenas participantes com `presenca: true`, so that o arquivo coincida com `GET /exams/:examId/results`.
21. As an ADM, I want nome de arquivo descritivo (`resultados-{slug}-{examId}.xlsx`), so that eu identifique a edição no inbox.
22. As an ADM, I want assuntos e corpo dos e-mails em português (convite, redefinição, resultados), so that a comunicação seja clara para a igreja.
23. As an ADM, I want que falha no Resend ao enviar Excel **não** desfaça a transição para `completed`, so that o estado da prova no banco seja fonte de verdade.
24. As an ADM, I want que falha no envio de convite/reset retorne erro HTTP ao ADM que disparou (diferente do Excel pós-prova), so that eu saiba reenviar o convite.
25. As a operador de deploy, I want documentar `RESEND_API_KEY`, `EMAIL_FROM` e `FRONTEND_URL` no Render, so that links nos e-mails apontem ao front correto.
26. As a operador, I want `EMAIL_FROM` usar domínio verificado no Resend, so that entregabilidade seja aceitável.
27. As a desenvolvedor, I want `MailService` no-op ou log quando `RESEND_API_KEY` estiver ausente, so that `npm run test` e dev local funcionem sem conta Resend.
28. As a desenvolvedor, I want testes e2e com mock de mail capturando destinatário, assunto e metadados de anexo, so that CI não dependa de API externa.
29. As a desenvolvedor, I want unit test leve no gerador Excel validando cabeçalhos e contagem de linhas, so that regressões na exportação sejam detectadas cedo.
30. As an ADM bootstrap via seed, I want `admin@read.local` continuar existindo sem passar por convite, so that ambientes de desenvolvimento não exijam Resend.
31. As an Aplicador, I want que nenhum fluxo de e-mail me afete, so that escopo permaneça restrito a `Adm`.
32. As a visitante da página pública de resultados, I want que divulgação em 2 dias após encerramento permaneça inalterada, so that e-mail de Excel não antecipe ranking público.
33. As a sistema, I want armazenar só hash SHA-256 do token opaco, so that vazamento do banco não permita reset/convite direto.
34. As a sistema, I want token opaco gerado com entropia criptográfica (ex.: `randomUUID`), so that adivinhação seja inviável.
35. As an ADM convidado, I want após aceitar convite fazer login via `POST /auth/login` normalmente, so that não haja auto-login automático no aceite (menor superfície).
36. As an ADM, I want validação de senha mínima (mesmo `MinLength` do DTO atual) no aceite e no reset, so that política de senha seja consistente.
37. As an ADM logado, I want poder reenviar convite para o mesmo e-mail se o anterior expirou, so that onboarding não trave.
38. As an ADM, I want receber no máximo um e-mail de resultados por transição para `completed` (sem duplicata se PATCH repetido), so that o inbox não spam (transição `completed` já é terminal no state machine).
39. As a equipe, I want links no e-mail usar paths acordados com o front: `/aceitar-convite?token=` e `/redefinir-senha?token=`, so that o Next.js implemente as telas correspondentes.
40. As a sistema, I want revogar refresh tokens do ADM também ao aceitar convite não aplicável (N/A — conta nova), so that escopo de revogação focado em reset de senha.
41. As an ADM, I want que o refresh token não fique acessível a JavaScript no browser (`localStorage`/`sessionStorage`), so that XSS não roube sessão longa com um `getItem`.
42. As an ADM, I want o refresh token em cookie HttpOnly enviado pelo backend no login e na rotação, so that o browser renove a sessão sem persistir credencial longa no SPA.
43. As an ADM, I want continuar usando access token curto (15m) no header Bearer, mantido só em memória no front, so that chamadas à API permaneçam stateless e compatíveis com guards atuais.
44. As an ADM, I want `POST /auth/refresh` usar o cookie automaticamente (`credentials: 'include'`) em vez de body com refresh, so that o contrato reflita cookie-based refresh.
45. As an ADM, I want `POST /auth/logout` limpar o cookie de refresh e revogar no banco, so that encerrar sessão seja efetivo no client e no servidor.
46. As a desenvolvedor front, I want CORS com `credentials: true` e origem explícita (`FRONTEND_URL`), so that cookies de refresh funcionem cross-origin Render ↔ Cloudflare Pages.
47. As a sistema, I want mitigar CSRF em rotas que leem cookie (`refresh`, `logout`) via `SameSite=Lax` (SPA same-site) e POST-only, so that cookie auth não troque XSS por CSRF trivial.
48. As an Aplicador, I want login aplicador inalterado (só access JWT 6h, sem refresh cookie), so that escopo de cookies fique restrito a Adm.

## Implementation Decisions

- **Provider**: [Resend](https://resend.com) via SDK npm `resend`; chave `RESEND_API_KEY`.
- **Abstração**: `MailService` com método `send({ to, subject, html, attachments?: { filename, content }[] })`; implementação `ResendMailService`; em testes, fake que acumula mensagens em memória.
- **Módulo Nest**: `MailModule` exportando `MailService`; importado por `AuthModule`, `UserModule`, `ExamsModule` (ou `@Global()` se simplificar wiring).
- **Variáveis de ambiente**:
  - `RESEND_API_KEY` — obrigatório em produção; opcional em dev/test (no-op).
  - `EMAIL_FROM` — ex.: `ENEM Read <noreply@seudominio.com>`.
  - `FRONTEND_URL` — já usada para CORS; usar base URL (primeira origem se lista separada por vírgula) para montar links.
  - `ADM_INVITE_EXPIRES_IN` — default `7d` (parse para ms ou usar convenção similar a JWT).
  - `ADM_RESET_EXPIRES_IN` — default `1h`.
- **Schema Prisma** — enum `AdmEmailTokenPurpose { invite password_reset }`; model `AdmEmailToken`:
  - `id` cuid PK
  - `email` string (normalizado lowercase trim)
  - `admId` int nullable FK → `Adm` (null em invite antes da conta existir; preenchido em password_reset)
  - `purpose` enum
  - `tokenHash` string unique
  - `expiresAt` datetime
  - `usedAt` datetime nullable
  - `createdAt` datetime
  - `invitedByAdmId` int nullable FK → `Adm` (auditoria opcional em invite)
  - On delete Adm: cascade tokens ligados; invite pendente só tem email até aceite cria Adm.
- **Hash de token**: SHA-256 do token plaintext (mesma função conceitual que refresh tokens); cliente recebe token só no e-mail e no body de accept/reset.
- **API — convite**:
  - `POST /users/invite` — JWT Adm; body `{ email }`; 409 se Adm existe; invalida invites pendentes mesmo email; cria token + envia e-mail; 503/502 se Resend falhar (decisão: **500 com mensagem genérica** ou 503).
  - `POST /auth/accept-invite` — público; body `{ token, senha }`; cria Adm + bcrypt; marca `usedAt`; 400 token inválido/expirado/usado.
  - **Breaking**: remover `senha` de `POST /users` ou retornar 410/400 orientando usar `/users/invite` — não criar Adm com senha pelo painel.
- **API — reset**:
  - `POST /auth/forgot-password` — público; `{ email }`; sempre `{ message: 'Se o e-mail existir, enviaremos instruções.' }` (200).
  - `POST /auth/reset-password` — público; `{ token, senha }`; atualiza senha; `usedAt`; `refreshToken.updateMany({ revoked: true })` para o admId.
- **API — Excel**:
  - Sem endpoint dedicado no MVP; side effect em `ExamsService.updateStatus` quando novo status é `completed`.
  - Serviço `ResultsExportService` (ou método em results): chama lógica de ranking existente, monta workbook ExcelJS uma worksheet, retorna `Buffer`.
  - Slug do nome da prova: sanitizar (lowercase, non-alphanum → hífen, truncar).
  - Após `exam.update` bem-sucedido: buscar todos emails ADM; para cada um, `MailService.send` com anexo; executar em background (Promise sem await no controller path) com `.catch` log — resposta PATCH retorna exam updated sem esperar todos os envios.
- **Conteúdo ranking Excel**: iterar array já ordenado de `getRanking`; colunas fixas PT-BR; números com precisão razoável (2 casas para notas).
- **E-mail HTML**: templates string simples (sem React Email no MVP); incluir link absoluto e texto alternativo.
- **In-memory Prisma nos testes**: estender mock com store `admEmailToken` e regras unique em `tokenHash`.

### Auth ADM — JWT com refresh em cookie HttpOnly

**Contexto**: hoje `POST /auth/login` devolve `{ access_token, refresh_token }` no JSON; SPAs costumam gravar ambos no `localStorage`, o que permite a qualquer script (XSS) exfiltrar refresh e manter sessão. JWT continua sendo o formato dos tokens; muda **onde** o refresh vive no client.

**Modelo alvo (access curto + refresh protegido)**:

| Token | TTL | Cliente | Transporte |
|-------|-----|---------|------------|
| Access JWT | 15m (`JWT_EXPIRES_IN`) | Memória do SPA (nunca `localStorage`) | Header `Authorization: Bearer` |
| Refresh JWT | 7d (`JWT_REFRESH_EXPIRES_IN`) | Cookie HttpOnly | `Set-Cookie` no login/refresh; browser envia em `POST /auth/refresh` e `POST /auth/logout` |

**Backend (Nest)**:

- `POST /auth/login` (Adm): resposta JSON `{ access_token, adm: { id, email } }` — **sem** `refresh_token` no body; header `Set-Cookie` com refresh (valor = JWT refresh atual, hash continua em `refresh_tokens`).
- `POST /auth/refresh`: ler refresh **do cookie** (nome fixo, ex. `refresh_token`); rotacionar como hoje (revoga hash antigo, emite novo access + novo cookie); **não** aceitar refresh no body no contrato novo (breaking para front antigo).
- `POST /auth/logout`: ler cookie, revogar hash no banco, responder `Clear-Cookie` (max-age 0) + JSON de confirmação.
- Atributos do cookie (produção): `HttpOnly; Secure; SameSite=Lax; Path=/auth` (ou `Path=/` se refresh/logout forem os únicos consumidores — documentar nome e path no front).
- Dev local HTTP: `Secure` condicional (`NODE_ENV !== 'production'` pode omitir Secure só em localhost, se necessário para testes manuais).
- **CORS** em `main.ts`: `credentials: true`; `origin` não pode ser `*` — usar lista de `FRONTEND_URL` (já previsto para CORS).
- **CSRF**: `SameSite=Lax` + métodos POST para refresh/logout; se no futuro houver form cross-site, avaliar token CSRF (fora do MVP deste spec salvo necessidade).
- **Reset de senha / convite**: após `reset-password`, revogar refresh tokens no banco **e** documentar que front deve chamar logout ou ignorar cookie obsoleto até próximo login.
- **Aplicador**: `POST /auth/aplicador` permanece só `{ access_token, aplicador }` — sem cookie de refresh.

**Frontend (contrato, fora do repo backend)**:

- Remover persistência de tokens em `localStorage`/`sessionStorage`.
- Guardar `access_token` em memória (context/store volátil); anexar Bearer em fetch/axios.
- Todas as chamadas ao API: `credentials: 'include'` quando usar refresh/logout.
- Interceptor 401: tentar `POST /auth/refresh` uma vez com cookie, atualizar access em memória, repetir request.

### Contratos HTTP (resumo)

| Método | Rota | Auth | Body | Sucesso |
|--------|------|------|------|---------|
| POST | `/users/invite` | Bearer Adm | `{ email }` | 201 `{ message, email }` |
| POST | `/auth/accept-invite` | — | `{ token, senha }` | 201 `{ message }` |
| POST | `/auth/forgot-password` | — | `{ email }` | 200 `{ message }` |
| POST | `/auth/reset-password` | — | `{ token, senha }` | 200 `{ message }` |
| PATCH | `/exams/:id/status` | Bearer Adm | `{ status: 'completed' }` | 200 exam + e-mails async |
| POST | `/auth/login` | — | `{ email, senha }` | 200 `{ access_token, adm }` + `Set-Cookie` refresh HttpOnly |
| POST | `/auth/refresh` | Cookie refresh | — | 200 `{ access_token }` + `Set-Cookie` refresh rotacionado |
| POST | `/auth/logout` | Cookie refresh | — | 200 + `Clear-Cookie` |

## Testing Decisions

- **Definição de bom teste**: verificar comportamento observável — status HTTP, shape JSON, existência de Adm após aceite, senha alterada após reset, mensagens capturadas no fake mail — sem assertar implementação interna do Resend SDK.
- **Seam principal (confirmado com o dev)**: API HTTP e2e com `Test.createTestingModule` + `overrideProvider(MailService)` + `InMemoryPrisma`, arquivo dedicado `test/email-flow.e2e-spec.ts` (ou extensão de `enem-flow.e2e-spec.ts`).
- **Cenários e2e mínimos**:
  1. ADM logado → invite → extrair token do fake mail → accept-invite → login OK.
  2. forgot-password → token no fake → reset-password → login com nova senha; refresh token emitido antes do reset → refresh 401.
  3. Prova `in_progress` → PATCH `completed` → fake mail recebe N envios (N = número de ADMs) com attachment filename matching pattern e tamanho > 0.
  4. accept-invite token expirado (mock data `expiresAt` no passado) → 400.
  5. invite email já cadastrado → 409.
- **Auth cookie (e2e)**:
  1. login Adm → assert `Set-Cookie` com `HttpOnly` e body **sem** `refresh_token`; guardar cookie no supertest agent.
  2. `POST /auth/refresh` com cookie → novo `access_token` e cookie rotacionado; refresh antigo no banco revogado.
  3. `POST /auth/logout` → cookie limpo; refresh subsequente 401.
  4. login → emitir refresh → reset-password → refresh com cookie antigo 401.
- **Unit**: `results-export.service.spec.ts` — dado ranking mock/fixture, buffer gerado re-lido com ExcelJS: worksheet name, header row, row count = ranking length.
- **Prior art**: `src/auth/auth.service.spec.ts`, `src/exams/results/results.service.spec.ts`, `test/mocks/in-memory-prisma.ts`, padrão `overrideGuard(JwtAuthGuard)` onde necessário.
- **Não testar**: entrega real Resend, conteúdo HTML renderizado no cliente de e-mail, performance de anexos grandes.

## Out of Scope

- Telas Next.js para aceitar convite e redefinir senha (apenas contrato de URL com query `token`).
- E-mail para aplicadores, participantes ou visitantes.
- Reenvio manual de Excel, filas (Bull), workers ou cron.
- Abas extras no Excel (estatísticas, detalhe por questão, gabarito).
- Templates rich (React Email), i18n além de PT-BR.
- Rate limiting em `forgot-password` e audit trail de envios (follow-up).
- Notificação quando prova entra em `in_progress`.
- Alterar regra de divulgação pública (+2 dias).
- OAuth / magic link login sem senha.
- Padrão BFF (Backend for Frontend) com domínio único — cookie HttpOnly no mesmo host do SPA; aqui API Render e front Cloudflare permanecem cross-origin com CORS + credentials.

## Further Notes

- **Front-end**: implementar rotas `/aceitar-convite` e `/redefinir-senha` que leem `token` da query e chamam `POST /auth/accept-invite` e `POST /auth/reset-password`.
- **Deploy Render**: adicionar `RESEND_API_KEY`, `EMAIL_FROM` ao lado de `JWT_*`; manter `FRONTEND_URL` alinhado ao Cloudflare Pages.
- **Breaking change**: coordenar com front para trocar formulário “criar ADM” por “convidar por e-mail”.
- **Breaking change auth**: front deve migrar refresh de `localStorage` para cookie (`credentials: 'include'`) e access só em memória; atualizar `POST /auth/refresh` e `logout` no client.
- **Segurança**: HttpOnly mitiga XSS no refresh; ainda exige CSP/higiene XSS no front; access em memória some ao fechar aba (UX esperada).
- **Issue tracker**: publicar este documento como issue com label `ready-for-agent` quando `/setup-matt-pocock-skills` estiver ativo.
- **Pós-implementação**: `npm run lint && npm run build && npm run test && npm run test:e2e`.
- **Tasks de implementação**: checklist executável em [spec-resend-email-tasks.md](./spec-resend-email-tasks.md).
