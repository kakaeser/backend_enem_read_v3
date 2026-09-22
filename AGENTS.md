# AGENTS.md — backend_enem_read_v3

## Project Context
- Refatoração de `enem_read` (FastAPI + SQLAlchemy) para NestJS. Objetivo: correção e divulgação de resultados do **ENEM da Read** — prova estilo ENEM da 8ª Igreja Presbiteriana para adolescentes, ~60 participantes/edição, ~70 questões + redação.
- Fluxo legado (manter no MVP): 1) criar prova 2) criar questões/pesos automaticamente 3) cadastrar/importar participantes via Excel (`.xlsx`, só coluna `nome`) 4) informar gabarito 5) enviar respostas 6) calcular notas ponderadas + redação 7) ranking/estatísticas/export.
- MVP v3 é **manual only** — sem OCR (gabarito) e sem OMR (respostas). OCR/OMR ficam para depois (campos `confidence_score`/`manually_reviewed` legados podem ser mantidos nullable).

## Stack
- NestJS 12 + TypeScript 6 + Node, ESM (`"type": "module"`, `module`/`moduleResolution`: `nodenext`).
- **Prisma 6 + Postgres** (v6 LTS; não migrar para v7/v8 sem motivo). DB hospedado em **Neon** (`neon link`, `neon.ts`, `.neon`), app em **Google Cloud Run** + front no **Cloudflare Pages**. Legado usava SQLAlchemy `Base` em `backend/config/base.py`.
- Auth: **JWT com refresh** — Adm: access 15m (`JWT_SECRET`) + refresh 7d (`JWT_REFRESH_SECRET`, hash sha256 em `refresh_tokens`, rotação com `jti`); Aplicador: access **6h** (`APLICADOR_JWT_EXPIRES_IN`), sem refresh. `Bearer` header. `JwtStrategy.validate` confere existência/`APROVADO` no banco a cada request.
- **Sem WebSocket/Realtime** — ranking estático, divulgação por link 2 dias após `encerramento` (decisão registrada no spec).
- Entrypoints: `src/main.ts` (bootstrap com `ValidationPipe` global + CORS via `FRONTEND_URL`), `src/app.module.ts`.

## Data Model (legado → Prisma, ver `prisma/schema.prisma`)
- `Exam` (`exams`, PK `exam_id`): `nome`, `qtdQuestoes`, `notaSimbolica` default 1000, `createdAt/updatedAt/encerramento`, `status: draft|in_progress|completed` (transição validada `draft→in_progress→completed`; `encerramento` setado automaticamente ao completar).
- `Adm` (`adms`): `email` unique, `senha` hash bcrypt. **Sem coluna `role`** (removida — Adm é só Adm). 1:N → `RefreshToken` (`refresh_tokens`: `tokenHash` sha256 unique, `expiresAt`, `revoked`).
- `Aplicador` (`aplicadores`): `nome` (sem senha), FK `prova_id`→Exam, `status: PENDENTE|APROVADO|REJEITADO` (não boolean), `aprovadoPorId` nullable.
- `Participant` (`participantes`, FK `exam_id` indexed, `nome`, `presenca` default true, `redacaoNota` nullable, `aplicadorId` nullable → quem cadastrou). 1:N → Answer.
- `Question` (`questoes`, FK `exam_id` indexed, `numero`, `peso` default 1, `correctAnswer`, `enunciado: Text`, `alternativas: Json` `[{letra, texto}]` A–D). Unique `@@unique([exam_id, numero])`.
- `Answer` (`resultados`, FKs `user_id`→Participant, `quest_id`→Question, **sem `exam_id`** — removido, normalizado; consistência validada na aplicação). Unique `@@unique([user_id, quest_id])`, index em `user_id`.
- Todas as relations com `onDelete: Cascade` explícito (legado não tinha `ondelete` nos models apesar da migration `fix_schema_constraints.py`).
- **Gotcha `presenca`**: service passa default explícito — manual/bulk nascem `true`, **import Excel nasce `false`** (decisão: ausente até confirmação). Não confie só no default do banco.

## API implementada (v3, ver `.agents/specs/spec-tasks.md`)
- Auth: `POST /auth/login` → `{access_token, refresh_token}`, `POST /auth/refresh` (rotaciona), `POST /auth/logout`, `POST /auth/aplicador` (`403` se `PENDENTE`/`REJEITADO` ou prova não `in_progress`). `POST /users` exige JWT (bootstrap via `npm run seed`: `admin@read.local`/`admin123`).
- Aplicadores: `POST /aplicadores` (público, cria `PENDENTE`), `GET /aplicadores?provaId=`, `GET /aplicadores/me` (JWT do aplicador, polling 5s do front), `PATCH /:id/status`, `DELETE /:id` (guard).
- Exams: `POST /exams` cria Exam + N Questions vazias em transaction; `GET /exams` (+`?status=`); `GET /:id`; `PATCH /:id`, `/:id/status`, `DELETE /:id` (guard; GETs públicos).
- Questions (`exams/:examId/questions`, no `ExamsModule`): `PUT bulk` (upsert; `id`→update, senão resolve por `numero`; valida `correctAnswer ∈ alternativas` A–D; guard ADM), `GET /`, `GET /:id`, `DELETE /:id` (guard).
- Participants (`exams/:examId/participants`): `POST /`, `/bulk`, `/import` (`.xlsx` 2MB, só coluna `nome`), `GET /`, `PATCH /:id/presenca`, `PATCH /:id/redacao` (dedicados), `DELETE /:id` (guard).
- Answers (`exams/:examId/answers`): `POST /bulk` (upsert; `400` se `user`/`quest` de provas diferentes), `PATCH /:id`, `GET /participant/:participantId` (guard).
- Results: `GET /exams/:examId/results` + `/:participantId` (guard, sem guarda de data); públicos `GET /resultados` (tabela, só `completed` + 2d), `GET /resultados/:examId`, `GET /resultados/:examId/:participantId` (`403` antes de `encerramento+2d`). Ranking: `{ponderada, redacao, total, acertos, respondidas}` (`respondidas===0 && redacao==null` → front exibe `"-"`); stats embutido no ranking.

## Infra / Deploy
- **DB: Neon Postgres** (`neon link --project-id hidden-smoke-48757721`, `neon.ts`, `.neon` gitignored) — `DATABASE_URL` (pooler) + `DIRECT_URL` (= `DATABASE_URL_UNPOOLED`, direct) em `.env` (gitignored). `prisma/legacy/database.db` (backup real) também gitignored — nunca commitar.
- **App: Google Cloud Run** — `PORT` em `src/main.ts:14` (`process.env.PORT ?? 3030`, Cloud Run injeta `PORT`). `Dockerfile` multi-stage (node:22-slim, `prisma generate` no build, `migrate deploy && node dist/main` no start). Deploy: `gcloud run deploy --set-env-vars DATABASE_URL,DIRECT_URL,JWT_SECRET,JWT_REFRESH_SECRET,FRONTEND_URL` (nunca `nest deploy`/`mau`). Front no Cloudflare Pages → `FRONTEND_URL` aceita lista por vírgula (`"https://x.pages.dev,http://localhost:3001"`).

## Package Manager
- `npm` — lockfile `package-lock.json`. Use `npm install`, não yarn/pnpm.

## Commands
| Task | Command |
|------|---------|
| Dev (watch) | `npm run start:dev` (`nest start --watch`) |
| Debug | `npm run start:debug` |
| Build | `npm run build` (`nest build` → `dist/`) |
| Prod | `npm run start:prod` (`node dist/main`) |
| Prisma | `npx prisma generate` / `migrate dev` / `migrate deploy` (após `DATABASE_URL` configurada) |
| Lint | `npm run lint` (`oxlint src/ test/` — **não ESLint**) |
| Format | `npm run format` (`prettier --write "src/**/*.ts" "test/**/*.ts"`, `singleQuote` + `trailingComma: all`) |
| Unit tests | `npm run test` (`vitest run`, `vitest.config.ts`, `**/*.spec.ts`, `globals: true`) |
| Watch tests | `npm run test:watch` (`vitest`) |
| Coverage | `npm run test:cov` (`vitest run --coverage` via `@vitest/coverage-v8`) |
| e2e tests | `npm run test:e2e` (`vitest run --config ./vitest.config.e2e.ts`, `**/*.e2e-spec.ts`) |
| Debug tests | `npm run test:debug` |

Single test: `npx vitest run src/app.controller.spec.ts` ou `npx vitest run -t "<test name>"`. Para e2e adicione `--config ./vitest.config.e2e.ts`.

## Gotchas
- **`.js` em imports** — `nodenext` exige `from './app.module.js'` mesmo com fonte `.ts` (ver `src/main.ts:2`, `src/app.module.ts:3`). Sem `.js` quebra em runtime/build.
- **`type: module` + `nodenext`** — só ESM; `tsconfig.json:20` tem `strictPropertyInitialization: false`.
- **Lint é oxlint, não ESLint** — `oxlint.json` (`no-explicit-any: off`, `no-floating-promises: warn`). Não adicione `.eslintrc`.
- **Testes são Vitest, não Jest** — configs usam `vite-tsconfig-paths`, `root: './'`, `globals: true` (`vitest.config.ts:8` / `vitest.config.e2e.ts:5`). Não use `jest` CLI.
- **Testes não usam o Neon** — `test/mocks/in-memory-prisma.ts` substitui o `PrismaService` via `overrideProvider` (unit + e2e). Stubs `*.spec.ts` precisam prover o mock (e `overrideGuard(JwtAuthGuard)`, que exige `AuthModuleOptions` fora do módulo). E2e cobre o fluxo completo em `test/enem-flow.e2e-spec.ts`.
- **Prisma ESM** — `prisma generate` gera client ESM; importar de `@prisma/client` funciona com `nodenext` mas rodar `prisma` via `npx` precisa de `DATABASE_URL` no env.
- **Sem hooks/CI** — `git hooks` são samples. Rode `npm run lint` + `npm run test` antes do push.
- **Skills** — projeto usa `.agents/skills/` como padrão (`opencode.json:4` → `skills.paths: [".agents/skills", ".opencode/skills"]`), instalado via `npx skills add`. Pasta ignorada em `.gitignore:55`, mas `skills-lock.json` deve ser commitado. Requer restart do opencode após instalar.

## Structure
```
src/
├── prisma/        # PrismaService @Global (sem controller)
├── auth/          # login/refresh/logout/aplicador + jwt.strategy + guards/
├── user/          # Adm (=user)
├── aplicadores/
├── exams/         # ExamsModule único: exams.controller/service + subpastas
│   ├── questions/ | participants/ | answers/ | results/  # herdam :examId, sem modules próprios
│   └── results/public-results.controller.ts  # /resultados (sem guard)
prisma/       schema.prisma + migrations + seed.ts (legado) + seed-test.ts (exam 999, prompt iniciar/limpar)
test/         e2e (*.e2e-spec.ts, AppModule + supertest) + mocks/in-memory-prisma.ts (e2e/unit sem Neon)
dist/         build output (gitignored)
.agents/
├── specs/    # spec-enem-read-v3-mvp.md + spec-tasks.md ([X]/[ ] rastreia progresso)
└── skills/   # gitignored, restaurar via npx skills experimental_install
Dockerfile    # Cloud Run
```
Single package, sem monorepo.

## Verification Order
`npm run lint && npm run build && npm run test && npm run test:e2e` — para mudanças de DB adicione `npx prisma validate && npx prisma migrate dev --dry-run` antes.

### Ask Before Action Rule

- Always use the shared `Ask Before Action Rule` whenever the request is ambiguous, incomplete, or could have more than one meaning.
- Prefer asking brief clarification questions before answering or taking action.
- Use multiple-choice questions whenever possible, while allowing free-form responses when necessary.
- Ask only for the minimum information needed to understand the context.
- Reference: `~/.agents/ask-before-action-rule.md`
