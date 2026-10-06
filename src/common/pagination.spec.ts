import { describe, expect, it } from 'vitest';
import { buildPaginatedResponse, nomeSearchWhere, resolvePagination } from './pagination.js';

describe('pagination', () => {
  it('resolvePagination defaults', () => {
    expect(resolvePagination()).toEqual({ page: 1, limit: 10, skip: 0, take: 10 });
  });

  it('resolvePagination caps limit', () => {
    expect(resolvePagination(2, 500).take).toBe(100);
    expect(resolvePagination(2, 500).skip).toBe(100);
  });

  it('buildPaginatedResponse totalPages', () => {
    expect(buildPaginatedResponse([1], 25, 1, 10).meta.totalPages).toBe(3);
    expect(buildPaginatedResponse([], 0, 1, 10).meta.totalPages).toBe(0);
  });

  it('nomeSearchWhere empty when blank', () => {
    expect(nomeSearchWhere()).toEqual({});
    expect(nomeSearchWhere('   ')).toEqual({});
  });

  it('nomeSearchWhere contains insensitive', () => {
    expect(nomeSearchWhere('ana')).toEqual({
      nome: { contains: 'ana', mode: 'insensitive' },
    });
  });
});
