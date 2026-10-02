/**
 * Builds the request the Cloudflare Pages Function forwards to the NestJS API on Render.
 * The browser only talks to the Pages origin, so no CORS setup and no build-time API URL
 * are needed, and preview deployments work without extra configuration.
 */
export const createApiRequest = (incoming: Request, apiOrigin: string): Request => {
  const incomingUrl = new URL(incoming.url);
  const apiUrl = new URL(incomingUrl.pathname + incomingUrl.search, apiOrigin);
  const forwarded = new Request(apiUrl, incoming);

  // Overwrite instead of append so clients cannot spoof the address the rate limit relies on
  const clientAddress = incoming.headers.get('CF-Connecting-IP');
  if (clientAddress === null) {
    forwarded.headers.delete('X-Forwarded-For');
    return forwarded;
  }
  forwarded.headers.set('X-Forwarded-For', clientAddress);
  return forwarded;
};
