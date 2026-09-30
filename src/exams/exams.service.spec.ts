import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { ExamsService } from './exams.service.js';
import { ResultsExportService } from './results/results-export.service.js';

describe('ExamsService', () => {
  let service: ExamsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamsService,
        { provide: PrismaService, useValue: new InMemoryPrisma() },
        {
          provide: ResultsExportService,
          useValue: {
            buildRankingSpreadsheetBuffer: async () => ({
              buffer: Buffer.from(''),
              filename: 'resultados-prova-1.xlsx',
              examNome: 'Prova',
            }),
          },
        },
        { provide: MailService, useValue: { send: async () => undefined } },
      ],
    }).compile();

    service = module.get<ExamsService>(ExamsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
