import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server, ServerResponse } from 'node:http';

export interface RecordedRequest {
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

const NOT_FOUND_RESPONSE: FakeResponse = { status: 404, body: { message: 'Not Found' } };

/** Stand-in for an upstream source, answering per path with programmed responses. */
export class FakeUpstream {
  readonly requests: RecordedRequest[] = [];
  private readonly responses = new Map<string, FakeResponse>();
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
    this.responses.clear();
    await new Promise<void>(resolve => this.server.listen(0, '127.0.0.1', resolve));
    const address = this.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('The fake upstream server is not listening on a TCP port.');
    }
    this.listeningBaseUrl = `http://127.0.0.1:${String(address.port)}`;
  }

  respondTo(pathname: string, response: FakeResponse): void {
    this.responses.set(pathname, response);
  }

  async stop(): Promise<void> {
    this.listeningBaseUrl = undefined;
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
    const {
      status,
      body,
      contentType = 'application/json',
      delayInMilliseconds = 0,
    } = this.responses.get(pathname) ?? NOT_FOUND_RESPONSE;
    const payload = typeof body === 'string' ? body : JSON.stringify(body ?? null);

    setTimeout(() => {
      if (response.destroyed) {
        return;
      }
      response.writeHead(status, { 'Content-Type': contentType });
      response.end(payload);
    }, delayInMilliseconds);
  }
}

/** A fake upstream that is fresh for every test of the calling file. */
export const useFakeUpstream = (): FakeUpstream => {
  const upstream = new FakeUpstream();
  beforeEach(async () => {
    await upstream.start();
  });
  afterEach(async () => {
    await upstream.stop();
  });
  return upstream;
};

export const searchParametersOf = (recordedRequest: RecordedRequest | undefined): URLSearchParams =>
  new URL(recordedRequest?.url ?? '/', 'http://fake-upstream').searchParams;
