# Spec: ENEM da Read — Backend v3 MVP (NestJS refatoração)

> Síntese da conversa e codebase atual. Issue tracker não configurado — rode `/setup-matt-pocock-skills` para publicar com label `ready-for-agent`. Este arquivo é o spec pronto para colar no tracker.

## Problem Statement

Como organizador do ENEM da Read (prova estilo ENEM da 8ª Igreja Presbiteriana, ~60 adolescentes/edição, ~70 questões + redação), preciso corrigir provas e divulgar resultados de forma confiável e rápida. Hoje o backend é FastAPI + SQLAlchemy (`backend/config/base.py`) com fluxo manual que funciona, mas é difícil de evoluir e não tem realtime, controle de acesso por papel (ADM vs Aplicador) nem página pública de resultados com detalhe por questão. OCR (gabarito) e OMR (respostas) existem no legado mas são instáveis e não são prioridade para o MVP.

## Solution

Refatorar o backend para NestJS 12 + Prisma 6 + Postgres (Supabase) hospedado no Google Cloud Run, mantendo o fluxo de 7 passos em modo **manual only**. Introduzir autenticação JWT simples para ADMs, Aplicadores com aprovação, criação/edição dinâmica de questões em lote (enunciado + alternativas como JSON), página pública `/resultados` com ranking estático liberado **2 dias após `Exam.encerramento`** via divulgação de link (sem cron, sem WebSocket) que exibe nota ponderada + redação já consolidada. O banco legado (exams/participantes/questoes/resultados) é mapeado para Prisma com correções de constraints e `onDelete: Cascade` explícito.

## User Stories

1. As an ADM, I want to criar uma prova informando nome, qtdQuestoes e notaSimbolica (default 1000), so that eu possa iniciar uma edição sem precisar criar questões manualmente.
2. As an ADM, I want que a criação de prova já gere N questões vazias (placeholder sem enunciado/correctAnswer), so that eu possa preencher depois em lote no frontend.
3. As an ADM, I want to editar o status da prova (draft → in_progress → completed) e definir encerramento, so that eu controle quando o ranking fica ativo e quando a prova fecha.
4. As an ADM, I want to criar e editar questões em lote via uma única requisição (PUT bulk com array de {id?, numero, enunciado, alternativas, correctAnswer, peso}), so that eu não precise de N requests para 70 questões.
5. As an ADM, I want cada questão ter enunciado (Text) + alternativas (Json [{letra, texto}]) + gabarito (correctAnswer) + peso, so that o frontend possa renderizar prova completa e o cálculo ponderado funcione.
6. As an ADM, I want a unicidade por (exam_id, numero) garantida no banco, so that não existam duas questões 1 na mesma prova (mas questão 1 da prova 3 e da prova 6 podem coexistir).
7. As an ADM, I want to cadastrar participantes manualmente e importar via CSV/Excel, so that eu possa lançar 60 alunos rapidamente.
8. As an ADM, I want to informar presença e lançar redacaoNota por participante, so that a redação entre no cálculo final.
9. As an ADM, I want to informar o gabarito manualmente (sem OCR no MVP), so that eu tenha controle total sobre o correctAnswer.
10. As an ADM, I want to lançar respostas dos participantes manualmente (sem OMR no MVP), so that eu possa corrigir mesmo sem leitura ótica.
11. As an ADM, I want que uma resposta seja única por (user_id, quest_id), so that um participante não responda duas vezes a mesma questão.
12. As an ADM, I want to ver ranking ponderado por prova (cálculo interno durante correção, sem realtime), so that eu acompanhe classificação antes da divulgação.
13. As an ADM, I want que a nota seja calculada como (sum(peso * acerto) / sum(pesos) * notaSimbolica) + redacaoNota, so that o peso das questões e a redação sejam refletidos.
14. As an ADM, I want que o ranking só seja publicado 2 dias após `encerramento` via liberação de link, so that a divulgação seja controlada (sem cron, sem WebSocket).
15. As an ADM, I want to consultar estatísticas por prova (média, distribuição, acertos por questão) e exportar resultados, so that eu possa divulgar e analisar desempenho.
16. As an ADM, I want to criar ADMs com email/senha (hash bcrypt) e fazer login recebendo JWT Bearer, so that só ADMs acessem painéis de controle.
17. As an ADM, I want to listar/aprovar/rejeitar Aplicadores, so that eu controle quem pode enviar gabarito.
18. As an Aplicador, I want to me cadastrar apenas com nome vinculado a uma prova (prova_id), so that eu não precise de senha.
19. As an Aplicador, I want to ver status PENDENTE|APROVADO|REJEITADO e só enviar gabarito se APROVADO, so that o ADM mantenha governança.
20. As an Aplicador, I want to corrigir redação (lançar redacaoNota) para participantes da minha prova, so that eu possa contribuir na correção sem ser ADM (sem necessidade de rank ao vivo).
21. As an Aplicador, I want que o botão "Entrar como aplicador" só funcione se existir alguma prova com status in_progress, so that eu não entre em período sem prova ativa.
22. As a visitante, I want to acessar GET /resultados público somente após 2 dias do encerramento (link divulgado), e ver pontuação + rank de cada aluno sem login, so that eu veja resultados consolidados.
23. As a visitante, I want ao clicar em um aluno ver detalhe por questão (enunciado, alternativas, marcada, correta), so that eu possa auditar a correção.
24. As a visitante, I want que os resultados sejam estáticos após divulgação (sem WebSocket), so that não haja mais alterações.
25. As a sistema, I want validar que toda relação respeita o mesmo exam_id e que deletes cascateiam (onDelete: Cascade), so that não haja órfãos e a migração legada `fix_schema_constraints.py` seja corrigida no Prisma.

## Implementation Decisions

- **Stack alvo**: NestJS 12 + TypeScript 6 + ESM (`type: module`, `moduleResolution: nodenext`, imports com `.js`), Prisma 6 (escolhido sobre v8 ainda em RC para evitar breaking changes em `driverAdapters`), Postgres Supabase, JWT simples (sem refresh no MVP, `JwtModule`/`Passport` já preparado para adicionar depois). **Sem Socket.IO no MVP** — ranking sem realtime (divulgação por link 2 dias após encerramento).
- **Infra**: DB `DATABASE_URL` (pooler `:6543?pgbouncer=true`) + `DIRECT_URL` (direct `:5432`) no `.env` (gitignored) com `.env.example` commitado; App `PORT` injetado pelo Cloud Run; deploy via `Dockerfile` + `gcloud run deploy` (não usar `nest deploy`/`mau` legado).
- **Schema Prisma (decisão consolidada com o dev)**: `Exam` (exams, PK exam_id, notaSimbolica default 1000, status enum draft/in_progress/completed), `Adm` (adms, email unique, senha hash, sem coluna `role` — redundante, Adm é só ADM), `Aplicador` (aplicadores, nome, status enum PENDENTE|APROVADO|REJEITADO, FK prova_id → Exam onDelete Cascade, aprovadoPorId nullable), `Participant` (participantes, FK exam_id indexed, presenca, redacaoNota, aplicadorId nullable onDelete SetNull para rastrear quem cadastrou), `Question` (questoes, FK exam_id, numero, peso default 1, correctAnswer, enunciado Text, alternativas Json `[{letra, texto}]`, unique [examId, numero]), `Answer` (resultados, FK user_id → Participant, quest_id → Question, sem examId redundante — normalizado, unique [userId, questId], confidence_score/manually_reviewed nullable para futuro OCR/OMR). Todas as relations com `onDelete: Cascade` explícito e índices em exam_id/userId.
- **Módulos**: `PrismaModule` (@Global, sem controller, exporta PrismaService que estende PrismaClient com onModuleInit/onDestroy), `AuthModule` (POST /auth/login para Adm email/senha → Bearer, POST /auth/aplicador nome+provaId → Bearer só se APROVADO e Exam in_progress), `UsersModule` (user = Adm, CRUD /users), `AplicadoresModule` (POST /aplicadores → PENDENTE, PATCH /aplicadores/:id/status por ADM, GET /aplicadores?provaId=), `ExamsModule` único contendo `ExamsController` (@Controller('exams') → GET /exams retorna todas, POST /exams cria Exam + N Questions vazias em transaction, GET /exams/:id, PATCH /exams/:id/status), sub-recursos `QuestionsController` (@Controller('exams/:examId/questions') → PUT bulk upsert, GET lista) e `ResultsController` (@Controller('exams/:examId/results') + alias público @Controller('resultados') → GET ranking estático, GET /:participantId detalhe, com guard que só libera 2 dias após `Exam.encerramento`). **Sem `ResultsGateway`**.
- **Fluxo criação otimizado**: `POST /exams` cria placeholders vazios; `PUT /exams/:examId/questions/bulk` faz upsert transacional (cria e edita ao mesmo tempo) para edição dinâmica no frontend em lote.
- **Cálculo ranking**: `ResultsService` calcula nota ponderada + redação de forma estática no momento do GET; sem emissão realtime. Regra de divulgação: `GET /resultados` retorna 404/403 até `now >= encerramento + 2 dias` (liberação manual por link, sem cron).
- **Auth**: JWT simples expiração curta (1h, `JWT_SECRET`/`JWT_EXPIRES_IN` no env), `Bearer` header, guards `JwtAuthGuard` + `RolesGuard` (futuro). Aplicador sem senha, apenas nome + prova_id + status.
- **Contratos confirmados**: alternativas como `Json` (não tabela `Alternative` normalizada), peso/correctAnswer em `Question`, redacaoNota em `Participant` + `aplicadorId`, Aplicador status enum (não boolean), sem `examId` em `Answer` (join via relations).

## Testing Decisions

- **O que é um bom teste aqui**: só comportamento externo observável (HTTP status/body), não detalhes de implementação (não testar Prisma internamente, não testar private methods). Um teste deve quebrar só se o contrato do usuário quebrar.
- **Seams propostas (ideal 1 seam, já existe)**: **Seam único HTTP API** via `Test.createTestingModule` + `supertest` sobre `AppModule` (usado em `test/app.e2e-spec.ts`). Cobre todos os controllers (`/exams`, `/exams/:examId/questions`, `/exams/:examId/results`, `/resultados`, `/auth/*`, `/aplicadores`) e a regra de divulgação `404 até encerramento+2d`. É o seam mais alto e já está no repo (`vitest.config.e2e.ts` com `include: **/*.e2e-spec.ts`, `globals: true`). **Sem seam WS**.
  - **Evitar novas seams baixas**: não criar seams unitárias por service se o e2e já cobre; unit tests só onde há lógica isolada de cálculo ponderado (`ResultsService` puro) sem I/O.
- **Prior art**: `src/app.controller.spec.ts` (unit com TestingModule) e `test/app.e2e-spec.ts` (e2e com `app.init()`/`app.close()` + supertest). `vitest.config.ts` (`include: **/*.spec.ts`) para units, `vitest.config.e2e.ts` para e2e. `oxlint` para lint, não ESLint. Manter padrão ESM com `.js` nos imports nos testes também.
- **Módulos a testar**: `ExamsModule` (incluindo Questions bulk e Results ranking com guarda de 2 dias), `AuthModule` (login ADM e aplicador gate `in_progress` + `APROVADO`), `AplicadoresModule` (transição de status). `PrismaService` não precisa teste próprio (infra).

## Out of Scope

- OCR para gabarito e OMR para respostas (campos `confidence_score`/`manually_reviewed` permanecem nullable para futuro, mas sem implementação no MVP).
- Refresh token / OAuth / RBAC com `role` em `Adm` (Adm tem apenas email/senha; role removido).
- `examId` redundante em `Answer` (removido, normalizado).
- Deploy `nest deploy`/`mau` (legado AWS) e `Accelerate` do Prisma.
- WebSocket / Socket.IO e rank ao vivo (removido — resultados estáticos após 2 dias por divulgação de link, sem cron).
- Frontend (Next.js) — apenas contratos de API aqui.
- Export avançado (CSV/Excel de estatísticas) além do ranking básico — pode entrar em iteração seguinte.
- Variante Prisma 7/8 (mantido 6.19.x LTS por estabilidade).

## Further Notes

- Migração Supabase: `DATABASE_URL` pooler e `DIRECT_URL` direct são obrigatórios; `directUrl = env("DIRECT_URL")` no schema só após configurar Supabase (comentado para `prisma dev` local). `npx prisma migrate dev --name init` já rodou com sucesso em `aws-0-sa-east-1.pooler.supabase.com`.
- `AGENTS.md` é a fonte de verdade para gotchas (`.js` imports, `nodenext`, `strictPropertyInitialization: false`, oxlint vs ESLint, Vitest vs Jest, `skills.paths: [".agents/skills"]`).
- Estrutura de pastas atual reflete decisão de manter `questions`/`results` como subpastas de `exams` sem modules separados (herdam `:examId`), e `user` (=Adm) como módulo separado.

