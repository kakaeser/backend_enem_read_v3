import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../../test/mocks/in-memory-prisma.js';
import { AnswersService } from './answers.service.js';

describe('AnswersService', () => {
  let service: AnswersService;
  let mock: InMemoryPrisma;

  beforeEach(async () => {
    mock = new InMemoryPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnswersService, { provide: PrismaService, useValue: mock }],
    }).compile();

    service = module.get<AnswersService>(AnswersService);
  });

  it('bulkUpsert grava respostas via fallback upsert (mock sem $executeRaw)', async () => {
    const exam = await mock.exam.create({
      data: { nome: 'P', qtdQuestoes: 2, status: 'in_progress' },
    });
    const p = await mock.participant.create({ data: { nome: 'Aluno', examId: exam.id } });
    const q1 = await mock.question.create({
      data: { examId: exam.id, numero: 1, enunciado: 'Q1', correctAnswer: 'A', alternativas: [] },
    });
    const q2 = await mock.question.create({
      data: { examId: exam.id, numero: 2, enunciado: 'Q2', correctAnswer: 'B', alternativas: [] },
    });

    const result = await service.bulkUpsert(exam.id, [
      { userId: p.id, questId: q1.id, alternativa: 'A' },
      { userId: p.id, questId: q2.id, alternativa: 'C' },
    ]);

    expect(result).toEqual({ saved: 2 });
    expect(mock.answer.findMany({ where: { userId: p.id } })).toHaveLength(2);
  });

  it('bulkUpsert usa $executeRaw em um único batch quando disponível', async () => {
    const executeRaw = vi.fn().mockResolvedValue(2);
    const exam = { id: 1 };
    const participant = { id: 10, examId: 1 };
    const questions = [{ id: 100, examId: 1 }, { id: 101, examId: 1 }];

    const prisma = {
      exam: { findUnique: vi.fn().mockResolvedValue(exam) },
      participant: { findMany: vi.fn().mockResolvedValue([participant]) },
      question: { findMany: vi.fn().mockResolvedValue(questions) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
        cb({
          $executeRaw: executeRaw,
          answer: { upsert: vi.fn() },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnswersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const svc = module.get<AnswersService>(AnswersService);

    const items = [
      { userId: 10, questId: 100, alternativa: 'A' },
      { userId: 10, questId: 101, alternativa: 'B' },
    ];
    const result = await svc.bulkUpsert(1, items);

    expect(result).toEqual({ saved: 2 });
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
