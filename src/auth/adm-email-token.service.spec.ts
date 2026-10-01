import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { hashToken } from '../common/opaque-token.util.js';
import { parseDurationToMs } from '../common/parse-duration.util.js';
import { AdmEmailTokenService } from './adm-email-token.service.js';

describe('AdmEmailTokenService', () => {
  let service: AdmEmailTokenService;
  let prisma: InMemoryPrisma;

  beforeEach(async () => {
    prisma = new InMemoryPrisma();
    await prisma.adm.create({ data: { email: 'inviter@read.local', senha: 'hash' } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdmEmailTokenService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AdmEmailTokenService);
  });

  it('issueInvite + consume returns email', async () => {
    const { token } = await service.issueInvite({ email: 'New@Read.local ', invitedByAdmId: 1 });
    const row = await service.consume(token, 'invite');
    expect(row.email).toBe('new@read.local');
  });

  it('consume twice throws', async () => {
    const { token } = await service.issueInvite({ email: 'a@read.local', invitedByAdmId: 1 });
    await service.consume(token, 'invite');
    await expect(service.consume(token, 'invite')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('new invite invalidates previous token', async () => {
    const first = await service.issueInvite({ email: 'b@read.local', invitedByAdmId: 1 });
    await service.issueInvite({ email: 'b@read.local', invitedByAdmId: 1 });
    await expect(service.consume(first.token, 'invite')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('expired token throws', async () => {
    const { token } = await service.issueInvite({ email: 'c@read.local', invitedByAdmId: 1 });
    await prisma.admEmailToken.update({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(service.consume(token, 'invite')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('parseDurationToMs', () => {
  it('parses common units', () => {
    expect(parseDurationToMs('7d')).toBe(7 * 86_400_000);
    expect(parseDurationToMs('1h')).toBe(3_600_000);
  });

  it('rejects invalid format', () => {
    expect(() => parseDurationToMs('bad')).toThrow();
  });
});
