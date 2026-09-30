import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdmEmailTokenService } from './adm-email-token.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './jwt.strategy.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN as any) ?? '15m' },
    }),
  ],
  providers: [AuthService, AdmEmailTokenService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule, PassportModule, AdmEmailTokenService],
})
export class AuthModule {}
