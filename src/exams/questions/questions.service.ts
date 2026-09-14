import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuestionBulkItemDto } from './dto/bulk-questions.dto.js';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async bulkUpsert(examId: number, items: QuestionBulkItemDto[]) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Prova não encontrada');

    // Validação: correctAnswer deve estar em alternativas (A-D, frontend já protege com zod)
    for (const item of items) {
      const letras = item.alternativas.map((a) => a.letra);
      if (!letras.includes(item.correctAnswer)) {
        throw new BadRequestException(`Questão ${item.numero}: correctAnswer ${item.correctAnswer} não está em alternativas [${letras.join(',')}]`);
      }
      if (letras.some((l) => !['A', 'B', 'C', 'D'].includes(l))) {
        throw new BadRequestException(`Questão ${item.numero}: alternativas devem ser A-D`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (const item of items) {
        if (item.id) {
          // update
          const exists = await tx.question.findUnique({ where: { id: item.id } });
          if (!exists || exists.examId !== examId) throw new NotFoundException(`Questão id ${item.id} não encontrada nesta prova`);
          const updated = await tx.question.update({
            where: { id: item.id },
            data: {
              numero: item.numero,
              enunciado: item.enunciado,
              alternativas: item.alternativas as any,
              correctAnswer: item.correctAnswer,
              peso: item.peso ?? 1,
            },
          });
          results.push(updated);
        } else {
          // create
          const created = await tx.question.create({
            data: {
              examId,
              numero: item.numero,
              enunciado: item.enunciado,
              alternativas: item.alternativas as any,
              correctAnswer: item.correctAnswer,
              peso: item.peso ?? 1,
            },
          });
          results.push(created);
        }
      }
      return results;
    });
  }

  async findAll(examId: number) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Prova não encontrada');
    return this.prisma.question.findMany({ where: { examId }, orderBy: { numero: 'asc' } });
  }

  async findOne(examId: number, questionId: number) {
    const q = await this.prisma.question.findFirst({ where: { id: questionId, examId } });
    if (!q) throw new NotFoundException('Questão não encontrada');
    return q;
  }

  async remove(examId: number, questionId: number) {
    const q = await this.prisma.question.findFirst({ where: { id: questionId, examId } });
    if (!q) throw new NotFoundException('Questão não encontrada nesta prova');
    await this.prisma.question.delete({ where: { id: questionId } });
    return { message: 'Questão removida' };
  }
}
