# spec-resend-email-tasks — Resend, convite/reset, Excel pós-prova, refresh HttpOnly

> Checkboxes: `[ ]` pendente, `[X]` feito. Fonte: [spec-resend-email.md](./spec-resend-email.md). Ordem sugerida top-down.

## 0. Pré-requisitos

- [X] Ler `spec-resend-email.md` (contratos HTTP + breaking changes front)
- [X] Conta Resend com domínio verificado + `EMAIL_FROM` definido para produção

## 1. Dependências & env [X]

- [X] `npm install resend`
- [X] `.env.example`: `RESEND_API_KEY`, `EMAIL_FROM`, `ADM_INVITE_EXPIRES_IN` (default `7d`), `ADM_RESET_EXPIRES_IN` (default `1h`) — **sem** commitar secrets reais
- [X] Helper `frontendBaseUrl()` — primeira origem de `FRONTEND_URL` (lista vírgula) para links de e-mail
- [X] Documentar envs no `AGENTS.md` / README (Render: `RESEND_API_KEY`, `EMAIL_FROM`)

## 2. Prisma — `AdmEmailToken` [X]

- [X] Enum `AdmEmailTokenPurpose`: `invite`, `password_reset`
- [X] Model `AdmEmailToken`: `id`, `email`, `admId?`, `purpose`, `tokenHash` unique, `expiresAt`, `usedAt?`, `createdAt`, `invitedByAdmId?` → FKs `Adm` com `onDelete: Cascade` onde aplicável
- [X] `npx prisma migrate dev --name add_adm_email_tokens` + `generate`
- [X] `test/mocks/in-memory-prisma.ts`: store `admEmailToken`, unique `tokenHash`, FK básico

## 3. MailModule [ ]

- [ ] `src/mail/mail.types.ts` — shape `SendMailOptions` (to, subject, html, attachments?)
- [ ] `src/mail/mail.service.ts` — abstract/injectable; `ResendMailService` se `RESEND_API_KEY`; senão no-op/log
- [ ] `src/mail/mail.module.ts` — export `MailService`
- [ ] `test/mocks/fake-mail.service.ts` — array `sent[]` para e2e (to, subject, html, attachments meta)
- [ ] Templates PT-BR (strings): assunto + HTML convite, reset, resultados (links absolutos)

## 4. Tokens opacos (convite/reset) [ ]

- [ ] Util compartilhado: `generateOpaqueToken()`, `hashToken()` (SHA-256, alinhado a refresh)
- [ ] Parser TTL env (`7d`, `1h`) → `Date` expiresAt
- [ ] `AdmEmailTokenService` (ou métodos em `AuthService`/`UserService`): criar, invalidar pendentes por email+purpose, consumir (validar exp/uso, set `usedAt`)

## 5. Convite ADM [ ]

- [ ] DTO `InviteUserDto` — `{ email }` + normalização lowercase trim
- [ ] `POST /users/invite` — JWT; 409 se Adm existe; invalidar invites pendentes mesmo email; criar token; enviar mail `{base}/aceitar-convite?token=`; **propagar erro** se Resend falhar
- [ ] DTO `AcceptInviteDto` — `{ token, senha }` + `MinLength` igual create-user
- [ ] `POST /auth/accept-invite` — público; cria Adm bcrypt; marca token usado; 400 inválido/expirado/usado; **sem** auto-login
- [ ] **Breaking**: `POST /users` — remover `senha` do DTO ou 400/410 apontando `/users/invite`
- [ ] Manter GET/PATCH/DELETE `/users` inalterados

## 6. Forgot / reset senha [ ]

- [ ] DTOs `ForgotPasswordDto`, `ResetPasswordDto`
- [ ] `POST /auth/forgot-password` — sempre 200 `{ message }` genérico; se Adm existe → token + mail `{base}/redefinir-senha?token=`
- [ ] `POST /auth/reset-password` — bcrypt; `usedAt`; `refreshToken.updateMany({ revoked: true })` para admId
- [ ] Wire `AuthModule` + `MailModule`; registrar rotas em `auth.controller.ts`

## 7. Excel ranking + e-mail pós-`completed` [ ]

- [ ] `ResultsExportService` — `buildRankingSpreadsheetBuffer(examId)` via `ResultsService.getRanking`
- [ ] Colunas: posição, nome, ponderada, redação, total, acertos, respondidas (2 casas decimais notas)
- [ ] `slugifyExamNome(nome)` → filename `resultados-{slug}-{examId}.xlsx`
- [ ] `ExamsService.updateStatus`: após update `completed`, `void notifyAdmsResultsEmail(examId).catch(log)` — **não** falhar PATCH
- [ ] Enviar um mail por Adm (`findMany` emails) com anexo; assunto PT-BR resultados
- [ ] Registrar `ResultsExportService` + deps no `ExamsModule`

## 8. Auth ADM — refresh em cookie HttpOnly [ ]

- [ ] Constantes cookie: nome (`refresh_token`), `Path`, `SameSite=Lax`, `HttpOnly`, `Secure` se production
- [ ] Helper `setRefreshCookie(res, token)` / `clearRefreshCookie(res)`
- [ ] `loginAdm`: body `{ access_token, adm }` **sem** `refresh_token`; `Set-Cookie` refresh
- [ ] `refresh`: ler JWT do cookie (não body); rotacionar; novo access JSON + novo cookie
- [ ] `logout`: ler cookie; revogar hash; `Clear-Cookie`
- [ ] `main.ts` CORS: `credentials: true`; origins de `FRONTEND_URL` (não `*`)
- [ ] Confirmar `POST /auth/aplicador` inalterado (sem cookie)
- [ ] Atualizar DTO `RefreshDto` / controller — refresh sem body obrigatório (breaking)

## 9. Testes unit [ ]

- [ ] `src/exams/results/results-export.service.spec.ts` — ExcelJS read-back headers + row count
- [ ] Ajustar `auth.service.spec.ts` / `auth.controller.spec.ts` para cookie helpers (mock `@Res()` se necessário)
- [ ] `user.service.spec.ts` — invite 409, accept paths (mock mail/token service)

## 10. Testes e2e [ ]

- [ ] `test/email-flow.e2e-spec.ts` — `overrideProvider(MailService)` + fake mail + InMemoryPrisma estendido
- [ ] Fluxo: login → invite → token do fake → accept-invite → login
- [ ] Fluxo: forgot → reset → login nova senha; refresh pré-reset → 401
- [ ] Fluxo: exam in_progress → PATCH completed → N emails com anexo
- [ ] accept-invite expirado → 400; invite email existente → 409
- [ ] Auth cookie: login `Set-Cookie` HttpOnly, body sem refresh; supertest agent refresh/logout; rotação; reset revoga cookie session
- [ ] Atualizar `test/enem-flow.e2e-spec.ts` se login/refresh quebrar (cookie + credentials)

## 11. Verificação final [ ]

- [ ] `npm run lint && npm run build && npm run test && npm run test:e2e`
- [ ] `npx prisma validate`
- [ ] Smoke manual (opcional): Resend sandbox + login cookie no browser com `credentials`

## 12. Docs & coordenação front [ ]

- [ ] Nota breaking: front — convite em vez de `POST /users` com senha; páginas `/aceitar-convite`, `/redefinir-senha`
- [ ] Nota breaking: front — access em memória; `credentials: 'include'` em refresh/logout; remover refresh do localStorage
- [ ] Marcar seção correspondente em `spec-tasks.md` ou link para este arquivo
- [ ] `[ ]` Issue tracker `ready-for-agent` (quando `/setup-matt-pocock-skills`)

## Fora deste checklist (spec Out of Scope)

- Telas Next.js, rate limit forgot-password, reenvio manual Excel, e-mail aplicador/participante, filas Bull, abas extras no Excel, BFF same-origin.
