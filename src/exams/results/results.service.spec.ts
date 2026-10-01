import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InMemoryPrisma } from '../../../test/mocks/in-memory-prisma.js';
import { ResultsService } from './results.service.js';

describe('ResultsService (unit, prisma mockado)', () => {
  let service: ResultsService;
  let mock: InMemoryPrisma;
  let examId: number;
  let q1: number;
  let q2: number;
  let p1: number;

  beforeEach(async () => {
    mock = new InMemoryPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResultsService, { provide: PrismaService, useValue: mock }],
    }).compile();
    service = module.get<ResultsService>(ResultsService);

    const exam = await mock.exam.create({ data: { nome: 'Unit', qtdQuestoes: 2, notaSimbolica: 1000, status: 'draft' } });
    examId = exam.id;
    // peso 1 e 2 → soma 3
    q1 = (await mock.question.create({ data: { examId, numero: 1, peso: 1, correctAnswer: 'A', enunciado: 'Q1', alternativas: [] } })).id;
    q2 = (await mock.question.create({ data: { examId, numero: 2, peso: 2, correctAnswer: 'B', enunciado: 'Q2', alternativas: [] } })).id;
    p1 = (await mock.participant.create({ data: { examId, nome: 'Aluno', consultaCode: 'UNITP001', presenca: true, redacaoNota: 800 } })).id;
  });

  it('tudo certo → ponderada 1000 + redação', async () => {
    await mock.answer.create({ data: { userId: p1, questId: q1, alternativa: 'A' } });
    await mock.answer.create({ data: { userId: p1, questId: q2, alternativa: 'B' } });
    const n = await service.calcNota(p1);
    expect(n.ponderada).toBeCloseTo(1000);
    expect(n.redacao).toBe(800);
    expect(n.total).toBeCloseTo(1800);
  });

  it('parcial: só Q2 (peso 2 de 3) → 666.66', async () => {
    await mock.answer.create({ data: { userId: p1, questId: q1, alternativa: 'B' } });
    await mock.answer.create({ data: { userId: p1, questId: q2, alternativa: 'B' } });
    const n = await service.calcNota(p1);
    expect(n.ponderada).toBeCloseTo((2 / 3) * 1000);
  });

  it('sem respostas → ponderada 0, total só redação', async () => {
    const n = await service.calcNota(p1);
    expect(n.ponderada).toBe(0);
    expect(n.total).toBe(800);
  });

  it('redacao null → total igual ponderada', async () => {
    const p2 = (await mock.participant.create({ data: { examId, nome: 'Sem red', consultaCode: 'UNITP002', presenca: true, redacaoNota: null } })).id;
    await mock.answer.create({ data: { userId: p2, questId: q1, alternativa: 'A' } });
    const n = await service.calcNota(p2);
    expect(n.redacao).toBeNull();
    expect(n.total).toBeCloseTo(n.ponderada);
  });

  it('ranking ordena por total com desempate por nome e traz respondidas', async () => {
    await mock.participant.create({ data: { examId, nome: 'Bruto', consultaCode: 'UNITP003', presenca: true, redacaoNota: null } });
    await mock.answer.create({ data: { userId: p1, questId: q1, alternativa: 'A' } });
    const r = await service.getRanking(examId);
    expect(r.ranking[0].nome).toBe('Aluno');
    expect(r.ranking[0].respondidas).toBe(1);
    expect(r.ranking[1].respondidas).toBe(0);
    expect(r.stats.totalParticipantes).toBe(2);
  });

  it('participante ausente fica fora do ranking', async () => {
    await mock.participant.create({ data: { examId, nome: 'Faltou', consultaCode: 'UNITP004', presenca: false, redacaoNota: null } });
    const r = await service.getRanking(examId);
    expect(r.ranking.some((x) => x.nome === 'Faltou')).toBe(false);
  });

  it('getPublicResults expõe só top15 nomes sem ranking completo', async () => {
    await mock.answer.create({ data: { userId: p1, questId: q1, alternativa: 'A' } });
    const pub = await service.getPublicResults(examId);
    expect(pub.top15).toHaveLength(1);
    expect(pub.top15[0]).toEqual({ posicao: 1, nome: 'Aluno' });
    expect(pub.stats.totalParticipantes).toBe(1);
    expect((pub as { ranking?: unknown }).ranking).toBeUndefined();
  });

  it('consultaByCode retorna detalhe com código válido', async () => {
    const detail = await service.consultaByCode(examId, 'unitp001');
    expect(detail.participant.nome).toBe('Aluno');
  });
});
