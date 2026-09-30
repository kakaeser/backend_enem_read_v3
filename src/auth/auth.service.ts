import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AdmEmailTokenService } from './adm-email-token.service.js';
import { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { frontendBaseUrl } from '../common/frontend-url.js';
import { hashToken } from '../common/opaque-token.util.js';
import { expiresAtFromDuration } from '../common/parse-duration.util.js';
import { buildPasswordResetEmail } from '../mail/mail.templates.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const INVALID_TOKEN_MSG = 'Token inválido ou expirado';
export const FORGOT_PASSWORD_MESSAGE = 'Se o e-mail existir, enviaremos instruções.';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private admEmailTokenService: AdmEmailTokenService,
    private mail: MailService,
  ) {}

  async validateAdm(email: string, senha: string) {
    const adm = await this.prisma.adm.findUnique({ where: { email } });
    if (!adm) throw new UnauthorizedException('Credenciais inválidas');
    const ok = await bcrypt.compare(senha, adm.senha);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');
    return adm;
  }

  private async issueTokens(adm: { id: number; email: string }) {
    const payload = { sub: adm.id, email: adm.email, type: 'adm' as const };
    const access_token = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: (process.env.JWT_EXPIRES_IN as any) ?? '15m',
    });
    const refresh_token = await this.jwt.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as any) ?? '7d',
      },
    );
    const tokenHash = hashToken(refresh_token);
    const refreshTtl = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
    const expiresAt = expiresAtFromDuration(refreshTtl);
    await this.prisma.refreshToken.create({
      data: { admId: adm.id, tokenHash, expiresAt },
    });
    return { access_token, refresh_token };
  }

  async loginAdm(email: string, senha: string) {
    const adm = await this.validateAdm(email, senha);
    const { access_token, refresh_token } = await this.issueTokens(adm);
    return {
      access_token,
      refresh_token,
      adm: { id: adm.id, email: adm.email },
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: number; email: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
    if (payload.type !== 'adm') throw new UnauthorizedException('Refresh só para Adm');

    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token revogado ou expirado');
    }
    // Verifica se Adm ainda existe (mesma checagem da JwtStrategy)
    const adm = await this.prisma.adm.findUnique({ where: { id: payload.sub } });
    if (!adm) throw new UnauthorizedException('Adm não existe mais');

    // Rotação: revoga antigo e emite novos
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    return this.issueTokens(adm);
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
    return { message: 'Logout efetuado' };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const tokenHash = hashToken(dto.token);
    const row = await this.prisma.admEmailToken.findUnique({ where: { tokenHash } });
    if (!row || row.purpose !== 'invite' || row.usedAt != null || row.expiresAt < new Date()) {
      throw new BadRequestException(INVALID_TOKEN_MSG);
    }
    const exists = await this.prisma.adm.findUnique({ where: { email: row.email } });
    if (exists) throw new ConflictException('Email já cadastrado');

    await this.admEmailTokenService.consume(dto.token, 'invite');
    const senhaHash = await bcrypt.hash(dto.senha, 10);
    await this.prisma.adm.create({ data: { email: row.email, senha: senhaHash } });
    return { message: 'Conta criada com sucesso' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.admEmailTokenService.normalizeEmail(dto.email);
    const adm = await this.prisma.adm.findUnique({ where: { email } });
    if (adm) {
      const { token } = await this.admEmailTokenService.issuePasswordReset({ admId: adm.id, email });
      const resetUrl = `${frontendBaseUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;
      const { subject, html } = buildPasswordResetEmail(resetUrl);
      await this.mail.send({ to: email, subject, html });
    }
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.admEmailTokenService.consume(dto.token, 'password_reset');
    if (row.admId == null) {
      throw new BadRequestException(INVALID_TOKEN_MSG);
    }
    const senhaHash = await bcrypt.hash(dto.senha, 10);
    await this.prisma.adm.update({ where: { id: row.admId }, data: { senha: senhaHash } });
    await this.prisma.refreshToken.updateMany({
      where: { admId: row.admId, revoked: false },
      data: { revoked: true },
    });
    return { message: 'Senha redefinida com sucesso' };
  }

  async loginAplicador(nome: string, provaId: number) {
    const aplicador = await this.prisma.aplicador.findFirst({
      where: { nome, provaId },
    });
    if (!aplicador) throw new NotFoundException('Aplicador não encontrado para esta prova');
    if (aplicador.status !== 'APROVADO') throw new ForbiddenException(`Aplicador com status ${aplicador.status} — aguarde aprovação do ADM`);
    const exam = await this.prisma.exam.findUnique({ where: { id: provaId } });
    if (!exam || exam.status !== 'in_progress') throw new ForbiddenException('Prova não está em andamento — login como aplicador bloqueado');
    const payload = { sub: aplicador.id, nome: aplicador.nome, type: 'aplicador' as const, provaId };
    const access_token = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: (process.env.APLICADOR_JWT_EXPIRES_IN as any) ?? '6h',
    });
    return {
      access_token,
      aplicador: { id: aplicador.id, nome: aplicador.nome, provaId },
    };
  }
}
