import { Test, TestingModule } from '@nestjs/testing';
import { AdmEmailTokenService } from '../auth/adm-email-token.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { UserService } from './user.service.js';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        AdmEmailTokenService,
        { provide: PrismaService, useValue: new InMemoryPrisma() },
        { provide: MailService, useValue: { send: async () => undefined } },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
