import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ResultsService {
  constructor(private prisma: PrismaService) {}

  async calcNota(participantId: number) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        exam: { select: { id: true, notaSimbolica: true } },
        answers: { include: { quest: { select: { correctAnswer: true, peso: true } } } },
      },
    });
    if (!participant) throw new NotFoundException('Participante não encontrado');
    const allPeso = await this.prisma.question.aggregate({
      where: { examId: participant.examId },
      _sum: { peso: true },
    });
    const sumPesos = allPeso._sum.peso ?? 0;
    const earned = participant.answers.reduce((s, a) => s + (a.alternativa === a.quest.correctAnswer ? a.quest.peso : 0), 0);
    const ponderada = sumPesos > 0 ? (earned / sumPesos) * participant.exam.notaSimbolica : 0;
    const redacao = participant.redacaoNota ?? null;
    return { ponderada, redacao, total: ponderada + (redacao ?? 0) };
  }

  async getRanking(examId: number) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Prova não encontrada');
    const [participants, questions] = await Promise.all([
      this.prisma.participant.findMany({
        where: { examId, presenca: true },
        include: { answers: { include: { quest: { select: { id: true, numero: true, correctAnswer: true, peso: true } } } } },
      }),
      this.prisma.question.findMany({ where: { examId }, select: { id: true, numero: true } }),
    ]);
    const sumPesos = await this.prisma.question.aggregate({ where: { examId }, _sum: { peso: true } });
    const totalPeso = sumPesos._sum.peso ?? 0;

    const ranking = participants.map((p) => {
      const earned = p.answers.reduce((s, a) => s + (a.alternativa === a.quest.correctAnswer ? a.quest.peso : 0), 0);
      const acertos = p.answers.filter((a) => a.alternativa === a.quest.correctAnswer).length;
      const ponderada = totalPeso > 0 ? (earned / totalPeso) * exam.notaSimbolica : 0;
      const redacao = p.redacaoNota ?? null;
      return {
        participantId: p.id,
        nome: p.nome,
        ponderada,
        redacao,
        total: ponderada + (redacao ?? 0),
        acertos,
        respondidas: p.answers.length,
        totalQuestoes: questions.length,
      };
    });
    ranking.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));

    const totals = ranking.map((r) => r.total);
    const acertosPorQuestao = questions.map((q) => {
      let acertos = 0;
      let respondidas = 0;
      for (const p of participants) {
        const ans = p.answers.find((a) => a.quest.id === q.id);
        if (ans) {
          respondidas++;
          if (ans.alternativa === ans.quest.correctAnswer) acertos++;
        }
      }
      return { questaoId: q.id, numero: q.numero, acertos, respondidas };
    });

    return {
      exam: { id: exam.id, nome: exam.nome, status: exam.status, encerramento: exam.encerramento },
      ranking,
      stats: {
        totalParticipantes: ranking.length,
        media: ranking.length ? totals.reduce((s, t) => s + t, 0) / ranking.length : 0,
        maior: ranking.length ? Math.max(...totals) : 0,
        menor: ranking.length ? Math.min(...totals) : 0,
        acertosPorQuestao,
      },
    };
  }

  async getDetail(examId: number, participantId: number) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, examId },
      include: {
        answers: { include: { quest: true } },
      },
    });
    if (!participant) throw new NotFoundException('Participante não encontrado nesta prova');
    const { ponderada, redacao, total } = await this.calcNota(participantId);
    const questoes = participant.answers
      .map((a) => ({
        numero: a.quest.numero,
        enunciado: a.quest.enunciado,
        alternativas: a.quest.alternativas,
        correctAnswer: a.quest.correctAnswer,
        marcada: a.alternativa,
        acertou: a.alternativa === a.quest.correctAnswer,
        peso: a.quest.peso,
      }))
      .sort((a, b) => a.numero - b.numero);
    return {
      participant: { id: participant.id, nome: participant.nome, presenca: participant.presenca },
      notas: { ponderada, redacao, total },
      questoes,
    };
  }

  async assertDivulgado(examId: number) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Prova não encontrada');
    const limite = exam.encerramento ? new Date(exam.encerramento.getTime() + 2 * 24 * 60 * 60 * 1000) : null;
    if (exam.status !== 'completed' || !limite || new Date() < limite) {
      throw new ForbiddenException('Resultados disponíveis 2 dias após o encerramento');
    }
    return exam;
  }

  async listDivulgados() {
    const limite = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    return this.prisma.exam.findMany({
      where: { status: 'completed', encerramento: { lte: limite } },
      orderBy: { encerramento: 'desc' },
      include: { _count: { select: { participants: true } } },
    });
  }
}
