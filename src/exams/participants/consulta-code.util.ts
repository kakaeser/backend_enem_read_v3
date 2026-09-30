import { randomBytes } from 'node:crypto';

/** Sem 0/O/1/I para leitura em papel. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateConsultaCodeRaw(length = 8): string {
  const bytes = randomBytes(length);
  let s = '';
  for (let i = 0; i < length; i++) {
    s += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return s;
}

export function normalizeConsultaCode(input: string): string {
  return input.trim().replace(/-/g, '').toUpperCase();
}
