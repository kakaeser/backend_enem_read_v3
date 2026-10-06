import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module.js';
import { E2E_APP_API_KEY, http } from './helpers/supertest-app-key.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FakeMailService } from './mocks/fake-mail.service.js';
import { InMemoryPrisma } from './mocks/in-memory-prisma.js';

function extractTokenFromHtml(html: string): string {
  const match = html.match(/token=([^"&<]+)/);
  if (!match) throw new Error('token não encontrado no HTML do e-mail');
  return decodeURIComponent(match[1]);
}

async function waitForMailCount(fake: FakeMailService, count: number, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fake.sent.length >= count) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Esperado ${count} e-mails, recebido ${fake.sent.length}`);
}

describe('Fluxos de e-mail (e2e, prisma + mail mockados)', () => {
  let app: INestApplication;
  let mock: InMemoryPrisma;
  let fakeMail: FakeMailService;

  beforeAll(async () => {
    process.env.APP_API_KEY = E2E_APP_API_KEY;
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-jwt-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'e2e-refresh-secret';

    mock = new InMemoryPrisma();
    fakeMail = new FakeMailService();
    await mock.adm.create({ data: { email: 'e2e@read.local', senha: await bcrypt.hash('e2e-pass', 10) } });

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(mock)
      .overrideProvider(MailService)
      .useValue(fakeMail)
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

  beforeEach(() => {
    fakeMail.clear();
  });

  it('login Set-Cookie HttpOnly sem refresh no body', async () => {
    const res = await http(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@read.local', senha: 'e2e-pass' })
      .expect(201);
    expect(res.body.refresh_token).toBeUndefined();
    const cookies = res.headers['set-cookie'] ?? [];
    expect(cookies.some((c: string) => c.includes('refresh_token') && c.toLowerCase().includes('httponly'))).toBe(true);
  });

  it('convite: login → invite → accept-invite → login novo Adm', async () => {
    const login = await http(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@read.local', senha: 'e2e-pass' })
      .expect(201);
    const access = login.body.access_token;

    await http(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${access}`)
      .send({ email: 'convidado@read.local' })
      .expect(201);

    expect(fakeMail.sent).toHaveLength(1);
    const inviteToken = extractTokenFromHtml(fakeMail.sent[0]!.html);

    await http(app.getHttpServer())
      .post('/auth/accept-invite')
      .send({ token: inviteToken, senha: 'convite123' })
      .expect(201);

    await http(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'convidado@read.local', senha: 'convite123' })
      .expect(201);
  });

  it('invite e-mail já cadastrado → 409', async () => {
    const login = await http(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@read.local', senha: 'e2e-pass' })
      .expect(201);
    await http(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({ email: 'e2e@read.local' })
      .expect(409);
    expect(fakeMail.sent).toHaveLength(0);
  });

  it('accept-invite token expirado → 400', async () => {
    const login = await http(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@read.local', senha: 'e2e-pass' })
      .expect(201);
    await http(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({ email: 'expirado@read.local' })
      .expect(201);
    const token = extractTokenFromHtml(fakeMail.sent[0]!.html);
    const row = await mock.admEmailToken.findFirst({ where: { email: 'expirado@read.local' } });
    await mock.admEmailToken.update({ where: { id: row!.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    await http(app.getHttpServer())
      .post('/auth/accept-invite')
      .send({ token, senha: 'senha123' })
      .expect(400);
  });

  it('forgot → reset → login; refresh pré-reset → 401', async () => {
    const agent = http(app.getHttpServer()).agent();
    await agent.post('/auth/login').send({ email: 'e2e@read.local', senha: 'e2e-pass' }).expect(201);
    const staleCookie = (await agent.post('/auth/refresh').expect(201)).headers['set-cookie']?.[0]?.split(';')[0];

    await http(app.getHttpServer()).post('/auth/forgot-password').send({ email: 'e2e@read.local' }).expect(200);
    expect(fakeMail.sent).toHaveLength(1);
    const resetToken = extractTokenFromHtml(fakeMail.sent[0]!.html);

    await http(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: resetToken, senha: 'nova-e2e-pass' })
      .expect(200);

    await http(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', staleCookie ?? '')
      .expect(401);

    await http(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@read.local', senha: 'nova-e2e-pass' })
      .expect(201);
  });

  it('refresh/logout com agent: rotação e cookie limpo', async () => {
    const agent = http(app.getHttpServer()).agent();
    const login = await agent.post('/auth/login').send({ email: 'e2e@read.local', senha: 'nova-e2e-pass' }).expect(201);
    const staleCookie = login.headers['set-cookie']?.[0]?.split(';')[0];
    await agent.post('/auth/refresh').expect(201);
    await http(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', staleCookie ?? '')
      .expect(401);
    await agent.post('/auth/logout').expect(201);
    await agent.post('/auth/refresh').expect(401);
  });

  it('PATCH completed envia e-mail com anexo para cada Adm', async () => {
    const login = await http(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@read.local', senha: 'nova-e2e-pass' })
      .expect(201);
    const access = login.body.access_token;
    const admCount = (await mock.adm.findMany()).length;

    const exam = await http(app.getHttpServer())
      .post('/exams')
      .set('Authorization', `Bearer ${access}`)
      .send({ nome: 'Mail Prova', qtdQuestoes: 1 })
      .expect(201);
    const examId = exam.body.id;

    await http(app.getHttpServer())
      .patch(`/exams/${examId}/status`)
      .set('Authorization', `Bearer ${access}`)
      .send({ status: 'in_progress' })
      .expect(200);

    await http(app.getHttpServer())
      .post(`/exams/${examId}/participants`)
      .set('Authorization', `Bearer ${access}`)
      .send({ nome: 'Presente', presenca: true })
      .expect(201);

    const before = fakeMail.sent.length;
    await http(app.getHttpServer())
      .patch(`/exams/${examId}/status`)
      .set('Authorization', `Bearer ${access}`)
      .send({ status: 'completed' })
      .expect(200);

    await waitForMailCount(fakeMail, before + admCount);
    const resultMails = fakeMail.sent.slice(before);
    expect(resultMails).toHaveLength(admCount);
    for (const mail of resultMails) {
      expect(mail.subject).toContain('Resultados');
      expect(mail.attachments?.[0]?.filename).toMatch(new RegExp(`^resultados-mail-prova-${examId}\\.xlsx$`));
      expect(mail.attachments?.[0]?.size).toBeGreaterThan(0);
    }
  });
});
