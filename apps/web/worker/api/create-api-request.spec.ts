import {
  CLIENT_ADDRESS_HEADER as CONTRACTS_CLIENT_ADDRESS_HEADER,
  PROXY_SECRET_HEADER as CONTRACTS_PROXY_SECRET_HEADER,
} from '@genialtanken/contracts';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_ADDRESS_HEADER,
  PROXY_SECRET_HEADER,
  createApiRequest,
} from './create-api-request.ts';

describe('proxy header names', () => {
  // HTTP header names are case-insensitive, so only the lowercase forms must match.
  it('match the header names the API reads', () => {
    expect(PROXY_SECRET_HEADER.toLowerCase()).toBe(CONTRACTS_PROXY_SECRET_HEADER.toLowerCase());
    expect(CLIENT_ADDRESS_HEADER.toLowerCase()).toBe(CONTRACTS_CLIENT_ADDRESS_HEADER.toLowerCase());
  });
});

const API_ORIGIN = 'https://genialtanken-api.onrender.com';
const PROXY_SECRET = 'proxy-secret';

describe('createApiRequest', () => {
  it('forwards path and query to the API origin', () => {
    const incoming = new Request(
      'https://genialtanken.alexf090.workers.dev/api/stations?latitude=48.85&longitude=2.35&fuel=e10'
    );

    const forwarded = createApiRequest(incoming, { apiOrigin: API_ORIGIN });

    expect(forwarded.url).toBe(
      'https://genialtanken-api.onrender.com/api/stations?latitude=48.85&longitude=2.35&fuel=e10'
    );
  });

  it('keeps the request method', () => {
    const incoming = new Request('https://genialtanken.alexf090.workers.dev/api/stations', {
      method: 'HEAD',
    });

    expect(createApiRequest(incoming, { apiOrigin: API_ORIGIN }).method).toBe('HEAD');
  });

  it('drops client supplied forwarding, client address and proxy secret headers', () => {
    const incoming = new Request(
      'https://genialtanken.alexf090.workers.dev/api/stations/fr-75012010',
      {
        headers: {
          'CF-Connecting-IP': '198.51.100.7',
          'X-Forwarded-For': '10.0.0.1',
          'X-GenialTanken-Client-Address': '10.0.0.2',
          'X-GenialTanken-Proxy-Secret': 'guessed-secret',
        },
      }
    );

    const forwarded = createApiRequest(incoming, { apiOrigin: API_ORIGIN });

    expect(forwarded.headers.get('X-Forwarded-For')).toBeNull();
    expect(forwarded.headers.get('X-GenialTanken-Client-Address')).toBeNull();
    expect(forwarded.headers.get('X-GenialTanken-Proxy-Secret')).toBeNull();
  });

  it('identifies itself and the connecting client when a proxy secret is configured', () => {
    const incoming = new Request(
      'https://genialtanken.alexf090.workers.dev/api/stations/fr-75012010',
      {
        headers: {
          'CF-Connecting-IP': '198.51.100.7',
          'X-Forwarded-For': '10.0.0.1',
          'X-GenialTanken-Client-Address': '10.0.0.2',
          'X-GenialTanken-Proxy-Secret': 'guessed-secret',
        },
      }
    );

    const forwarded = createApiRequest(incoming, {
      apiOrigin: API_ORIGIN,
      proxySecret: PROXY_SECRET,
    });

    expect(forwarded.headers.get('X-GenialTanken-Proxy-Secret')).toBe(PROXY_SECRET);
    expect(forwarded.headers.get('X-GenialTanken-Client-Address')).toBe('198.51.100.7');
    expect(forwarded.headers.get('X-Forwarded-For')).toBeNull();
  });

  it('sends no client address when Cloudflare reports none', () => {
    const incoming = new Request('https://genialtanken.alexf090.workers.dev/api/stations', {
      headers: { 'X-GenialTanken-Client-Address': '10.0.0.2' },
    });

    const forwarded = createApiRequest(incoming, {
      apiOrigin: API_ORIGIN,
      proxySecret: PROXY_SECRET,
    });

    expect(forwarded.headers.get('X-GenialTanken-Proxy-Secret')).toBe(PROXY_SECRET);
    expect(forwarded.headers.get('X-GenialTanken-Client-Address')).toBeNull();
  });
});
