/** Shared secret the Cloudflare Worker sends so the API trusts its forwarded headers. */
export const PROXY_SECRET_HEADER = 'x-genialtanken-proxy-secret';

/** Address of the browser as seen by the Worker. */
export const CLIENT_ADDRESS_HEADER = 'x-genialtanken-client-address';

/** Answer when the API or its upstream fuel price sources cannot be reached. */
export const UPSTREAM_UNAVAILABLE_MESSAGE = 'The fuel price service is unavailable.';
