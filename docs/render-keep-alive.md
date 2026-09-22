# Keep-alive — Render (plano free)

Web services no Render **free** entram em sleep após ~15 minutos sem tráfego HTTP. Esta API já expõe `GET /` (público, sem JWT) — use esse endpoint no ping.

## cron-job.org (recomendado)

1. Crie conta em [cron-job.org](https://cron-job.org)
2. **Create cronjob** → URL: `https://SEU-SERVICO.onrender.com/`
3. Schedule: a cada **10–14 minutos** (não use exatamente 15)
4. Método: **GET**, timeout ≥ 120 s (cold start)
5. **Janela diurna (economia de horas Render):** limite o job a **06:00–23:59** (`America/Sao_Paulo` ou fuso equivalente no painel). De **00:00 a 05:59** não pingar — o serviço pode dormir na madrugada. Após o último ping da noite até **06:00** há gap maior que 15 min; spin-down noturno é intencional. Cold start possível no primeiro ping ou na primeira request real do dia.

## Alternativa — UptimeRobot

Monitor HTTP a cada **5 min** (free) na mesma URL — ping + alerta se cair. Se quiser a mesma economia, use janela de monitoramento diurna (quando o plano permitir).

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
# Endpoint de keep-alive (unit test cobre GET / → 200)
npm run test -- src/app.controller.spec.ts

# Com URL do deploy
RENDER_SERVICE_URL=https://seu-app.onrender.com ./scripts/render-ping-check.sh
# ou: ./scripts/render-ping-check.sh https://seu-app.onrender.com
```

Checklist manual:

1. Script acima → HTTP **200**
2. Sem cron: idle ~20 min → logs Render indicam spin down
3. Com cron ativo: após 1–2 ciclos, `GET /` responde rápido
4. Front apontando para a API Render com `FRONTEND_URL` atualizado

O ping **não** consulta Postgres (Neon pode cold start na primeira request real com dados).

## Gotchas

- **Startup:** `Dockerfile` roda `prisma migrate deploy` antes de `node dist/main` — cold start pode levar 30s–2min.
- **Observe:** cada request passa pelo instrument NestJS Observe; evite ping excessivo (< 5 min) se gerar ruído.
