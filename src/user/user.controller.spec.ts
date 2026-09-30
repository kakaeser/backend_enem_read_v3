import { Test, TestingModule } from '@nestjs/testing';
import { AdmEmailTokenService } from '../auth/adm-email-token.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        UserService,
        AdmEmailTokenService,
        { provide: PrismaService, useValue: new InMemoryPrisma() },
        { provide: MailService, useValue: { send: async () => undefined } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
