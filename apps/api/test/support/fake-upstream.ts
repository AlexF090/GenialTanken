import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server, ServerResponse } from 'node:http';

export interface RecordedRequest {
  url: string;
  headers: IncomingHttpHeaders;
}

export interface FakeResponse {
  status: number;
  body?: unknown;
  delayInMilliseconds?: number;
}

const NOT_FOUND_RESPONSE: FakeResponse = { status: 404, body: { message: 'Not Found' } };

/** Stand-in for the tankentanken API, answering per path with programmed responses. */
export class FakeUpstream {
  readonly requests: RecordedRequest[] = [];
  private readonly responses = new Map<string, FakeResponse>();

  private constructor(
    private readonly server: Server,
    readonly baseUrl: string
  ) {}

  static async start(): Promise<FakeUpstream> {
    let fakeUpstream: FakeUpstream | undefined = undefined;
    const server = createServer((request, response) => {
      fakeUpstream?.handle(request.url ?? '/', request.headers, response);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('The fake upstream server is not listening on a TCP port.');
    }
    const startedUpstream = new FakeUpstream(server, `http://127.0.0.1:${String(address.port)}`);
    fakeUpstream = startedUpstream;
    return startedUpstream;
  }

  respondTo(pathname: string, response: FakeResponse): void {
    this.responses.set(pathname, response);
  }

  async stop(): Promise<void> {
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
      delayInMilliseconds = 0,
    } = this.responses.get(pathname) ?? NOT_FOUND_RESPONSE;
    const payload = typeof body === 'string' ? body : JSON.stringify(body ?? null);

    setTimeout(() => {
      if (response.destroyed) {
        return;
      }
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(payload);
    }, delayInMilliseconds);
  }
}
