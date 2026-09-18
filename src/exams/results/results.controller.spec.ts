import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../../test/mocks/in-memory-prisma.js';
import { ResultsController } from './results.controller.js';
import { ResultsService } from './results.service.js';

describe('ResultsController', () => {
  let controller: ResultsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResultsController],
      providers: [ResultsService, { provide: PrismaService, useValue: new InMemoryPrisma() }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ResultsController>(ResultsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
