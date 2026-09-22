<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

> **ENEM da Read v3** — Refatoração do `enem_read` (FastAPI + SQLAlchemy) para NestJS. Sistema de correção/divulgação do ENEM da Read (8ª Igreja Presbiteriana, ~60 participantes/edição, ~70 questões + redação). Fluxo MVP manual: criar prova → questões/pesos em lote → participantes (Excel `.xlsx`, só coluna `nome`) → gabarito → respostas → notas ponderadas + redação → ranking. Ver `AGENTS.md` para modelo de dados e `prisma/schema.prisma` para schema.
>
> **Resultados públicos:** `GET /resultados` (tabela, só provas `completed` + 2 dias), `GET /resultados/:examId` (ranking) e `GET /resultados/:examId/:participantId` (detalhe com enunciado/alternativas/marcada/correta + `notas {ponderada, redacao, total}`). Antes de `encerramento + 2 dias` retornam `403` (divulgação por link, sem cron nem WebSocket).

## Project setup

```bash
$ npm install
$ cp .env.example .env  # preencha DATABASE_URL/DIRECT_URL (Neon) + JWT_SECRET/JWT_REFRESH_SECRET/APLICADOR_JWT_EXPIRES_IN + FRONTEND_URL
$ npx prisma validate
$ npx prisma migrate deploy  # ou migrate dev --name init em dev
$ npx prisma generate
$ npm run seed       # restaura backup legado database.db (opcional, dados reais — gitignored)
$ npm run seed:test  # prova teste id 999 (30q/10parts, prompt iniciar/limpar, não apaga o resto)
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

> ESM: imports com `.js` (`from './app.module.js'`) obrigatório por `nodenext`. `PORT` vem de `process.env.PORT ?? 3030` (Render injeta). CORS liberado via `FRONTEND_URL` (lista por vírgula).

## Run tests

```bash
# unit tests
$ npm run test        # vitest run, **/*.spec.ts

# e2e tests
$ npm run test:e2e    # vitest --config ./vitest.config.e2e.ts, **/*.e2e-spec.ts

# test coverage
$ npm run test:cov
```

> Testes são **Vitest** (não Jest) com `vite-tsconfig-paths`, `globals: true`. Lint é **oxlint** (`npm run lint`), não ESLint. Format é `prettier` (`singleQuote`). Testes **não usam o Neon**: `test/mocks/in-memory-prisma.ts` substitui o `PrismaService`; e2e do fluxo completo em `test/enem-flow.e2e-spec.ts`.

## Deployment

> **ENEM v3 — infra atual:** **Neon Postgres** (banco) + **Render** (API, plano free) + **Cloudflare Pages** (front). Ver [`AGENTS.md`](AGENTS.md) e [`docs/render-keep-alive.md`](docs/render-keep-alive.md).

Build local: `npm run build` → `dist/`. Produção usa o [`Dockerfile`](Dockerfile) (multi-stage, `prisma migrate deploy && node dist/main` no start) ou build nativo do Render.

**Variáveis no Render** (Environment): `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL` (URLs do front separadas por vírgula, ex. `https://seu-projeto.pages.dev,http://localhost:3001`). Ver [`.env.example`](.env.example).

**Keep-alive (Render free):** o serviço dorme ~15 min sem HTTP. Ping `GET /` via [cron-job.org](https://cron-job.org) a cada 10–14 min (janela **06:00–23:59** Brasília recomendada) — detalhes em [`docs/render-keep-alive.md`](docs/render-keep-alive.md).

DB local/dev: `neon link` (`.neon`, `neon.ts`, gitignored).

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
