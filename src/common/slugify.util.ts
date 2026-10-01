const MAX_SLUG_LEN = 40;

/** Lowercase slug for filenames: non-alphanum → hyphen, collapse, truncate. */
export function slugifyExamNome(nome: string): string {
  const slug = nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) return 'prova';
  return slug.length > MAX_SLUG_LEN ? slug.slice(0, MAX_SLUG_LEN).replace(/-$/, '') : slug;
}

export function examResultsFilename(examId: number, examNome: string): string {
  return `resultados-${slugifyExamNome(examNome)}-${examId}.xlsx`;
}
