import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { AplicadoresService } from './aplicadores.service.js';

describe('AplicadoresService', () => {
  let service: AplicadoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AplicadoresService, { provide: PrismaService, useValue: new InMemoryPrisma() }],
    }).compile();

    service = module.get<AplicadoresService>(AplicadoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
