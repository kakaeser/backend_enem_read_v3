import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { AdmEmailTokenService } from './adm-email-token.service.js';
import { AuthService, FORGOT_PASSWORD_MESSAGE } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: InMemoryPrisma;
  const mailSend = vi.fn<MailService['send']>();

  beforeEach(async () => {
    prisma = new InMemoryPrisma();
    mailSend.mockReset();
    mailSend.mockResolvedValue(undefined);
    process.env.JWT_SECRET = 'unit-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'unit-refresh-secret';

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '15m' } })],
      providers: [
        AuthService,
        AdmEmailTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: { send: mailSend } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('acceptInvite cria Adm e consome token', async () => {
    await prisma.adm.create({ data: { email: 'inviter@read.local', senha: 'hash' } });
    const tokenService = new AdmEmailTokenService(prisma as unknown as PrismaService);
    const { token } = await tokenService.issueInvite({ email: 'novo@read.local', invitedByAdmId: 1 });

    const res = await service.acceptInvite({ token, senha: 'senha123' });
    expect(res.message).toBe('Conta criada com sucesso');
    const adm = await prisma.adm.findUnique({ where: { email: 'novo@read.local' } });
    expect(adm).toBeTruthy();
    expect(await bcrypt.compare('senha123', adm!.senha)).toBe(true);
  });

  it('acceptInvite token expirado → 400', async () => {
    await prisma.adm.create({ data: { email: 'inviter@read.local', senha: 'hash' } });
    const tokenService = new AdmEmailTokenService(prisma as unknown as PrismaService);
    const { token } = await tokenService.issueInvite({ email: 'late@read.local', invitedByAdmId: 1 });
    const row = await prisma.admEmailToken.findFirst({ where: { email: 'late@read.local' } });
    await prisma.admEmailToken.update({ where: { id: row!.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(service.acceptInvite({ token, senha: 'senha123' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acceptInvite e-mail já cadastrado → 409 antes de consumir', async () => {
    await prisma.adm.create({ data: { email: 'exists@read.local', senha: 'hash' } });
    await prisma.adm.create({ data: { email: 'inviter@read.local', senha: 'hash' } });
    const tokenService = new AdmEmailTokenService(prisma as unknown as PrismaService);
    const { token } = await tokenService.issueInvite({ email: 'exists@read.local', invitedByAdmId: 2 });

    await expect(service.acceptInvite({ token, senha: 'senha123' })).rejects.toBeInstanceOf(ConflictException);
    const tokens = await prisma.admEmailToken.findMany({ where: { email: 'exists@read.local' } });
    expect(tokens[0]?.usedAt).toBeNull();
  });

  it('forgotPassword resposta genérica com ou sem Adm', async () => {
    const missing = await service.forgotPassword({ email: 'nobody@read.local' });
    expect(missing.message).toBe(FORGOT_PASSWORD_MESSAGE);
    expect(mailSend).not.toHaveBeenCalled();

    await prisma.adm.create({ data: { email: 'adm@read.local', senha: await bcrypt.hash('old', 10) } });
    const ok = await service.forgotPassword({ email: 'adm@read.local' });
    expect(ok.message).toBe(FORGOT_PASSWORD_MESSAGE);
    expect(mailSend).toHaveBeenCalledOnce();
  });

  it('resetPassword revoga refresh tokens emitidos antes', async () => {
    const hash = await bcrypt.hash('old-pass', 10);
    await prisma.adm.create({ data: { email: 'adm@read.local', senha: hash } });
    const { refresh_token } = await service.loginAdm('adm@read.local', 'old-pass');

    const tokenService = new AdmEmailTokenService(prisma as unknown as PrismaService);
    const { token } = await tokenService.issuePasswordReset({ admId: 1, email: 'adm@read.local' });
    await service.resetPassword({ token, senha: 'new-pass-99' });

    await expect(service.refresh(refresh_token)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.loginAdm('adm@read.local', 'new-pass-99')).resolves.toBeDefined();
  });
});
