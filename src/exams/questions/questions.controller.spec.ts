import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../../test/mocks/in-memory-prisma.js';
import { QuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';

describe('QuestionsController', () => {
  let controller: QuestionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionsController],
      providers: [QuestionsService, { provide: PrismaService, useValue: new InMemoryPrisma() }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<QuestionsController>(QuestionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
