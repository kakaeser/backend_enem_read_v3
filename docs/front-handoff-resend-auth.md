# Handoff — front (Resend, convite, reset, cookie refresh)

Contrato do backend após [spec-resend-email](../.agents/specs/spec-resend-email.md). Implementação das telas Next.js fica no repositório do front.

## Breaking — onboarding ADM

- Remover criação via `POST /users` com `senha` (rota removida).
- Painel: `POST /users/invite` com body `{ email }` e header `Authorization: Bearer <access>`.
- Resposta **201** `{ message, email }`; **409** se o e-mail já é Adm.
- E-mail com link absoluto: `{FRONTEND_BASE}/aceitar-convite?token=...` (base = primeira origem de `FRONTEND_URL` no backend).
- Página `/aceitar-convite`: ler `token` da query → `POST /auth/accept-invite` `{ token, senha }` (**201**) → redirecionar para login (**sem** auto-login / tokens no aceite).

## Breaking — sessão Adm

- **Access JWT** só em memória no SPA (não `localStorage` / `sessionStorage`).
- **Refresh** não vem no JSON do login; o backend envia cookie `refresh_token` (`HttpOnly`, `SameSite=Lax`, path `/auth`, `Secure` em produção).
- Chamadas `POST /auth/refresh` e `POST /auth/logout`: `fetch(..., { credentials: 'include' })` (ou equivalente axios).
- `POST /auth/refresh` **não** usa body com refresh; só o cookie.
- Login responde **201** com `{ access_token, adm: { id, email } }` (sem `refresh_token` no body). Tratar sucesso como **2xx** se o client for genérico.

## Breaking — recuperação de senha

- Página `/redefinir-senha?token=...` → `POST /auth/reset-password` `{ token, senha }` → **200** `{ message }`.
- `POST /auth/forgot-password` `{ email }` → sempre **200** `{ message: 'Se o e-mail existir, enviaremos instruções.' }` (mesma resposta exista ou não o Adm).
- Após reset bem-sucedido, refresh antigo no cookie deixa de funcionar (**401** em `/auth/refresh`); orientar logout ou novo login.

## Tabela HTTP (rotas novas / alteradas)

| Método | Rota | Auth | Body | Sucesso |
|--------|------|------|------|---------|
| POST | `/users/invite` | Bearer Adm | `{ email }` | 201 |
| POST | `/auth/accept-invite` | — | `{ token, senha }` | 201 |
| POST | `/auth/forgot-password` | — | `{ email }` | **200** |
| POST | `/auth/reset-password` | — | `{ token, senha }` | **200** |
| POST | `/auth/login` | — | `{ email, senha }` | 201* + `Set-Cookie` |
| POST | `/auth/refresh` | Cookie | — | 201* + `Set-Cookie` |
| POST | `/auth/logout` | Cookie | — | 201* + `Clear-Cookie` |

\*Nest default em POST; cliente pode aceitar qualquer **2xx**.

## CORS e links nos e-mails

- Origem do Cloudflare Pages (e `localhost` em dev) deve estar em `FRONTEND_URL` no Render (lista separada por vírgula).
- Backend: `credentials: true` e origens explícitas em `main.ts`.
- Links de convite/reset usam a **primeira** entrada de `FRONTEND_URL`.

## Side effect (sem mudança no painel)

- Ao `PATCH /exams/:id/status` com `{ status: 'completed' }`, cada Adm recebe e-mail com anexo Excel do ranking (assíncrono; falha de envio **não** reverte o status).

## Aplicador

- `POST /auth/aplicador` inalterado: só `{ access_token, aplicador }`, sem cookie de refresh.

## Referências

- Checklist backend: [spec-resend-email-tasks.md](../.agents/specs/spec-resend-email-tasks.md)
- Smoke manual (opcional): [smoke-resend-email.md](./smoke-resend-email.md)
