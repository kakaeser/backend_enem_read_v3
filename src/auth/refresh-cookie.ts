import type { CookieOptions, Request, Response } from 'express';
import { parseDurationToMs } from '../common/parse-duration.util.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';

function refreshCookieOptions(): CookieOptions {
  const refreshTtl = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
    maxAge: parseDurationToMs(refreshTtl),
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
  });
}

export function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' ? value : undefined;
}
