import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { AplicadoresController } from './aplicadores.controller.js';
import { AplicadoresService } from './aplicadores.service.js';

describe('AplicadoresController', () => {
  let controller: AplicadoresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AplicadoresController],
      providers: [AplicadoresService, { provide: PrismaService, useValue: new InMemoryPrisma() }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AplicadoresController>(AplicadoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
