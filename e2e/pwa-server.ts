import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, request as forwardRequest } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

/**
 * Serves a production build of the web app (with the service worker) like the Cloudflare Worker
 * does: static files, `index.html` for every other path (single-page application) and `/api/*`
 * forwarded to the e2e API. Only for the Playwright project `pwa`; `ng serve` builds without a
 * service worker.
 *
 * Everything is sent with `Cache-Control: no-cache`, so the browser's HTTP cache never hides
 * what the service worker serves.
 */

const PORT = Number(process.env.E2E_PWA_PORT ?? 4400);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3100);
const ROOT_DIRECTORY = process.env.E2E_PWA_ROOT ?? 'apps/web/dist/e2e-pwa/browser';

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

const isApiPath = (path: string): boolean => path === '/api' || path.startsWith('/api/');

const forwardToApi = (incoming: IncomingMessage, outgoing: ServerResponse): void => {
  const upstream = forwardRequest(
    {
      host: 'localhost',
      port: API_PORT,
      path: incoming.url,
      method: incoming.method,
      headers: incoming.headers,
    },
    response => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    }
  );
  upstream.on('error', error => {
    console.error(`API request ${incoming.url ?? ''} failed`, error);
    outgoing.writeHead(502).end();
  });
  incoming.pipe(upstream);
};

/** The file below the root for a request path, or `undefined` if there is none. */
const findFile = async (path: string): Promise<string | undefined> => {
  const filePath = normalize(join(ROOT_DIRECTORY, decodeURIComponent(path)));
  if (!filePath.startsWith(normalize(ROOT_DIRECTORY) + sep)) {
    return undefined;
  }
  try {
    return (await stat(filePath)).isFile() ? filePath : undefined;
  } catch {
    return undefined;
  }
};

const serveStatic = async (path: string, outgoing: ServerResponse): Promise<void> => {
  const filePath =
    (await findFile(path)) ??
    // Like `not_found_handling: single-page-application`: files that do not exist are 404.
    (extname(path) === '' ? await findFile('/index.html') : undefined);
  if (filePath === undefined) {
    outgoing.writeHead(404).end();
    return;
  }
  outgoing.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
  });
  createReadStream(filePath).pipe(outgoing);
};

createServer((incoming, outgoing) => {
  const path = new URL(incoming.url ?? '/', 'http://localhost').pathname;
  if (isApiPath(path)) {
    forwardToApi(incoming, outgoing);
    return;
  }
  serveStatic(path, outgoing).catch((error: unknown) => {
    console.error(`Serving ${path} failed`, error);
    outgoing.writeHead(500).end();
  });
}).listen(PORT, () => {
  console.log(`PWA server on http://localhost:${String(PORT)}, files from ${ROOT_DIRECTORY}`);
});
