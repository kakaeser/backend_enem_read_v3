import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AdmEmailTokenService } from '../auth/adm-email-token.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { UserService } from './user.service.js';

describe('UserService', () => {
  let service: UserService;
  let prisma: InMemoryPrisma;
  const mailSend = vi.fn<MailService['send']>();

  beforeEach(async () => {
    prisma = new InMemoryPrisma();
    mailSend.mockReset();
    mailSend.mockResolvedValue(undefined);
    await prisma.adm.create({ data: { email: 'inviter@read.local', senha: 'hash' } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        AdmEmailTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: { send: mailSend } },
      ],
    }).compile();

    service = module.get(UserService);
  });

  it('invite envia e-mail e persiste token', async () => {
    const res = await service.invite(1, { email: ' New@Read.local ' });
    expect(res.email).toBe('new@read.local');
    expect(mailSend).toHaveBeenCalledOnce();
    const sent = mailSend.mock.calls[0]![0];
    expect(sent.to).toBe('new@read.local');
    expect(sent.html).toContain('aceitar-convite?token=');
    const rows = await prisma.admEmailToken.findMany({ where: { email: 'new@read.local' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.purpose).toBe('invite');
  });

  it('invite e-mail já cadastrado → 409', async () => {
    await prisma.adm.create({ data: { email: 'taken@read.local', senha: 'hash' } });
    await expect(service.invite(1, { email: 'taken@read.local' })).rejects.toBeInstanceOf(ConflictException);
    expect(mailSend).not.toHaveBeenCalled();
  });
});
