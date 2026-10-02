import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiRequest } from './create-api-request.ts';

const API_ORIGIN = 'https://genialtanken-api.onrender.com';

describe('createApiRequest', () => {
  it('forwards path and query to the API origin', () => {
    const incoming = new Request(
      'https://genialtanken.pages.dev/api/stations?latitude=48.85&longitude=2.35&fuel=e10'
    );

    const forwarded = createApiRequest(incoming, API_ORIGIN);

    assert.equal(
      forwarded.url,
      'https://genialtanken-api.onrender.com/api/stations?latitude=48.85&longitude=2.35&fuel=e10'
    );
  });

  it('replaces any client supplied forwarding header with the connecting client address', () => {
    const incoming = new Request('https://genialtanken.pages.dev/api/stations/fr-75012010', {
      headers: { 'CF-Connecting-IP': '198.51.100.7', 'X-Forwarded-For': '10.0.0.1' },
    });

    const forwarded = createApiRequest(incoming, API_ORIGIN);

    assert.equal(forwarded.headers.get('X-Forwarded-For'), '198.51.100.7');
  });

  it('keeps the request method', () => {
    const incoming = new Request('https://genialtanken.pages.dev/api/stations', { method: 'HEAD' });

    assert.equal(createApiRequest(incoming, API_ORIGIN).method, 'HEAD');
  });
});
