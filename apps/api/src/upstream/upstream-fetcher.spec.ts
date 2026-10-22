import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { createCache } from 'cache-manager';
import { z } from 'zod';
import { ApplicationConfiguration } from '../configuration/application-configuration.js';
import { parseEnvironment } from '../configuration/environment.js';
import { UpstreamError } from './upstream-error.js';
import { UpstreamFetcher } from './upstream-fetcher.js';

let server: Server;
let baseUrl: string;
let requestedPaths: string[];

beforeAll(async () => {
  server = createServer((request, response) => {
    requestedPaths.push(request.url ?? '/');
    if (request.url === '/missing') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"answer":42}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The test server is not listening on a TCP port.');
  }
  baseUrl = `http://127.0.0.1:${String(address.port)}`;
});

beforeEach(() => {
  requestedPaths = [];
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => {
    server.close(() => {
      resolve();
    });
  });
});

const answerSchema = z.object({ answer: z.number() });

const createFetcher = () =>
  new UpstreamFetcher(new ApplicationConfiguration(parseEnvironment({})), createCache());

describe('UpstreamFetcher', () => {
  it('serves a repeated JSON request from the cache', async () => {
    const fetcher = createFetcher();
    const url = new URL(`${baseUrl}/answer`);

    await fetcher.fetchJson({ url, schema: answerSchema });
    const answer = await fetcher.fetchJson({ url, schema: answerSchema });

    expect(answer).toEqual({ answer: 42 });
    expect(requestedPaths).toEqual(['/answer']);
  });

  it('caches the text and the JSON answer of the same URL apart', async () => {
    const fetcher = createFetcher();
    const url = new URL(`${baseUrl}/answer`);

    const text = await fetcher.fetchText({ url });
    const json = await fetcher.fetchJson({ url, schema: answerSchema });

    expect(text).toBe('{"answer":42}');
    expect(json).toEqual({ answer: 42 });
    expect(requestedPaths).toEqual(['/answer', '/answer']);
  });

  it('treats a missing JSON resource as a failure', async () => {
    const request = createFetcher().fetchJson({
      url: new URL(`${baseUrl}/missing`),
      schema: answerSchema,
    });

    await expect(request).rejects.toThrow(
      new UpstreamError('GET /missing responded with status 404')
    );
  });

  it('answers a missing text resource with undefined', async () => {
    await expect(
      createFetcher().fetchText({ url: new URL(`${baseUrl}/missing`) })
    ).resolves.toBeUndefined();
  });

  it('fails for a JSON answer that does not match the schema', async () => {
    const request = createFetcher().fetchJson({
      url: new URL(`${baseUrl}/answer`),
      schema: z.object({ answer: z.string() }),
    });

    await expect(request).rejects.toThrow(/^GET \/answer returned an unexpected payload/);
  });
});
