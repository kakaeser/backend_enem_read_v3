export function parseDurationToMs(input: string): number {
  const trimmed = input.trim();
  const match = /^(\d+)([dhms])$/.exec(trimmed);
  if (!match) {
    throw new Error(`Duração inválida: ${input}`);
  }
  const n = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    d: 86_400_000,
    h: 3_600_000,
    m: 60_000,
    s: 1_000,
  };
  return n * multipliers[unit]!;
}

export function expiresAtFromDuration(input: string, from: Date = new Date()): Date {
  return new Date(from.getTime() + parseDurationToMs(input));
}
