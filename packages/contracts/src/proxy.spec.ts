import { describe, expect, it } from 'vitest';
import {
  CLIENT_ADDRESS_HEADER,
  PROXY_SECRET_HEADER,
  UPSTREAM_UNAVAILABLE_MESSAGE,
} from './index.js';

describe('proxy contract', () => {
  it('names the headers the Worker sends to the API in lowercase', () => {
    expect(PROXY_SECRET_HEADER).toBe('x-genialtanken-proxy-secret');
    expect(CLIENT_ADDRESS_HEADER).toBe('x-genialtanken-client-address');
  });

  it('describes an unreachable API the same way the API describes an unreachable upstream', () => {
    expect(UPSTREAM_UNAVAILABLE_MESSAGE).toBe('The fuel price service is unavailable.');
  });
});
