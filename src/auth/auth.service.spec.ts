import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { AdmEmailTokenService } from './adm-email-token.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        AdmEmailTokenService,
        { provide: PrismaService, useValue: new InMemoryPrisma() },
        { provide: JwtService, useValue: { signAsync: async () => 'token', verifyAsync: async () => ({}) } },
        { provide: MailService, useValue: { send: async () => undefined } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
