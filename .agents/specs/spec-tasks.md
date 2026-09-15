# spec-tasks — ENEM da Read v3 MVP

> Checkboxes: `[ ]` pendente, `[X]` feito. Quebrei cada task do spec em subtasks executáveis.

## 1. Infra & Prisma [X] parcial

- [X] `prisma/schema.prisma` com 6 models + enums (Exam, Adm sem role, Aplicador PENDENTE|APROVADO|REJEITADO, Participant com aplicadorId, Question com Json, Answer sem examId redundante)
- [X] `prisma.config.ts` minimal + `.env.example` com DATABASE_URL/DIRECT_URL Neon (pooler/direct) + JWT_SECRET/JWT_REFRESH_SECRET
- [X] `npx prisma validate/migrate dev --name init/generate` verde em Neon `ep-plain-wind...neon.tech` + `migrate add_refresh_tokens`
- [X] `src/prisma/prisma.service.ts` estende PrismaClient + `src/prisma/prisma.module.ts` @Global
- [X] `src/app.module.ts` importa PrismaModule + fix build (generator default @prisma/client, remove src/generated)
- [X] `npm run lint/build/test` verde (14 specs)
- [ ] Remover `src/generated` do git se ainda rastreado + `npx prisma format` no CI
- [X] Seed de restauração do backup legado `database.db` (SQLite, 2 edições, só gabarito) em `prisma/seed.ts` — lê `prisma/legacy/database.db` (copiado de `enem_read_v2/src/backend/database.db`), migra exams (ids 1 e 3), participantes (76), questoes (131 com correctAnswer → enunciado placeholder + alternativas A-E), resultados (4487 bulk), usando `id` explícito + `setval` sequences; Rodar via `npm run seed` → OK (5 batches)

## 2. Auth JWT com refresh [X]

- [X] Instalar `@nestjs/jwt @nestjs/passport passport passport-jwt bcrypt` + `@types/*` + `class-validator/class-transformer`
- [X] `src/auth/dto/login.dto.ts` (email, senha) + `aplicador-login.dto.ts` + `refresh.dto.ts` com class-validator
- [X] `src/auth/jwt.strategy.ts` + `src/auth/guards/jwt-auth.guard.ts` (Bearer, 15m) com validação no banco (lança 401 se Adm/Aplicador deletado ou reprovado)
- [X] `prisma/schema.prisma` model `RefreshToken` (id cuid, admId FK, tokenHash sha256 unique, expiresAt, revoked) + `prisma/migrations/20260908130043_add_refresh_tokens`
- [X] `src/auth/auth.service.ts` — `validateAdm` bcrypt, `issueTokens` (access 15m JWT_SECRET + refresh 7d JWT_REFRESH_SECRET, hash sha256 salvo), `loginAdm` → `{access_token, refresh_token}`, `refresh` (rotaciona, revoga antigo), `logout` (revoga), `loginAplicador` (sem refresh, só access 15m)
- [X] `src/auth/auth.controller.ts` — `POST /auth/login` → `{access_token, refresh_token}`, `POST /auth/refresh` → novos tokens, `POST /auth/logout`, `POST /auth/aplicador` com gate APROVADO + in_progress
- [X] `AuthModule` com `JwtModule` + `PassportModule` + `JwtStrategy` (injeta PrismaService), `ValidationPipe` global em `main.ts`
- [X] Teste manual: `POST /auth/login admin@read.local/admin123` → 200 com ambos tokens, `refresh` rotaciona e antigo dá 401, `aplicador` bloqueado se PENDENTE

## 3. Users (Adm) & Aplicadores [X]

### 3a. Users (=Adm)
- [X] `src/user/dto/create-user.dto.ts` + `update-user.dto.ts` (class-validator)
- [X] `src/user/user.service.ts` — hash bcrypt em create/update, email unique 409
- [X] `src/user/user.controller.ts` — `POST /users`, `GET /users`, `GET /users/:id`, `PATCH /users/:id`, `DELETE /users/:id` (guard JwtAuthGuard, @Controller('users'))
- [X] Teste manual: `POST /users novo@read.local` 201, `GET /users` lista 2, duplicate 409 (via service), sem token 401 (guard)

### 3b. Aplicadores
- [X] `src/aplicadores/dto/create-aplicador.dto.ts` (nome, provaId) + `update-status.dto.ts` (IsEnum)
- [X] `src/aplicadores/aplicadores.service.ts` — create PENDENTE com validação prova existe, findAll por provaId, updateStatus
- [X] `src/aplicadores/aplicadores.controller.ts` — `POST /aplicadores` 201 público, `GET /aplicadores?provaId=`, `PATCH /:id/status` + `DELETE /:id` com JwtAuthGuard (AuthModule importado)
- [X] Teste manual: `POST /aplicadores João prova 1` → PENDENTE, `PATCH /1/status APROVADO` 200, fluxo validado; CORS `app.enableCors({origin: FRONTEND_URL})` em `main.ts` para `start:dev` com frontend

## 4. Exams CRUD [X]

- [X] `src/exams/dto/create-exam.dto.ts` (nome, qtdQuestoes, notaSimbolica?, encerramento?) + `update-exam.dto.ts` + `update-status.dto.ts` (IsEnum)
- [X] `src/exams/exams.service.ts` — `create` em `prisma.$transaction`: cria Exam + `qtdQuestoes` Questions vazias (`enunciado=""`, `alternativas:[]`, `correctAnswer:""`, `peso:1`, `numero:1..N`), `findAll(status?)` com `_count`, `findOne` com questions ordenadas, `update`, `updateStatus` com `allowedTransitions` (draft→in_progress→completed) e `BadRequest` se inválida
- [X] `src/exams/exams.controller.ts` — `POST /exams` (JwtAuthGuard), `GET /exams` (todas, `?status=` filtra), `GET /exams/:id` (com questions), `PATCH /:id`, `PATCH /:id/status`, `DELETE /:id` (todos com guard exceto GETs)
- [X] `src/exams/exams.module.ts` importa `AuthModule` para guard
- [X] Teste manual: `POST /exams Teste CRUD 5q` → 201 com `questionsCount:5`, `GET /exams` lista 5, `GET /:id` com 3 qs, `PATCH draft→in_progress` 200, `in_progress→draft` 400 "Transição inválida", `?status=in_progress` filtra

## 5. Questions bulk (dentro de exams) [X]

- [X] `src/exams/questions/dto/bulk-questions.dto.ts` — `BulkQuestionsDto {questions: QuestionBulkItemDto[]}` com `AlternativaDto {letra, texto}`, `numero`, `enunciado`, `correctAnswer`, `peso?`, `id?`
- [X] `src/exams/questions/questions.service.ts` — `bulkUpsert(examId, items)` valida `correctAnswer ∈ alternativas` e `A-D`, transaction: `id` presente → `update` (checa `examId`), senão `create`; `findAll`/`findOne` com `orderBy numero`
- [X] `src/exams/questions/questions.controller.ts` — `PUT /exams/:examId/questions/bulk` (JwtAuthGuard só ADM), `GET /exams/:examId/questions`, `GET /:id` (público)
- [X] Validação: `BadRequest` se `correctAnswer` fora de `alternativas` (ex: `C` não em `[A,B]` → 400)
- [X] Teste manual: `POST /exams Bulk Test 2q` → `PUT bulk 3,4` (cria, peso 2), `GET` lista 4, `PUT` com `C` inválido → 400, `PUT` com `id` → update `Q1` para `C` 200, `DELETE` cleanup

## 6. Participants & Answers [X]

### 6a. Participants
- [X] `src/exams/participants/` dentro de `ExamsModule` herdando `:examId` (decisão: subpasta, FK examId)
- [X] DTOs: `create-participant.dto.ts` (nome, presenca?, aplicadorId?), `bulk-participants.dto.ts`, `update-presenca.dto.ts`, `update-redacao.dto.ts` (0–1000, nullable)
- [X] `participants.service.ts` — `create`, `createMany`, `importExcel` (exceljs, 1ª aba, coluna A `nome`, pula cabeçalho e vazias; decisão: só `nome`, sem redação na planilha), `findAll` com `_count answers`, `updatePresenca`/`updateRedacao` com `assertOwned` (valida examId)
- [X] `participants.controller.ts` — `POST /exams/:examId/participants`, `POST .../bulk`, `POST .../import` (FileInterceptor `file`, 2MB, valida .xlsx), `GET ...` , `PATCH .../:id/presenca` e `PATCH .../:id/redacao` dedicados (decisão: sem PATCH genérico), todos com JwtAuthGuard
- [X] Teste manual: create + import xlsx 2 nomes (linha vazia ignorada) + list ordenada + `presenca false` + `redacao 850`

### 6b. Answers
- [X] DTOs: `answer-item.dto.ts` (userId, questId, alternativa), `bulk-answers.dto.ts`, `update-answer.dto.ts`
- [X] `answers.service.ts` — `bulkUpsert` valida `user.examId == quest.examId == :examId` (400 se provas diferentes), `upsert` em `unique [userId, questId]` (duplicata atualiza, não 409), `manuallyReviewed: true` ao lançar; `update(id)` e `findByParticipant` com `quest.numero/correctAnswer/peso`
- [X] `answers.controller.ts` — `POST /exams/:examId/answers/bulk`, `PATCH /exams/:examId/answers/:id`, `GET .../answers/participant/:participantId`, todos com JwtAuthGuard
- [X] Fix: `questions.service bulkUpsert` agora resolve update por `numero` existente quando sem `id` (corrige 500 de unique em prova recém-criada) + valida numeros duplicados no request + P2002 vira 400
- [X] Teste manual: bulk 4 respostas, duplicata virou update, divergência 400 "provas diferentes", GET por participante, PATCH unitário

## 7. Results / Ranking (sem WebSocket) [ ]

- [ ] `src/exams/results/results.service.ts` — `calcNota(participantId)` = `sum(peso*acerto)/sum(pesos)*notaSimbolica + (redacaoNota||0)`, `getRanking(examId)` ordena desc + desempate por nome
- [ ] `src/exams/results/results.controller.ts` — `GET /exams/:examId/results` (ADM/Aplicador, sem guarda de data) e `GET /resultados?examId=` público com guarda: `if (now < exam.encerramento + 2 dias) throw 403 {message: "Resultados disponíveis em 2 dias"}` (sem cron, liberação por link)
- [ ] `GET /resultados/:participantId` detalhe → retorna `[{numero, enunciado, alternativas, correctAnswer, marcada, acertou, peso}]`
- [ ] `GET /exams/:examId/stats` — média, distribuição notas, acertos por questão (opcional p/ export)
- [ ] Teste e2e: ranking ordenado correto com peso, redacao soma, 403 antes de 2 dias, 200 após, detalhe mostra marcada vs correta

## 8. E2E & Qualidade [ ]

- [ ] Único seam HTTP: `test/app.e2e-spec.ts` usa `Test.createTestingModule(AppModule)` + `supertest` (já existe, expandir)
- [ ] Fluxo completo e2e: `POST /auth/login` → `POST /exams` (qtd 70) → `PUT bulk questions` → `POST participants import` → `POST answers bulk` → `PATCH redacaoNota` → `GET /exams/:id/results` → `GET /resultados` (espera 403 antes, 200 após mock de data)
- [ ] Unit só para `ResultsService.calcNota` (lógica ponderada isolada, sem DB)
- [ ] `npm run lint && npm run build && npm run test && npm run test:e2e && npx prisma validate` verde no CI
- [ ] `Dockerfile` + `gcloud run deploy` com `DATABASE_URL,DIRECT_URL,JWT_SECRET` (não usar `nest deploy`)

## 9. Docs & Housekeeping [ ]

- [ ] Atualizar `AGENTS.md` removendo Socket.IO se confirmado sem WS (ainda menciona rank:update)
- [ ] Atualizar `README.md` com `GET /resultados` guarda 2 dias
- [ ] `specs/spec-enem-read-v3-mvp.md` publicado no tracker com label `ready-for-agent` após `/setup-matt-pocock-skills`
