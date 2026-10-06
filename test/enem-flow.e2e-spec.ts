import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { E2E_APP_API_KEY, http } from './helpers/supertest-app-key.js';
import { InMemoryPrisma } from './mocks/in-memory-prisma.js';

describe('ENEM Read fluxo completo (e2e, prisma mockado)', () => {
  let app: INestApplication;
  let mock: InMemoryPrisma;
  let token: string;
  let examId: number;
  let q1: number;
  let q2: number;
  let p1: number;
  let p1ConsultaCode: string;

  const alt = (c: string) => [
    { letra: 'A', texto: 'A' },
    { letra: 'B', texto: 'B' },
    { letra: 'C', texto: 'C' },
    { letra: 'D', texto: 'D' },
  ].map((a) => (a.letra === c ? a : { ...a }));

  beforeAll(async () => {
    process.env.APP_API_KEY = E2E_APP_API_KEY;
    mock = new InMemoryPrisma();
    await mock.adm.create({ data: { email: 'e2e@read.local', senha: await bcrypt.hash('e2e-pass', 10) } });

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(mock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    delete process.env.APP_API_KEY;
    await app.close();
  });

  it('GET / health sem API key', async () => {
    await request(app.getHttpServer()).get('/').expect(200);
  });

  it('rota protegida sem API key → 403', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'e2e@read.local', senha: 'errada' }).expect(403);
  });

  it('login falha com senha errada (401)', async () => {
    await http(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@read.local', senha: 'errada' })
      .expect(401);
  });

  it('login ok retorna access e refresh em cookie HttpOnly', async () => {
    const res = await http(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@read.local', senha: 'e2e-pass' })
      .expect(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.adm?.email).toBe('e2e@read.local');
    expect(res.body.refresh_token).toBeUndefined();
    const setCookie = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    expect(cookies.some((c) => c.includes('refresh_token') && c.toLowerCase().includes('httponly'))).toBe(true);
    token = res.body.access_token;
  });

  it('refresh rotaciona e antigo é revogado', async () => {
    const agent = http(app.getHttpServer()).agent();
    const login = await agent.post('/auth/login').send({ email: 'e2e@read.local', senha: 'e2e-pass' }).expect(201);
    const staleCookie = login.headers['set-cookie']?.[0]?.split(';')[0];
    const r1 = await agent.post('/auth/refresh').expect(201);
    expect(r1.body.access_token).toBeDefined();
    expect(r1.body.refresh_token).toBeUndefined();
    await http(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', staleCookie ?? '')
      .expect(401);
  });

  it('logout limpa cookie e refresh subsequente falha', async () => {
    const agent = http(app.getHttpServer()).agent();
    await agent.post('/auth/login').send({ email: 'e2e@read.local', senha: 'e2e-pass' }).expect(201);
    await agent.post('/auth/logout').expect(201);
    await agent.post('/auth/refresh').expect(401);
  });

  it('POST /exams cria prova + N questões vazias', async () => {
    const res = await http(app.getHttpServer())
      .post('/exams')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'E2E Prova', qtdQuestoes: 2 })
      .expect(201);
    examId = res.body.id;
    expect(res.body.questionsCount).toBe(2);
  });

  it('PUT bulk preenche gabarito (update por numero)', async () => {
    const res = await http(app.getHttpServer())
      .put(`/exams/${examId}/questions/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        questions: [
          { numero: 1, enunciado: 'Q1', alternativas: alt('A'), correctAnswer: 'A' },
          { numero: 2, enunciado: 'Q2', alternativas: alt('B'), correctAnswer: 'B', peso: 2 },
        ],
      })
      .expect(200);
    q1 = res.body.find((q: any) => q.numero === 1).id;
    q2 = res.body.find((q: any) => q.numero === 2).id;
  });

  it('PUT bulk com correctAnswer inválido → 400', async () => {
    await http(app.getHttpServer())
      .put(`/exams/${examId}/questions/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ questions: [{ numero: 1, enunciado: 'X', alternativas: alt('A'), correctAnswer: 'Z' }] })
      .expect(400);
  });

  it('POST participant + bulk', async () => {
    const p = await http(app.getHttpServer())
      .post(`/exams/${examId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'E2E Uno', presenca: true })
      .expect(201);
    p1 = p.body.id;
    expect(p.body.consultaCode).toMatch(/^[A-Z2-9]{8}$/);
    p1ConsultaCode = p.body.consultaCode;

    const bulk = await http(app.getHttpServer())
      .post(`/exams/${examId}/participants/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ participants: [{ nome: 'E2E Dos', presenca: false }] })
      .expect(201);
    expect(bulk.body.created).toBe(1);
    const list = (
      await http(app.getHttpServer())
        .get(`/exams/${examId}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;
    expect(list.meta?.total).toBeGreaterThanOrEqual(2);
    const dos = list.data.find((x: { nome: string }) => x.nome === 'E2E Dos');
    expect(dos.consultaCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(dos.presenca).toBe(false);
    await http(app.getHttpServer())
      .patch(`/exams/${examId}/participants/${dos.id}/presenca`)
      .set('Authorization', `Bearer ${token}`)
      .send({ presenca: true })
      .expect(200);
  });

  it('PATCH presenca/redacao dedicados', async () => {
    await http(app.getHttpServer())
      .patch(`/exams/${examId}/participants/${p1}/redacao`)
      .set('Authorization', `Bearer ${token}`)
      .send({ redacaoNota: 900 })
      .expect(200);
  });

  it('POST answers bulk + divergência 400', async () => {
    await http(app.getHttpServer())
      .post(`/exams/${examId}/answers/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ userId: p1, questId: q1, alternativa: 'A' }, { userId: p1, questId: q2, alternativa: 'A' }] })
      .expect(201);
    // questão de outra prova → 400
    const other = await http(app.getHttpServer())
      .post('/exams')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'E2E Outra', qtdQuestoes: 1 })
      .expect(201);
    const oq = (await http(app.getHttpServer()).get(`/exams/${other.body.id}/questions`).expect(200)).body[0].id;
    await http(app.getHttpServer())
      .post(`/exams/${examId}/answers/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ userId: p1, questId: oq, alternativa: 'A' }] })
      .expect(400);
    await http(app.getHttpServer()).delete(`/exams/${other.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('GET ranking interno com total = ponderada + redação', async () => {
    const res = await http(app.getHttpServer())
      .get(`/exams/${examId}/results`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const me = res.body.ranking.find((r: any) => r.participantId === p1);
    // Q1 peso1 certa + Q2 peso2 errada → (1/3)*1000 + 900
    expect(me.ponderada).toBeCloseTo((1 / 3) * 1000);
    expect(me.total).toBeCloseTo((1 / 3) * 1000 + 900);
    expect(me.respondidas).toBe(2);
    expect(res.body.stats.totalParticipantes).toBe(2);
  });

  it('GET detalhe interno com marcada/correta', async () => {
    const res = await http(app.getHttpServer())
      .get(`/exams/${examId}/results/${p1}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.notas.total).toBeDefined();
    expect(res.body.questoes).toHaveLength(2);
  });

  it('público: tabela exclui in_progress, ranking dá 403', async () => {
    const tab = await http(app.getHttpServer()).get('/resultados').expect(200);
    expect(tab.body.some((e: any) => e.id === examId)).toBe(false);
    await http(app.getHttpServer()).get(`/resultados/${examId}`).expect(403);
  });

  it('público: após encerramento+2d libera 200', async () => {
    await http(app.getHttpServer())
      .patch(`/exams/${examId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' })
      .expect(200);
    await http(app.getHttpServer())
      .patch(`/exams/${examId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' })
      .expect(200);
    // força encerramento -3d direto no mock (mesmo processo)
    await mock.exam.update({ where: { id: examId }, data: { encerramento: new Date(Date.now() - 3 * 864e5) } });
    const tab = await http(app.getHttpServer()).get('/resultados').expect(200);
    expect(tab.body.some((e: any) => e.id === examId)).toBe(true);
    const rank = await http(app.getHttpServer()).get(`/resultados/${examId}`).expect(200);
    expect(rank.body.top15).toHaveLength(2);
    expect(rank.body.ranking).toBeUndefined();
    const consulta = await http(app.getHttpServer())
      .post(`/resultados/${examId}/consulta`)
      .send({ codigo: p1ConsultaCode })
      .expect(201);
    expect(consulta.body.participant.id).toBe(p1);
    expect(consulta.body.questoes).toHaveLength(2);
  });

  it('cleanup: DELETE prova remove tudo (cascade simulado via delete)', async () => {
    await http(app.getHttpServer()).delete(`/exams/${examId}`).set('Authorization', `Bearer ${token}`).expect(200);
  });
});
