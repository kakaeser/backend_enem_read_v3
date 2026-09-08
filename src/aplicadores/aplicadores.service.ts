import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAplicadorDto } from './dto/create-aplicador.dto.js';
import { AplicadorStatusDto } from './dto/update-status.dto.js';

@Injectable()
export class AplicadoresService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAplicadorDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id: dto.provaId } });
    if (!exam) throw new NotFoundException('Prova não encontrada');
    const aplicador = await this.prisma.aplicador.create({
      data: { nome: dto.nome, provaId: dto.provaId, status: 'PENDENTE' },
    });
    return aplicador;
  }

  async findAll(provaId?: number) {
    return this.prisma.aplicador.findMany({
      where: provaId ? { provaId } : undefined,
      include: { prova: { select: { id: true, nome: true, status: true } } },
    });
  }

  async updateStatus(id: number, status: AplicadorStatusDto) {
    try {
      const aplicador = await this.prisma.aplicador.update({ where: { id }, data: { status: status as any } });
      return aplicador;
    } catch {
      throw new NotFoundException('Aplicador não encontrado');
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.aplicador.delete({ where: { id } });
      return { message: 'Aplicador removido' };
    } catch {
      throw new NotFoundException('Aplicador não encontrado');
    }
  }
}
