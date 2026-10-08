import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildPaginatedResponse,
  nomeSearchWhere,
  resolvePagination,
} from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateParticipantDto } from './dto/create-participant.dto.js';
import { ListParticipantsQueryDto } from './dto/list-participants-query.dto.js';
import { generateUniqueConsultaCodes } from './consulta-code.util.js';

@Injectable()
export class ParticipantsService {
  constructor(private prisma: PrismaService) {}

  private async assertExam(examId: number) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Prova não encontrada');
    return exam;
  }

  private async allocateConsultaCodes(examId: number, count: number): Promise<string[]> {
    const rows = await this.prisma.participant.findMany({
      where: { examId },
      select: { consultaCode: true },
    });
    const taken = new Set(rows.map((r) => r.consultaCode));
    return generateUniqueConsultaCodes(count, taken);
  }

  private async participantCreateData(examId: number, dto: CreateParticipantDto) {
    const [consultaCode] = await this.allocateConsultaCodes(examId, 1);
    return {
      examId,
      nome: dto.nome,
      consultaCode,
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
    if (!dtos.length) return { created: 0 };

    const codes = await this.allocateConsultaCodes(examId, dtos.length);
    const data = dtos.map((d, i) => ({
      examId,
      nome: d.nome,
      consultaCode: codes[i]!,
      presenca: d.presenca ?? false,
      aplicadorId: d.aplicadorId ?? null,
    }));
    const result = await this.prisma.participant.createMany({ data });
    return { created: result.count };
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
