# Smoke manual — Resend, convite, cookie (opcional)

Roteiro após deploy ou `start:dev` com env real. Não faz parte do CI.

## Pré-requisitos

- `RESEND_API_KEY` e `EMAIL_FROM` (domínio verificado no Resend)
- `FRONTEND_URL` apontando para o front que implementará `/aceitar-convite` e `/redefinir-senha`
- Adm existente (ex.: `npm run seed` → `admin@read.local` / `admin123`)

## Checklist

1. **Cookie auth** — Login Adm no browser; DevTools → Application → cookie `refresh_token` (path `/auth`, HttpOnly); resposta JSON sem `refresh_token`.
2. **Convite** — `POST /users/invite` com Bearer → e-mail recebido → abrir link → `accept-invite` → login com nova senha.
3. **Reset** — `POST /auth/forgot-password` → e-mail → `reset-password` → login; refresh anterior retorna 401.
4. **Excel** — Prova `in_progress` → participante com `presenca: true` → `PATCH` status `completed` → um e-mail por Adm com anexo `resultados-*.xlsx`.
