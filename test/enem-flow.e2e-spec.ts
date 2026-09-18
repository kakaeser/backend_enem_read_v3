import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { InMemoryPrisma } from './mocks/in-memory-prisma.js';

describe('ENEM Read fluxo completo (e2e, prisma mockado)', () => {
  let app: INestApplication<App>;
  let mock: InMemoryPrisma;
  let token: string;
  let examId: number;
  let q1: number;
  let q2: number;
  let p1: number;

  const alt = (c: string) => [
    { letra: 'A', texto: 'A' },
    { letra: 'B', texto: 'B' },
    { letra: 'C', texto: 'C' },
    { letra: 'D', texto: 'D' },
  ].map((a) => (a.letra === c ? a : { ...a }));

  beforeAll(async () => {
    mock = new InMemoryPrisma();
    await mock.adm.create({ data: { email: 'e2e@read.local', senha: await bcrypt.hash('e2e-pass', 10) } });

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(mock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('login falha com senha errada (401)', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'e2e@read.local', senha: 'errada' }).expect(401);
  });

  it('login ok retorna access + refresh', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@read.local', senha: 'e2e-pass' })
      .expect(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    token = res.body.access_token;
  });

  it('refresh rotaciona e antigo é revogado', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@read.local', senha: 'e2e-pass' })
      .expect(201);
    const r1 = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: login.body.refresh_token })
      .expect(201);
    expect(r1.body.access_token).toBeDefined();
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: login.body.refresh_token })
      .expect(401);
  });

  it('POST /exams cria prova + N questões vazias', async () => {
    const res = await request(app.getHttpServer())
      .post('/exams')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'E2E Prova', qtdQuestoes: 2 })
      .expect(201);
    examId = res.body.id;
    expect(res.body.questionsCount).toBe(2);
  });

  it('PUT bulk preenche gabarito (update por numero)', async () => {
    const res = await request(app.getHttpServer())
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
    await request(app.getHttpServer())
      .put(`/exams/${examId}/questions/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ questions: [{ numero: 1, enunciado: 'X', alternativas: alt('A'), correctAnswer: 'Z' }] })
      .expect(400);
  });

  it('POST participant + import xlsx', async () => {
    const p = await request(app.getHttpServer())
      .post(`/exams/${examId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'E2E Uno' })
      .expect(201);
    p1 = p.body.id;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Alunos');
    ws.addRow(['nome']);
    ws.addRow(['E2E Dos']);
    const buf = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
    const imp = await request(app.getHttpServer())
      .post(`/exams/${examId}/participants/import`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(buf), 'alunos.xlsx')
      .expect(201);
    expect(imp.body.created).toBe(1);
    // importados nascem ausentes (presenca false) → confirma presença para entrar no ranking
    const list = (await request(app.getHttpServer()).get(`/exams/${examId}/participants`).set('Authorization', `Bearer ${token}`).expect(200)).body;
    const dos = list.find((p: any) => p.nome === 'E2E Dos');
    expect(dos.presenca).toBe(false);
    await request(app.getHttpServer())
      .patch(`/exams/${examId}/participants/${dos.id}/presenca`)
      .set('Authorization', `Bearer ${token}`)
      .send({ presenca: true })
      .expect(200);
  });

  it('PATCH presenca/redacao dedicados', async () => {
    await request(app.getHttpServer())
      .patch(`/exams/${examId}/participants/${p1}/redacao`)
      .set('Authorization', `Bearer ${token}`)
      .send({ redacaoNota: 900 })
      .expect(200);
  });

  it('POST answers bulk + divergência 400', async () => {
    await request(app.getHttpServer())
      .post(`/exams/${examId}/answers/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ userId: p1, questId: q1, alternativa: 'A' }, { userId: p1, questId: q2, alternativa: 'A' }] })
      .expect(201);
    // questão de outra prova → 400
    const other = await request(app.getHttpServer())
      .post('/exams')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'E2E Outra', qtdQuestoes: 1 })
      .expect(201);
    const oq = (await request(app.getHttpServer()).get(`/exams/${other.body.id}/questions`).expect(200)).body[0].id;
    await request(app.getHttpServer())
      .post(`/exams/${examId}/answers/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ userId: p1, questId: oq, alternativa: 'A' }] })
      .expect(400);
    await request(app.getHttpServer()).delete(`/exams/${other.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('GET ranking interno com total = ponderada + redação', async () => {
    const res = await request(app.getHttpServer())
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
    const res = await request(app.getHttpServer())
      .get(`/exams/${examId}/results/${p1}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.notas.total).toBeDefined();
    expect(res.body.questoes).toHaveLength(2);
  });

  it('público: tabela exclui in_progress, ranking dá 403', async () => {
    const tab = await request(app.getHttpServer()).get('/resultados').expect(200);
    expect(tab.body.some((e: any) => e.id === examId)).toBe(false);
    await request(app.getHttpServer()).get(`/resultados/${examId}`).expect(403);
  });

  it('público: após encerramento+2d libera 200', async () => {
    await request(app.getHttpServer())
      .patch(`/exams/${examId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/exams/${examId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' })
      .expect(200);
    // força encerramento -3d direto no mock (mesmo processo)
    await mock.exam.update({ where: { id: examId }, data: { encerramento: new Date(Date.now() - 3 * 864e5) } });
    const tab = await request(app.getHttpServer()).get('/resultados').expect(200);
    expect(tab.body.some((e: any) => e.id === examId)).toBe(true);
    const rank = await request(app.getHttpServer()).get(`/resultados/${examId}`).expect(200);
    expect(rank.body.ranking.length).toBe(2);
    await request(app.getHttpServer()).get(`/resultados/${examId}/${p1}`).expect(200);
  });

  it('cleanup: DELETE prova remove tudo (cascade simulado via delete)', async () => {
    await request(app.getHttpServer()).delete(`/exams/${examId}`).set('Authorization', `Bearer ${token}`).expect(200);
  });
});
