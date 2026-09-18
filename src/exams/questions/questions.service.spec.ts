import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../../test/mocks/in-memory-prisma.js';
import { QuestionsService } from './questions.service.js';

describe('QuestionsService', () => {
  let service: QuestionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuestionsService, { provide: PrismaService, useValue: new InMemoryPrisma() }],
    }).compile();

    service = module.get<QuestionsService>(QuestionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
