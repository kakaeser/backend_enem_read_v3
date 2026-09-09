import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateExamDto } from './dto/create-exam.dto.js';
import { UpdateExamDto } from './dto/update-exam.dto.js';
import { ExamStatusDto } from './dto/update-status.dto.js';

const allowedTransitions: Record<string, string[]> = {
  draft: ['in_progress'],
  in_progress: ['completed'],
  completed: [],
};

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateExamDto) {
    return this.prisma.$transaction(async (tx) => {
      const exam = await tx.exam.create({
        data: {
          nome: dto.nome,
          qtdQuestoes: dto.qtdQuestoes,
          notaSimbolica: dto.notaSimbolica ?? 1000,
          status: 'draft',
        },
      });
      const questions = Array.from({ length: dto.qtdQuestoes }, (_, i) => ({
        examId: exam.id,
        numero: i + 1,
        peso: 1,
        correctAnswer: '',
        enunciado: '',
        alternativas: [] as any,
      }));
      await tx.question.createMany({ data: questions });
      const count = await tx.question.count({ where: { examId: exam.id } });
      return { ...exam, questionsCount: count };
    });
  }

  async findAll(status?: string) {
    return this.prisma.exam.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { questions: true, participants: true } } },
    });
  }

  async findOne(id: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { numero: 'asc' } },
        _count: { select: { participants: true } },
      },
    });
    if (!exam) throw new NotFoundException('Prova não encontrada');
    return exam;
  }

  async update(id: number, dto: UpdateExamDto) {
    try {
      const data: any = {};
      if (dto.nome !== undefined) data.nome = dto.nome;
      if (dto.notaSimbolica !== undefined) data.notaSimbolica = dto.notaSimbolica;
      return await this.prisma.exam.update({ where: { id }, data });
    } catch {
      throw new NotFoundException('Prova não encontrada');
    }
  }

  async updateStatus(id: number, status: ExamStatusDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException('Prova não encontrada');
    const allowed = allowedTransitions[exam.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Transição inválida: ${exam.status} → ${status}. Permitido: ${allowed.join(', ') || 'nenhuma'}`);
    }
    const data: any = { status: status as any };
    if (status === ExamStatusDto.completed) data.encerramento = new Date();
    return this.prisma.exam.update({ where: { id }, data });
  }

  async remove(id: number) {
    try {
      await this.prisma.exam.delete({ where: { id } });
      return { message: 'Prova removida' };
    } catch {
      throw new NotFoundException('Prova não encontrada');
    }
  }
}
