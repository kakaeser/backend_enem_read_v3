import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateParticipantDto } from './dto/create-participant.dto.js';

@Injectable()
export class ParticipantsService {
  constructor(private prisma: PrismaService) {}

  private async assertExam(examId: number) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Prova não encontrada');
    return exam;
  }

  async create(examId: number, dto: CreateParticipantDto) {
    await this.assertExam(examId);
    return this.prisma.participant.create({
      data: {
        examId,
        nome: dto.nome,
        presenca: dto.presenca ?? false,
        aplicadorId: dto.aplicadorId ?? null,
      },
    });
  }

  async createMany(examId: number, dtos: CreateParticipantDto[]) {
    await this.assertExam(examId);
    await this.prisma.participant.createMany({
      data: dtos.map((d) => ({
        examId,
        nome: d.nome,
        presenca: d.presenca ?? false,
        aplicadorId: d.aplicadorId ?? null,
      })),
    });
    return { created: dtos.length };
  }

  async importExcel(examId: number, buffer: Buffer) {
    await this.assertExam(examId);
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Arquivo inválido — envie um .xlsx válido');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Planilha sem abas');
    const names: string[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // cabeçalho
      const cell = row.getCell(1).value;
      const nome = typeof cell === 'string' ? cell.trim() : cell != null ? String(cell).trim() : '';
      if (nome) names.push(nome);
    });
    if (!names.length) throw new BadRequestException('Nenhum nome encontrado na primeira coluna');
    await this.prisma.participant.createMany({
      data: names.map((nome) => ({ examId, nome, presenca: false })),
    });
    return { created: names.length };
  }

  async findAll(examId: number) {
    await this.assertExam(examId);
    return this.prisma.participant.findMany({
      where: { examId },
      orderBy: { nome: 'asc' },
      include: { _count: { select: { answers: true } } },
    });
  }

  async findAllPresente(examId: number) {
    await this.assertExam(examId);
    return this.prisma.participant.findMany({
      where: { examId, presenca: true },
      orderBy: { nome: 'asc' },
      include: { _count: { select: { answers: true } } },
    });
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
    // Answers em cascata via onDelete: Cascade no Prisma
    await this.prisma.participant.delete({ where: { id } });
    return { message: 'Participante removido' };
  }
}
