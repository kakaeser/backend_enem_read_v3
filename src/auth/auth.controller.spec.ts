import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { AdmEmailTokenService } from './adm-email-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { REFRESH_COOKIE_NAME } from './refresh-cookie.js';

describe('AuthController', () => {
  let controller: AuthController;
  let prisma: InMemoryPrisma;

  beforeEach(async () => {
    prisma = new InMemoryPrisma();
    process.env.JWT_SECRET = 'unit-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'unit-refresh-secret';
    await prisma.adm.create({ data: { email: 'cookie@read.local', senha: await bcrypt.hash('cookie-pass', 10) } });

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '15m' } })],
      controllers: [AuthController],
      providers: [
        AuthService,
        AdmEmailTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: { send: async () => undefined } },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('login seta cookie HttpOnly e não devolve refresh no body', async () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() };
    const body = await controller.login({ email: 'cookie@read.local', senha: 'cookie-pass' }, res as any);
    expect(body.access_token).toBeDefined();
    expect(body.adm.email).toBe('cookie@read.local');
    expect((body as { refresh_token?: string }).refresh_token).toBeUndefined();
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/auth' }),
    );
  });

  it('logout limpa cookie de refresh', async () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() };
    const req = { cookies: {} };
    await controller.logout(req as any, res as any);
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true, path: '/auth' }),
    );
  });
});
