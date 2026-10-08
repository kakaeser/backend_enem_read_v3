import { randomBytes } from 'node:crypto';

/** Sem 0/O/1/I para leitura em papel. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const MAX_CODE_GEN_ATTEMPTS = 25;

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

/** Gera `count` códigos únicos em relação a `taken` (DB + batch). */
export function generateUniqueConsultaCodes(count: number, taken: ReadonlySet<string>): string[] {
  const codes: string[] = [];
  const used = new Set(taken);
  for (let i = 0; i < count; i++) {
    let code: string | undefined;
    for (let attempt = 0; attempt < MAX_CODE_GEN_ATTEMPTS; attempt++) {
      const candidate = generateConsultaCodeRaw();
      if (!used.has(candidate)) {
        code = candidate;
        used.add(candidate);
        break;
      }
    }
    if (!code) {
      throw new Error('Não foi possível gerar código de consulta único');
    }
    codes.push(code);
  }
  return codes;
}
