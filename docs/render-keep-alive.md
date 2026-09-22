# Keep-alive — Render (plano free)

Web services no Render **free** entram em sleep após ~15 minutos sem tráfego HTTP. Esta API já expõe `GET /` (público, sem JWT) — use esse endpoint no ping.

## Opção A — GitHub Actions (versionado no repo)

1. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**
2. Nome: `RENDER_SERVICE_URL` — valor: URL base do serviço (sem barra final), ex. `https://seu-app.onrender.com`
3. O workflow [`.github/workflows/render-keep-alive.yml`](../.github/workflows/render-keep-alive.yml) roda a cada **14 min** (`workflow_dispatch` também disponível; manual respeita a mesma janela).

**Janela diurna (economia de horas Render):** ping só entre **06:00 e 23:59** (`America/Sao_Paulo`). De **00:00 a 05:59** o job termina sem `curl` — o serviço pode dormir na madrugada. Após o último ping da noite (~**23:42**, último slot `*/14` na hora 23) até **06:00** há gap maior que 15 min; spin-down noturno é intencional. Cold start possível no primeiro ping ou na primeira request real do dia.

## Opção B — cron-job.org (sem GitHub)

1. Crie conta em [cron-job.org](https://cron-job.org)
2. **Create cronjob** → URL: `https://SEU-SERVICO.onrender.com/`
3. Schedule: a cada **10–14 minutos** (não use exatamente 15), **limitado ao horário diurno** (ex.: 06:00–23:59 no fuso do provedor ou equivalente)
4. Método: **GET**, timeout ≥ 120 s (cold start)

## Opção C — UptimeRobot

Monitor HTTP a cada **5 min** (free) na mesma URL — ping + alerta se cair. Se quiser a mesma economia, use janela de monitoramento diurna (quando o plano permitir) ou prefira a Opção A.

## Variáveis no Render (Dashboard → Environment)

| Variável | Obrigatória | Notas |
|----------|-------------|--------|
| `DATABASE_URL` | sim | Neon pooler |
| `DIRECT_URL` | sim | Neon direct (migrations) |
| `JWT_SECRET` | sim | |
| `JWT_REFRESH_SECRET` | sim | |
| `FRONTEND_URL` | sim | Origens CORS separadas por vírgula, ex. `https://seu-front.pages.dev,http://localhost:3001` |
| `PORT` | geralmente injetado | App usa `process.env.PORT ?? 3030` |

Opcionais já documentadas em [`.env.example`](../.env.example): `JWT_EXPIRES_IN`, `APLICADOR_JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.

**Health check path** no Render: `/` ou padrão do serviço.

## Validar

```bash
# Endpoint de keep-alive (unit + e2e local cobrem GET / → 200)
npm run test -- src/app.controller.spec.ts

# Com URL do deploy (local ou CI)
RENDER_SERVICE_URL=https://seu-app.onrender.com ./scripts/render-ping-check.sh
```

Checklist manual:

1. Script acima → HTTP **200**
2. Sem cron: idle ~20 min → logs Render indicam spin down
3. Com cron ativo: após 1–2 ciclos, `GET /` responde rápido
4. Front apontando para a API Render com `FRONTEND_URL` atualizado

O ping **não** consulta Postgres (Neon pode cold start na primeira request real com dados).

## Gotchas

- **Startup:** `Dockerfile` roda `prisma migrate deploy` antes de `node dist/main` — cold start pode levar 30s–2min.
