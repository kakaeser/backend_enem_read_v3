import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AnswerItemDto } from './dto/answer-item.dto.js';

@Injectable()
export class AnswersService {
  constructor(private prisma: PrismaService) {}

  async bulkUpsert(examId: number, items: AnswerItemDto[]) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Prova não encontrada');
    if (!items.length) throw new BadRequestException('Nenhuma resposta enviada');

    const userIds = [...new Set(items.map((i) => i.userId))];
    const questIds = [...new Set(items.map((i) => i.questId))];
    const [users, quests] = await Promise.all([
      this.prisma.participant.findMany({ where: { id: { in: userIds } }, select: { id: true, examId: true } }),
      this.prisma.question.findMany({ where: { id: { in: questIds } }, select: { id: true, examId: true } }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u.examId]));
    const questMap = new Map(quests.map((q) => [q.id, q.examId]));

    for (const item of items) {
      const uExam = userMap.get(item.userId);
      const qExam = questMap.get(item.questId);
      if (uExam === undefined) throw new NotFoundException(`Participante ${item.userId} não encontrado`);
      if (qExam === undefined) throw new NotFoundException(`Questão ${item.questId} não encontrada`);
      if (uExam !== qExam) {
        throw new BadRequestException(`Participante ${item.userId} e questão ${item.questId} são de provas diferentes`);
      }
      if (uExam !== examId) {
        throw new BadRequestException(`Resposta fora da prova ${examId}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (const item of items) {
        const saved = await tx.answer.upsert({
          where: { userId_questId: { userId: item.userId, questId: item.questId } },
          update: { alternativa: item.alternativa, manuallyReviewed: true },
          create: { userId: item.userId, questId: item.questId, alternativa: item.alternativa },
        });
        results.push(saved);
      }
      return { saved: results.length };
    });
  }

  async update(id: number, alternativa: string) {
    try {
      return await this.prisma.answer.update({ where: { id }, data: { alternativa, manuallyReviewed: true } });
    } catch {
      throw new NotFoundException('Resposta não encontrada');
    }
  }

  async findByParticipant(examId: number, participantId: number) {
    const p = await this.prisma.participant.findFirst({ where: { id: participantId, examId } });
    if (!p) throw new NotFoundException('Participante não encontrado nesta prova');
    return this.prisma.answer.findMany({
      where: { userId: participantId },
      include: { quest: { select: { id: true, numero: true, correctAnswer: true, peso: true } } },
      orderBy: { quest: { numero: 'asc' } },
    });
  }
}
