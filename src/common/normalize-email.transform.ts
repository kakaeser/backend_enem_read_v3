import { Transform } from 'class-transformer';

/** Trim + lowercase for Adm e-mail fields (invite, forgot-password). */
export function NormalizeEmail() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
}
