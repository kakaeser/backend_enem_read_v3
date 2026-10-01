import ExcelJS from 'exceljs';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../../test/mocks/in-memory-prisma.js';
import { ResultsExportService } from './results-export.service.js';
import { ResultsService } from './results.service.js';

const EXPECTED_HEADERS = ['Posição', 'Nome', 'Nota ponderada', 'Redação', 'Total', 'Acertos', 'Respondidas'];

describe('ResultsExportService', () => {
  let exportService: ResultsExportService;
  let mock: InMemoryPrisma;
  let examId: number;

  beforeEach(async () => {
    mock = new InMemoryPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultsExportService,
        ResultsService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    exportService = module.get(ResultsExportService);

    const exam = await mock.exam.create({
      data: { nome: 'ENEM Read 2026', qtdQuestoes: 2, notaSimbolica: 1000, status: 'completed' },
    });
    examId = exam.id;
    const q1 = (await mock.question.create({
      data: { examId, numero: 1, peso: 1, correctAnswer: 'A', enunciado: 'Q1', alternativas: [] },
    })).id;
    const q2 = (await mock.question.create({
      data: { examId, numero: 2, peso: 1, correctAnswer: 'B', enunciado: 'Q2', alternativas: [] },
    })).id;
    const p1 = (await mock.participant.create({
      data: { examId, nome: 'Ana', consultaCode: 'EXPP001', presenca: true, redacaoNota: 900 },
    })).id;
    await mock.participant.create({
      data: { examId, nome: 'Bruno', consultaCode: 'EXPP002', presenca: true, redacaoNota: null },
    });
    await mock.answer.create({ data: { userId: p1, questId: q1, alternativa: 'A' } });
    await mock.answer.create({ data: { userId: p1, questId: q2, alternativa: 'B' } });
  });

  it('gera buffer com worksheet Ranking, headers e linhas = ranking', async () => {
    const { buffer, filename } = await exportService.buildRankingSpreadsheetBuffer(examId);
    expect(filename).toBe(`resultados-enem-read-2026-${examId}.xlsx`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Ranking');
    expect(sheet).toBeDefined();

    const headerRow = sheet!.getRow(1).values as (string | number | undefined)[];
    const headers = headerRow.slice(1) as string[];
    expect(headers).toEqual(EXPECTED_HEADERS);

    expect(sheet!.rowCount).toBe(3); // header + 2 participantes presentes
    const row2 = sheet!.getRow(2).values as (string | number | undefined)[];
    expect(row2[1]).toBe(1);
    expect(row2[2]).toBe('Ana');
    expect(row2[3]).toBe(1000);
    expect(row2[4]).toBe(900);
    expect(row2[5]).toBe(1900);
  });
});
