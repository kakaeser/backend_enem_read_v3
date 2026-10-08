import { afterEach, describe, expect, it } from 'vitest';
import {
  assertAppApiKeyConfigured,
  getAppApiKey,
  verifyAppApiKey,
} from './app-api-key.config.js';

describe('app-api-key.config', () => {
  afterEach(() => {
    delete process.env.APP_API_KEY;
    delete process.env.NODE_ENV;
  });

  it('getAppApiKey trim', () => {
    process.env.APP_API_KEY = '  abc  ';
    expect(getAppApiKey()).toBe('abc');
  });

  it('assertAppApiKeyConfigured falha em production sem key', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertAppApiKeyConfigured()).toThrow(/APP_API_KEY/);
  });

  it('verifyAppApiKey compara com timing-safe', () => {
    process.env.APP_API_KEY = 'test-key';
    expect(verifyAppApiKey('test-key')).toBe(true);
    expect(verifyAppApiKey('wrong')).toBe(false);
  });
});
