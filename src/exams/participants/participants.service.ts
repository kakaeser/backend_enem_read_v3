import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildPaginatedResponse,
  nomeSearchWhere,
  resolvePagination,
} from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateParticipantDto } from './dto/create-participant.dto.js';
import { ListParticipantsQueryDto } from './dto/list-participants-query.dto.js';
import { generateConsultaCodeRaw } from './consulta-code.util.js';

@Injectable()
export class ParticipantsService {
  constructor(private prisma: PrismaService) {}

  private async assertExam(examId: number) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Prova não encontrada');
    return exam;
  }

  private async allocateConsultaCode(examId: number): Promise<string> {
    for (let attempt = 0; attempt < 25; attempt++) {
      const code = generateConsultaCodeRaw();
      const exists = await this.prisma.participant.findFirst({
        where: { examId, consultaCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new Error('Não foi possível gerar código de consulta único');
  }

  private async participantCreateData(examId: number, dto: CreateParticipantDto) {
    return {
      examId,
      nome: dto.nome,
      consultaCode: await this.allocateConsultaCode(examId),
      presenca: dto.presenca ?? false,
      aplicadorId: dto.aplicadorId ?? null,
    };
  }

  async create(examId: number, dto: CreateParticipantDto) {
    await this.assertExam(examId);
    return this.prisma.participant.create({
      data: await this.participantCreateData(examId, dto),
    });
  }

  async createMany(examId: number, dtos: CreateParticipantDto[]) {
    await this.assertExam(examId);
    const created = [];
    for (const d of dtos) {
      created.push(
        await this.prisma.participant.create({
          data: await this.participantCreateData(examId, d),
        }),
      );
    }
    return { created: created.length };
  }

  async findAll(examId: number, query: ListParticipantsQueryDto) {
    await this.assertExam(examId);
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where = { examId, ...nomeSearchWhere(query.search) };
    const [total, data] = await Promise.all([
      this.prisma.participant.count({ where }),
      this.prisma.participant.findMany({
        where,
        orderBy: { nome: 'asc' },
        include: { _count: { select: { answers: true } } },
        skip,
        take,
      }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findAllPresente(examId: number, query: ListParticipantsQueryDto) {
    await this.assertExam(examId);
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where = { examId, presenca: true, ...nomeSearchWhere(query.search) };
    const [total, data] = await Promise.all([
      this.prisma.participant.count({ where }),
      this.prisma.participant.findMany({
        where,
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          presenca: true,
          redacaoNota: true,
          examId: true,
          aplicadorId: true,
          _count: { select: { answers: true } },
        },
        skip,
        take,
      }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  private async assertOwned(examId: number, id: number) {
    const p = await this.prisma.participant.findFirst({ where: { id, examId } });
    if (!p) throw new NotFoundException('Participante não encontrado nesta prova');
    return p;
  }

  async updatePresenca(examId: number, id: number, presenca: boolean) {
    await this.assertOwned(examId, id);
    return this.prisma.participant.update({ where: { id }, data: { presenca } });
  }

  async updateRedacao(examId: number, id: number, redacaoNota: number | null) {
    await this.assertOwned(examId, id);
    return this.prisma.participant.update({ where: { id }, data: { redacaoNota } });
  }

  async remove(examId: number, id: number) {
    await this.assertOwned(examId, id);
    await this.prisma.participant.delete({ where: { id } });
    return { message: 'Participante removido' };
  }
}
