import { timingSafeEqual } from 'node:crypto';

export const APP_API_KEY_HEADER = 'x-app-api-key';

export function getAppApiKey(): string | undefined {
  const value = process.env.APP_API_KEY?.trim();
  return value || undefined;
}

export function assertAppApiKeyConfigured(): void {
  if (process.env.NODE_ENV === 'production' && !getAppApiKey()) {
    throw new Error('APP_API_KEY é obrigatório quando NODE_ENV=production');
  }
}

export function isAppApiKeyEnforced(): boolean {
  return Boolean(getAppApiKey());
}

export function verifyAppApiKey(provided: string | string[] | undefined): boolean {
  const expected = getAppApiKey();
  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }

  const raw = Array.isArray(provided) ? provided[0] : provided;
  if (typeof raw !== 'string') return false;

  const a = Buffer.from(raw.trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
