# spec-tasks — ENEM da Read v3 MVP

> Checkboxes: `[ ]` pendente, `[X]` feito. Quebrei cada task do spec em subtasks executáveis.

## 1. Infra & Prisma [X] parcial

- [X] `prisma/schema.prisma` com 6 models + enums (Exam, Adm sem role, Aplicador PENDENTE|APROVADO|REJEITADO, Participant com aplicadorId, Question com Json, Answer sem examId redundante)
- [X] `prisma.config.ts` minimal + `.env.example` com DATABASE_URL/DIRECT_URL Supabase + JWT_SECRET
- [X] `npx prisma validate/migrate dev --name init/generate` verde em `aws-0-sa-east-1.pooler.supabase.com`
- [X] `src/prisma/prisma.service.ts` estende PrismaClient + `src/prisma/prisma.module.ts` @Global
- [X] `src/app.module.ts` importa PrismaModule + fix build (generator default @prisma/client, remove src/generated)
- [X] `npm run lint/build/test` verde (14 specs)
- [ ] Remover `src/generated` do git se ainda rastreado + `npx prisma format` no CI
- [X] Seed de restauração do backup legado `database.db` (SQLite, 2 edições, só gabarito) em `prisma/seed.ts` — lê `prisma/legacy/database.db` (copiado de `enem_read_v2/src/backend/database.db`), migra exams (ids 1 e 3), participantes (76), questoes (131 com correctAnswer → enunciado placeholder + alternativas A-E), resultados (4487 bulk), usando `id` explícito + `setval` sequences; Rodar via `npm run seed` → OK (5 batches)

## 2. Auth JWT simples [ ]

- [ ] Instalar `@nestjs/jwt @nestjs/passport passport passport-jwt bcrypt` + `@types/*`
- [ ] `src/auth/dto/login.dto.ts` (email, senha) com class-validator
- [ ] `src/auth/jwt.strategy.ts` + `src/auth/guards/jwt-auth.guard.ts` (Bearer header, 1h expiração)
- [ ] `src/auth/auth.service.ts` — `validateAdm(email, senha)` com bcrypt, `login` assina JWT
- [ ] `src/auth/auth.controller.ts` — `POST /auth/login` (Adm) → `{access_token}`
- [ ] `src/auth/auth.controller.ts` — `POST /auth/aplicador` `{nome, provaId}` → só se `Aplicador.status==APROVADO` e `Exam.status==in_progress`, senão 403
- [ ] `AuthModule` importa `JwtModule.register({secret: env JWT_SECRET, signOptions: {expiresIn: '1h'}})`
- [ ] Teste e2e: login ok 200, senha errada 401, aplicador PENDENTE 403, prova não in_progress 403

## 3. Users (Adm) & Aplicadores [ ]

### 3a. Users (=Adm)
- [ ] `src/user/dto/create-user.dto.ts` + `update-user.dto.ts`
- [ ] `src/user/user.service.ts` — hash bcrypt em create, email unique 409
- [ ] `src/user/user.controller.ts` — `POST /users`, `GET /users`, `GET /users/:id`, `PATCH /users/:id`, `DELETE /users/:id` (guard JWT)
- [ ] Teste e2e: criar Adm 201, duplicate email 409, sem token 401

### 3b. Aplicadores
- [ ] `src/aplicadores/dto/create-aplicador.dto.ts` (nome, provaId)
- [ ] `src/aplicadores/aplicadores.service.ts` — create com status PENDENTE, valida prova existe
- [ ] `src/aplicadores/aplicadores.controller.ts` — `POST /aplicadores` 201, `GET /aplicadores?provaId=`, `PATCH /aplicadores/:id/status` `{status: APROVADO|REJEITADO, aprovadoPorId}` só ADM
- [ ] Teste e2e: fluxo PENDENTE→APROVADO→login aplicador libera, REJEITADO bloqueia

## 4. Exams CRUD [ ]

- [ ] `src/exams/dto/create-exam.dto.ts` (nome, qtdQuestoes, notaSimbolica?, encerramento?)
- [ ] `src/exams/exams.service.ts` — `create` em transaction: cria Exam + `qtdQuestoes` Questions vazias (`enunciado=""`, `alternativas: []`, `correctAnswer: ""`, `peso:1`, `numero:1..N`)
- [ ] `src/exams/exams.controller.ts` — `POST /exams` (JWT ADM), `GET /exams` (todas, resumida), `GET /exams/:id` (com questions count), `PATCH /exams/:id` (nome/nota), `PATCH /exams/:id/status` (draft→in_progress→completed) + valida transição
- [ ] `GET /exams?status=in_progress` para gate "Entrar como aplicador"
- [ ] Teste e2e: POST cria N questions, unique [examId,numero] impede duplicata, GET /exams lista, PATCH status

## 5. Questions bulk (dentro de exams) [ ]

- [ ] `src/exams/questions/dto/bulk-questions.dto.ts` — array de `{id?, numero, enunciado, alternativas: [{letra,texto}], correctAnswer: "A"|"B"|..., peso?}`
- [ ] `src/exams/questions/questions.service.ts` — `bulkUpsert(examId, dtos)` em transaction: se `id` existe → update, senão create; valida `numero` unique dentro do examId
- [ ] `src/exams/questions/questions.controller.ts` — `PUT /exams/:examId/questions/bulk` (JWT ADM/APROVADO), `GET /exams/:examId/questions`, `GET /exams/:examId/questions/:id`
- [ ] Validação: correctAnswer deve ser uma das letras presentes em alternativas
- [ ] Teste e2e: bulk cria+edita em 1 request, 70 questões, erro 400 se correctAnswer inválida

## 6. Participants & Answers [ ]

### 6a. Participants
- [ ] `src/exams/participants/` ou `src/participants/` — decidir: manter dentro de exams ou Módulo próprio? (sugestão: subpasta `exams/participants/` herdando examId)
- [ ] `dto/create-participant.dto.ts` (nome, presenca?, aplicadorId?)
- [ ] `service` — `create`, `createMany`, `importCsv` (multer + csv-parse), `update` (presenca, redacaoNota)
- [ ] `controller` — `POST /exams/:examId/participants`, `POST /exams/:examId/participants/import` (multipart CSV), `GET /exams/:examId/participants`, `PATCH /participants/:id` (redacaoNota, presenca)
- [ ] Teste e2e: importar CSV 60 linhas, presenca false não entra no ranking, redacaoNota nullable

### 6b. Answers
- [ ] `dto/create-answer.dto.ts` (userId, questId, alternativa)
- [ ] `service` — `create` valida `user.examId == quest.examId` (já que Answer não tem examId), unique [userId, questId] 409 se duplicar, `update` alternativa, `manuallyReviewed` default false
- [ ] `controller` — `POST /exams/:examId/answers/bulk` (array), `PATCH /answers/:id`, `GET /participants/:id/answers`
- [ ] Teste e2e: resposta com examId divergente 400, duplicata 409, bulk 70 respostas por participante

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
