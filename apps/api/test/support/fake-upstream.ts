import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server, ServerResponse } from 'node:http';

interface RecordedRequest {
  url: string;
  headers: IncomingHttpHeaders;
}

export interface FakeResponse {
  status: number;
  /** Sent as is when a string, else as JSON. */
  body?: unknown;
  /** Defaults to `application/json`. */
  contentType?: string;
  delayInMilliseconds?: number;
}

const UNPROGRAMMED_RESPONSE: FakeResponse = {
  status: 501,
  body: { message: 'The fake upstream has no response programmed for this path.' },
};

/**
 * Stand-in for an upstream source, answering per path with programmed responses. Requests for
 * other paths are recorded as unexpected, so a test cannot pass by accident on an unplanned
 * answer; program a 404 explicitly where a test needs one.
 */
export class FakeUpstream {
  readonly requests: RecordedRequest[] = [];
  readonly unexpectedRequests: RecordedRequest[] = [];
  private readonly responses = new Map<string, FakeResponse>();
  private readonly pendingTimeouts = new Set<NodeJS.Timeout>();
  private readonly server: Server = createServer((request, response) => {
    this.handle(request.url ?? '/', request.headers, response);
  });
  private listeningBaseUrl: string | undefined;

  get baseUrl(): string {
    if (this.listeningBaseUrl === undefined) {
      throw new Error('The fake upstream has not been started.');
    }
    return this.listeningBaseUrl;
  }

  /** Starts listening with neither recorded requests nor programmed responses. */
  async start(): Promise<void> {
    this.requests.length = 0;
    this.unexpectedRequests.length = 0;
    this.responses.clear();
    await new Promise<void>(resolve => this.server.listen(0, '127.0.0.1', resolve));
    const address = this.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('The fake upstream server is not listening on a TCP port.');
    }
    this.listeningBaseUrl = `http://127.0.0.1:${String(address.port)}`;
  }

  requestsTo(pathname: string): RecordedRequest[] {
    return this.requests.filter(
      ({ url }) => new URL(url, 'http://fake-upstream').pathname === pathname
    );
  }

  respondTo(pathname: string, response: FakeResponse): void {
    this.responses.set(pathname, response);
  }

  /** Drops delayed answers still pending, so a slow response does not outlive its test. */
  async stop(): Promise<void> {
    this.listeningBaseUrl = undefined;
    for (const timeout of this.pendingTimeouts) {
      clearTimeout(timeout);
    }
    this.pendingTimeouts.clear();
    this.server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      this.server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private handle(url: string, headers: IncomingHttpHeaders, response: ServerResponse): void {
    this.requests.push({ url, headers });
    const { pathname } = new URL(url, 'http://fake-upstream');
    const programmedResponse = this.responses.get(pathname);
    if (programmedResponse === undefined) {
      this.unexpectedRequests.push({ url, headers });
    }
    const {
      status,
      body,
      contentType = 'application/json',
      delayInMilliseconds = 0,
    } = programmedResponse ?? UNPROGRAMMED_RESPONSE;
    const payload = typeof body === 'string' ? body : JSON.stringify(body ?? null);

    const timeout = setTimeout(() => {
      this.pendingTimeouts.delete(timeout);
      if (response.destroyed) {
        return;
      }
      response.writeHead(status, { 'Content-Type': contentType });
      response.end(payload);
    }, delayInMilliseconds);
    this.pendingTimeouts.add(timeout);
  }
}

/**
 * A fake upstream that is fresh for every test of the calling file. A test fails when the fake
 * received a request for a path it had no response for.
 */
export const useFakeUpstream = (): FakeUpstream => {
  const upstream = new FakeUpstream();
  beforeEach(async () => {
    await upstream.start();
  });
  afterEach(async () => {
    await upstream.stop();
    const unexpectedUrls = upstream.unexpectedRequests.map(({ url }) => url);
    if (unexpectedUrls.length > 0) {
      throw new Error(
        `The fake upstream received unexpected requests: ${unexpectedUrls.join(', ')}`
      );
    }
  });
  return upstream;
};

export const searchParametersOf = (recordedRequest: RecordedRequest | undefined): URLSearchParams =>
  new URL(recordedRequest?.url ?? '/', 'http://fake-upstream').searchParams;
