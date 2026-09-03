# AGENTS.md — backend_enem_read_v3

## Project Context
- Refatoração de `enem_read` (FastAPI + SQLAlchemy) para NestJS. Objetivo: correção e divulgação de resultados do **ENEM da Read** — prova estilo ENEM da 8ª Igreja Presbiteriana para adolescentes, ~60 participantes/edição, ~70 questões + redação.
- Fluxo legado (manter no MVP): 1) criar prova 2) criar questões/pesos automaticamente 3) cadastrar/importar participantes CSV/Excel 4) informar gabarito 5) enviar respostas 6) calcular notas ponderadas + redação 7) ranking/estatísticas/export.
- MVP v3 é **manual only** — sem OCR (gabarito) e sem OMR (respostas). OCR/OMR ficam para depois (campos `confidence_score`/`manually_reviewed` legados podem ser mantidos nullable).

## Stack
- NestJS 12 + TypeScript 6 + Node, ESM (`"type": "module"`, `module`/`moduleResolution`: `nodenext`).
- **Prisma + Postgres** (decisão v3). DB hospedado em **Supabase**, app em **Google Cloud Run**. Legado usava SQLAlchemy `Base` em `backend/config/base.py`.
- Auth: **JWT simples** (email+senha → bcrypt → `JwtModule`/`Passport`, `Bearer` header, expiração curta; sem refresh token no MVP — adicionar depois é trivial).
- Realtime: **Socket.IO** via `@nestjs/websockets` para rank ao vivo (redação entra no cálculo ao vivo, mas é corrigida separadamente por ADM/Aplicador).
- Entrypoints: `src/main.ts` (bootstrap com `ObserveInstrument`), `src/app.module.ts`.

## Data Model (legado → alvo Prisma)
- `Exam` (`exams`, PK `exam_id`): `nome`, `qtdQuestoes`, `notaSimbolica` default 1000, `createdAt/updatedAt/encerramento`, `status: draft|in_progress|completed`. 1:N → Participant, Question, Answer (`cascade all delete-orphan`).
- `Participant` (`participantes`, PK `id`, FK `exam_id` indexed, `nome`, `presenca`, `redacaoNota`). 1:N → Answer.
- `Question` (`questoes`, PK `id`, FK `exam_id` indexed, `numero`, `peso` default 1, `question_correct_answer`): **v3 muda** para `enunciado: String` + `alternativas: Json` (ex: `[{letra, texto}]`). Unique `@@unique([exam_id, numero])`.
- `Answer` (`resultados`, PK `id`, FKs `user_id`→Participant, `quest_id`→Question, `exam_id`→Exam, `alternativa`, `confidence_score`, `manually_reviewed`). Unique `@@unique([user_id, quest_id])`, indexes em `exam_id`/`user_id`. `exam_id` é redundante (facilita query por exame).
- **Gotcha legado**: sem constraint garantindo que `user_id/quest_id/exam_id` da mesma prova — validação era na aplicação. Migration `fix_schema_constraints.py` recria PKs autoincrement + uniques + FKs `ON DELETE CASCADE`, mas models não tinham `ondelete="CASCADE"` — se usar `Base.metadata.create_all` o cascade não aplica. **No Prisma, declarar `onDelete: Cascade` explícito em todas as relations e adicionar check de consistência de `exam_id`.**

## Target Changes (v3)
- `Adm` (novo): `email` unique, `senha` hash, `role`. Auth email/senha, acessa painéis de prova.
- `Aplicador` (novo): `nome` (sem senha), FK `prova_id`→Exam, `aprovado: boolean` default false. Só acessa envio de gabarito se ADM aprovar. Login "Entrar como aplicador" só permite se existir `Exam.status == in_progress`.
- Questões: criação/edição dinâmica no frontend (criar e editar em lote, numa mesma requisição).
- `GET /resultados` público: lista pontuação + rank ao vivo; detalhe por aluno mostra enunciado/alternativas/marcada/correta.
- WebSocket `rank:update` emitido a cada criação/atualização de `Answer` ou alteração de `redacaoNota`.

## Infra / Deploy
- **DB: Supabase Postgres** — usar `DATABASE_URL` (pool) + `DIRECT_URL` do Supabase em `.env` (gitignored, ver `.gitignore:38`). Prisma `migrate`/`generate` precisa de ambos.
- **App: Google Cloud Run** — `PORT` em `src/main.ts:8` (`process.env.PORT ?? 3000`, Cloud Run injeta `PORT` automaticamente). Build via `npm run build` → `dist/` (`nest build`, `deleteOutDir: true`, `tsconfig.build.json` com `rootDir: src`).
- Deploy legado era `nest deploy`/`mau` — **não usar em Cloud Run**; usar `Dockerfile` + `gcloud run deploy` (ou Cloud Build). Não comitar `YOUR_APP_KEY`/`YOUR_APP_SECRET` de `src/app.module.ts:6`.

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
- **Prisma ESM** — `prisma generate` gera client ESM; importar de `@prisma/client` funciona com `nodenext` mas rodar `prisma` via `npx` precisa de `DATABASE_URL` no env.
- **Sem hooks/CI** — `git hooks` são samples. Rode `npm run lint` + `npm run test` antes do push.
- **Observability** — `src/app.module.ts:6` com placeholder `YOUR_APP_KEY`/`YOUR_APP_SECRET`. Não comitar chaves reais.
- **Skills** — projeto usa `.agents/skills/` como padrão (`opencode.json:4` → `skills.paths: [".agents/skills", ".opencode/skills"]`), instalado via `npx skills add`. Pasta ignorada em `.gitignore:55`, mas `skills-lock.json` deve ser commitado. Requer restart do opencode após instalar.

## Structure
```
src/          sourceRoot (nest-cli.json:4), compilado via tsconfig.build.json (exclui **/*spec.ts, test/, dist/)
prisma/       schema.prisma + migrations (a criar — ainda não existe)
test/         e2e specs (*.e2e-spec.ts) — usa AppModule direto, precisa app.init()/app.close()
dist/         build output (gitignored)
.agents/skills/  skills de projeto (gitignored, restaurar via npx skills experimental_install)
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
