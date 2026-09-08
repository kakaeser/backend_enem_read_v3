import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.adm.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email já cadastrado');
    const hash = await bcrypt.hash(dto.senha, 10);
    const adm = await this.prisma.adm.create({ data: { email: dto.email, senha: hash } });
    return { id: adm.id, email: adm.email, createdAt: adm.createdAt };
  }

  async findAll() {
    const adms = await this.prisma.adm.findMany({ select: { id: true, email: true, createdAt: true } });
    return adms;
  }

  async findOne(id: number) {
    const adm = await this.prisma.adm.findUnique({ where: { id }, select: { id: true, email: true, createdAt: true } });
    if (!adm) throw new NotFoundException('Adm não encontrado');
    return adm;
  }

  async update(id: number, dto: UpdateUserDto) {
    const data: any = {};
    if (dto.email) {
      const exists = await this.prisma.adm.findUnique({ where: { email: dto.email } });
      if (exists && exists.id !== id) throw new ConflictException('Email já cadastrado');
      data.email = dto.email;
    }
    if (dto.senha) data.senha = await bcrypt.hash(dto.senha, 10);
    try {
      const adm = await this.prisma.adm.update({ where: { id }, data, select: { id: true, email: true, createdAt: true } });
      return adm;
    } catch {
      throw new NotFoundException('Adm não encontrado');
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.adm.delete({ where: { id } });
      return { message: 'Adm removido' };
    } catch {
      throw new NotFoundException('Adm não encontrado');
    }
  }
}
