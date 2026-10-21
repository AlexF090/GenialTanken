import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { requestUpstream } from './request-upstream.js';
import { UpstreamAbortedError, UpstreamError } from './upstream-error.js';

let silentServer: Server;
let silentUrl: URL;

beforeAll(async () => {
  // Accepts requests and never answers, so only a signal can end them.
  silentServer = createServer(() => {
    // Leaves every request open.
  });
  await new Promise<void>(resolve => silentServer.listen(0, '127.0.0.1', resolve));
  const address = silentServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The silent server is not listening on a TCP port.');
  }
  silentUrl = new URL(`http://127.0.0.1:${String(address.port)}/page`);
});

afterAll(async () => {
  silentServer.closeAllConnections();
  await new Promise<void>(resolve => {
    silentServer.close(() => {
      resolve();
    });
  });
});

const options = { accept: 'text/html', headers: {} };

describe('requestUpstream', () => {
  it('fails with an UpstreamAbortedError when the caller aborts', async () => {
    const controller = new AbortController();

    const request = requestUpstream(silentUrl, {
      ...options,
      timeoutInMilliseconds: 10_000,
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toBeInstanceOf(UpstreamAbortedError);
  });

  it('treats a caller signal that timed out as aborted by the caller', async () => {
    const request = requestUpstream(silentUrl, {
      ...options,
      timeoutInMilliseconds: 10_000,
      signal: AbortSignal.timeout(20),
    });

    await expect(request).rejects.toBeInstanceOf(UpstreamAbortedError);
  });

  it('fails with a plain UpstreamError when its own timeout runs out', async () => {
    const request = requestUpstream(silentUrl, {
      ...options,
      timeoutInMilliseconds: 20,
      signal: new AbortController().signal,
    });

    await expect(request).rejects.toThrow(new UpstreamError('GET /page timed out'));
    await expect(request).rejects.not.toBeInstanceOf(UpstreamAbortedError);
  });
});
