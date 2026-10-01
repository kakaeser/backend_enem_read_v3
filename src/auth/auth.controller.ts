import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { AplicadorLoginDto } from './dto/aplicador-login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie.js';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.loginAdm(dto.email, dto.senha);
    setRefreshCookie(res, result.refresh_token);
    return { access_token: result.access_token, adm: result.adm };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = readRefreshCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token ausente');
    }
    const tokens = await this.auth.refresh(refreshToken);
    setRefreshCookie(res, tokens.refresh_token);
    return { access_token: tokens.access_token };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = readRefreshCookie(req);
    if (refreshToken) {
      await this.auth.logout(refreshToken);
    }
    clearRefreshCookie(res);
    return { message: 'Logout efetuado' };
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.CREATED)
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.auth.acceptInvite(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('aplicador')
  async loginAplicador(@Body() dto: AplicadorLoginDto) {
    return this.auth.loginAplicador(dto.nome, dto.provaId);
  }
}
