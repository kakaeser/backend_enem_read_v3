import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdmEmailTokenService } from '../auth/adm-email-token.service.js';
import { frontendBaseUrl } from '../common/frontend-url.js';
import { buildAdmInviteEmail } from '../mail/mail.templates.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private admEmailTokenService: AdmEmailTokenService,
    private mail: MailService,
  ) {}

  async invite(invitedByAdmId: number, dto: InviteUserDto) {
    const email = this.admEmailTokenService.normalizeEmail(dto.email);
    const exists = await this.prisma.adm.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email já cadastrado');

    const { token } = await this.admEmailTokenService.issueInvite({ email, invitedByAdmId });
    const acceptUrl = `${frontendBaseUrl()}/aceitar-convite?token=${encodeURIComponent(token)}`;
    const { subject, html } = buildAdmInviteEmail(acceptUrl);
    await this.mail.send({ to: email, subject, html });

    return { message: 'Convite enviado', email };
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
