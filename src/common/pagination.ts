export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export type PaginatedMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginatedMeta;
};

export function resolvePagination(page?: number, limit?: number) {
  const resolvedPage = page ?? DEFAULT_PAGE;
  const resolvedLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  return {
    page: resolvedPage,
    limit: resolvedLimit,
    skip: (resolvedPage - 1) * resolvedLimit,
    take: resolvedLimit,
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export type NomeSearchWhere = {
  nome?: { contains: string; mode: 'insensitive' };
};

export function nomeSearchWhere(search?: string): NomeSearchWhere {
  const q = search?.trim();
  if (!q) return {};
  return { nome: { contains: q, mode: 'insensitive' } };
}
