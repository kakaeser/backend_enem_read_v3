import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../../test/mocks/in-memory-prisma.js';
import { QuestionsService } from './questions.service.js';

const alt = (letra: string) => [{ letra, texto: letra }];

describe('QuestionsService', () => {
  let service: QuestionsService;
  let mock: InMemoryPrisma;

  beforeEach(async () => {
    mock = new InMemoryPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuestionsService, { provide: PrismaService, useValue: mock }],
    }).compile();

    service = module.get<QuestionsService>(QuestionsService);
  });

  it('bulkUpsert atualiza questão existente por numero', async () => {
    const exam = await mock.exam.create({
      data: { nome: 'P', qtdQuestoes: 1, status: 'draft' },
    });
    await mock.question.create({
      data: {
        examId: exam.id,
        numero: 1,
        enunciado: '',
        correctAnswer: '',
        alternativas: [],
        peso: 1,
      },
    });

    const results = await service.bulkUpsert(exam.id, [
      { numero: 1, enunciado: 'Q1', alternativas: alt('A'), correctAnswer: 'A' },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].enunciado).toBe('Q1');
    expect(results[0].correctAnswer).toBe('A');
  });

  it('bulkUpsert com id de outra prova → NotFoundException', async () => {
    const examA = await mock.exam.create({
      data: { nome: 'A', qtdQuestoes: 1, status: 'draft' },
    });
    const examB = await mock.exam.create({
      data: { nome: 'B', qtdQuestoes: 1, status: 'draft' },
    });
    const qOther = await mock.question.create({
      data: {
        examId: examB.id,
        numero: 1,
        enunciado: 'X',
        correctAnswer: 'A',
        alternativas: alt('A'),
        peso: 1,
      },
    });

    await expect(
      service.bulkUpsert(examA.id, [
        { id: qOther.id, numero: 1, enunciado: 'Y', alternativas: alt('A'), correctAnswer: 'A' },
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
