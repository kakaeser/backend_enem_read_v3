import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
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
    const refresh_token = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as any) ?? '7d',
    });
    const tokenHash = hashToken(refresh_token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7d
    await this.prisma.refreshToken.create({
      data: { admId: adm.id, tokenHash, expiresAt },
    });
    return { access_token, refresh_token };
  }

  async loginAdm(email: string, senha: string) {
    const adm = await this.validateAdm(email, senha);
    const tokens = await this.issueTokens(adm);
    return {
      ...tokens,
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

  async loginAplicador(nome: string, provaId: number) {
    const aplicador = await this.prisma.aplicador.findFirst({
      where: { nome, provaId },
    });
    if (!aplicador) throw new UnauthorizedException('Aplicador não encontrado para esta prova');
    if (aplicador.status !== 'APROVADO') throw new ForbiddenException(`Aplicador com status ${aplicador.status} — aguarde aprovação do ADM`);
    const exam = await this.prisma.exam.findUnique({ where: { id: provaId } });
    if (!exam || exam.status !== 'in_progress') throw new ForbiddenException('Prova não está em andamento — login como aplicador bloqueado');
    const payload = { sub: aplicador.id, nome: aplicador.nome, type: 'aplicador' as const, provaId };
    // Aplicador continua sem refresh (sessão curta)
    const access_token = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: (process.env.JWT_EXPIRES_IN as any) ?? '15m',
    });
    return {
      access_token,
      aplicador: { id: aplicador.id, nome: aplicador.nome, provaId },
    };
  }
}
