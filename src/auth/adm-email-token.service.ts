import { BadRequestException, Injectable } from '@nestjs/common';
import type { AdmEmailToken, AdmEmailTokenPurpose } from '@prisma/client';
import { generateOpaqueToken, hashToken } from '../common/opaque-token.util.js';
import { expiresAtFromDuration } from '../common/parse-duration.util.js';
import { PrismaService } from '../prisma/prisma.service.js';

const INVALID_TOKEN_MSG = 'Token inválido ou expirado';

@Injectable()
export class AdmEmailTokenService {
  constructor(private prisma: PrismaService) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async invalidatePending(email: string, purpose: AdmEmailTokenPurpose): Promise<void> {
    const normalized = this.normalizeEmail(email);
    await this.prisma.admEmailToken.updateMany({
      where: { email: normalized, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async issueInvite(params: { email: string; invitedByAdmId: number }): Promise<{ token: string }> {
    const email = this.normalizeEmail(params.email);
    await this.invalidatePending(email, 'invite');
    const token = generateOpaqueToken();
    const ttl = process.env.ADM_INVITE_EXPIRES_IN ?? '7d';
    await this.prisma.admEmailToken.create({
      data: {
        email,
        purpose: 'invite',
        tokenHash: hashToken(token),
        expiresAt: expiresAtFromDuration(ttl),
        usedAt: null,
        invitedByAdmId: params.invitedByAdmId,
      },
    });
    return { token };
  }

  async issuePasswordReset(params: { admId: number; email: string }): Promise<{ token: string }> {
    const email = this.normalizeEmail(params.email);
    await this.invalidatePending(email, 'password_reset');
    const token = generateOpaqueToken();
    const ttl = process.env.ADM_RESET_EXPIRES_IN ?? '1h';
    await this.prisma.admEmailToken.create({
      data: {
        email,
        admId: params.admId,
        purpose: 'password_reset',
        tokenHash: hashToken(token),
        expiresAt: expiresAtFromDuration(ttl),
        usedAt: null,
      },
    });
    return { token };
  }

  async consume(plaintext: string, expectedPurpose: AdmEmailTokenPurpose): Promise<AdmEmailToken> {
    const tokenHash = hashToken(plaintext);
    const row = await this.prisma.admEmailToken.findUnique({ where: { tokenHash } });
    if (!row || row.purpose !== expectedPurpose || row.usedAt != null || row.expiresAt < new Date()) {
      throw new BadRequestException(INVALID_TOKEN_MSG);
    }

    const updated = await this.prisma.admEmailToken.updateMany({
      where: { tokenHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (updated.count === 0) {
      throw new BadRequestException(INVALID_TOKEN_MSG);
    }

    return row;
  }
}
