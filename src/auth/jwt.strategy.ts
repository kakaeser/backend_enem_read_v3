import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET não definido no .env');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: number; email?: string; nome?: string; type: 'adm' | 'aplicador'; provaId?: number }) {
    // Verifica se o usuário ainda existe (revogação se Adm/Aplicador foi deletado)
    if (payload.type === 'adm') {
      const adm = await this.prisma.adm.findUnique({ where: { id: payload.sub } });
      if (!adm) throw new UnauthorizedException('Adm não existe mais');
    } else {
      const aplicador = await this.prisma.aplicador.findUnique({ where: { id: payload.sub } });
      if (!aplicador) throw new UnauthorizedException('Aplicador não existe mais');
      if (aplicador.status !== 'APROVADO') throw new UnauthorizedException('Aplicador não está mais aprovado');
    }
    return payload;
  }
}
