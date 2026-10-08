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

    const seenNumeros = new Set<number>();
    for (const item of items) {
      if (seenNumeros.has(item.numero)) {
        throw new BadRequestException(`Número ${item.numero} duplicado na requisição`);
      }
      seenNumeros.add(item.numero);
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.question.findMany({
        where: { examId },
        select: { id: true, numero: true, examId: true },
      });
      const existingByNumero = new Map(existing.map((q) => [q.numero, q.id]));
      const existingById = new Map(existing.map((q) => [q.id, q]));
      const results: any[] = [];
      for (const item of items) {
        const data = {
          numero: item.numero,
          enunciado: item.enunciado,
          alternativas: item.alternativas as any,
          correctAnswer: item.correctAnswer,
          peso: item.peso ?? 1,
        };
        let targetId: number | undefined;
        if (item.id !== undefined) {
          const row = existingById.get(item.id);
          if (!row || row.examId !== examId) {
            throw new NotFoundException(`Questão id ${item.id} não encontrada nesta prova`);
          }
          targetId = item.id;
        } else {
          targetId = existingByNumero.get(item.numero);
        }
        if (targetId) {
          results.push(await tx.question.update({ where: { id: targetId }, data }));
        } else {
          try {
            results.push(await tx.question.create({ data: { ...data, examId } }));
          } catch (e: any) {
            if (e?.code === 'P2002') throw new BadRequestException(`Número ${item.numero} já existe nesta prova`);
            throw e;
          }
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
