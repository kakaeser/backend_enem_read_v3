import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../test/mocks/in-memory-prisma.js';
import { ExamsController } from './exams.controller.js';
import { ExamsService } from './exams.service.js';
import { ResultsExportService } from './results/results-export.service.js';

describe('ExamsController', () => {
  let controller: ExamsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExamsController],
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
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExamsController>(ExamsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
