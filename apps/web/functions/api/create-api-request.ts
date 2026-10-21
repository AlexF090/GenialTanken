export interface ApiRequestOptions {
  /** Origin of the NestJS API, e.g. `https://genialtanken-api.onrender.com`. */
  apiOrigin: string;
  /** Shared secret that lets the API trust the client address this proxy reports. */
  proxySecret?: string;
}

const FORWARDED_FOR_HEADER = 'X-Forwarded-For';
// Duplicated from @genialtanken/contracts on purpose: the deploy bundles `functions/` without
// node_modules. create-api-request.spec.ts keeps both in sync (header names are case-insensitive).
export const CLIENT_ADDRESS_HEADER = 'X-GenialTanken-Client-Address';
export const PROXY_SECRET_HEADER = 'X-GenialTanken-Proxy-Secret';
const CONNECTING_CLIENT_ADDRESS_HEADER = 'CF-Connecting-IP';

/**
 * Builds the request the Cloudflare Pages Function forwards to the NestJS API on Render.
 * The browser only talks to the Pages origin, so no CORS setup and no build-time API URL
 * are needed, and preview deployments work without extra configuration.
 */
export const createApiRequest = (incoming: Request, options: ApiRequestOptions): Request => {
  const incomingUrl = new URL(incoming.url);
  const apiUrl = new URL(incomingUrl.pathname + incomingUrl.search, options.apiOrigin);
  const forwarded = new Request(apiUrl, incoming);

  // Clients must not be able to spoof the address the API's rate limit relies on.
  forwarded.headers.delete(FORWARDED_FOR_HEADER);
  forwarded.headers.delete(CLIENT_ADDRESS_HEADER);
  forwarded.headers.delete(PROXY_SECRET_HEADER);

  if (options.proxySecret === undefined || options.proxySecret === '') {
    return forwarded;
  }
  forwarded.headers.set(PROXY_SECRET_HEADER, options.proxySecret);
  const clientAddress = incoming.headers.get(CONNECTING_CLIENT_ADDRESS_HEADER);
  if (clientAddress !== null) {
    forwarded.headers.set(CLIENT_ADDRESS_HEADER, clientAddress);
  }
  return forwarded;
};
