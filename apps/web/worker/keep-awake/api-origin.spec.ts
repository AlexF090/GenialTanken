import { describe, expect, it } from 'vitest';
import { isAllowedApiOrigin } from './api-origin.ts';

describe('isAllowedApiOrigin', () => {
  it('allows an https origin', () => {
    expect(isAllowedApiOrigin('https://genialtanken-api.onrender.com')).toBe(true);
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000'])(
    'allows plain http for the local API %s',
    origin => {
      expect(isAllowedApiOrigin(origin)).toBe(true);
    }
  );

  it.each([
    'http://genialtanken-api.onrender.com',
    'http://localhost.example.com',
    'http://127.0.0.2:3000',
    'ftp://localhost',
    'localhost:3000',
    'not a url',
    '',
  ])('rejects %j', origin => {
    expect(isAllowedApiOrigin(origin)).toBe(false);
  });

  it('rejects a missing origin', () => {
    expect(isAllowedApiOrigin(undefined)).toBe(false);
  });
});
