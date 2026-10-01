const DEFAULT_ORIGINS = 'http://localhost:3000,http://localhost:3001';

export function parseFrontendOrigins(): string[] {
  const raw = process.env.FRONTEND_URL ?? DEFAULT_ORIGINS;
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/** First origin from FRONTEND_URL (comma list), no trailing slash — for absolute email links. */
export function frontendBaseUrl(): string {
  const first = parseFrontendOrigins()[0] ?? 'http://localhost:3001';
  return first.replace(/\/+$/, '');
}
