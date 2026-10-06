import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/public.decorator.js';
import { AppApiKeyGuard } from './app-api-key.guard.js';

function mockContext(method: string, headers: Record<string, string> = {}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ method, headers }),
    }),
  } as ExecutionContext;
}

describe('AppApiKeyGuard', () => {
  const reflector = new Reflector();
  let guard: AppApiKeyGuard;

  beforeEach(() => {
    guard = new AppApiKeyGuard(reflector);
    delete process.env.APP_API_KEY;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('permite rota @Public()', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    expect(guard.canActivate(mockContext('GET'))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
  });

  it('permite OPTIONS', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    expect(guard.canActivate(mockContext('OPTIONS'))).toBe(true);
  });

  it('permite sem APP_API_KEY fora de production', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    expect(guard.canActivate(mockContext('GET'))).toBe(true);
  });

  it('rejeita key ausente quando APP_API_KEY definido', () => {
    process.env.APP_API_KEY = 'secret-key';
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    expect(() => guard.canActivate(mockContext('POST'))).toThrow(ForbiddenException);
  });

  it('aceita key correta', () => {
    process.env.APP_API_KEY = 'secret-key';
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    expect(guard.canActivate(mockContext('POST', { 'x-app-api-key': 'secret-key' }))).toBe(true);
  });
});
