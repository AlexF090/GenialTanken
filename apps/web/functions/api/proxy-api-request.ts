import { createApiRequest } from './create-api-request.ts';

/** Bindings configured for the Pages project (production and preview). */
export interface PagesEnvironment {
  /** Origin of the NestJS API, e.g. `https://genialtanken-api.onrender.com`. */
  API_ORIGIN?: string;
  /** Same value as the API's `PROXY_SHARED_SECRET`; enables the trusted client address header. */
  PROXY_SHARED_SECRET?: string;
  /**
   * Deprecated name of `PROXY_SHARED_SECRET`, read as a fallback for one release.
   * Remove after the Cloudflare secret is renamed.
   */
  API_PROXY_SECRET?: string;
}

export type FetchImplementation = (request: Request) => Promise<Response>;

// Duplicated from @genialtanken/contracts on purpose: the deploy bundles `functions/` without
// node_modules. proxy-api-request.spec.ts keeps both in sync.
export const UPSTREAM_UNAVAILABLE_MESSAGE = 'The fuel price service is unavailable.';

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_BAD_GATEWAY = 502;

/** Plain http is only allowed for a local API during `wrangler pages dev`. */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Same body shape as the API's own errors, so the web app handles both alike. */
const errorResponse = (statusCode: number, message: string): Response =>
  Response.json({ statusCode, message }, { status: statusCode });

const isAllowedApiOrigin = (value: string | undefined): value is string => {
  if (value === undefined || !URL.canParse(value)) {
    return false;
  }
  const { protocol, hostname } = new URL(value);
  return protocol === 'https:' || (protocol === 'http:' && LOCAL_HOSTNAMES.has(hostname));
};

const proxySecretOf = ({
  PROXY_SHARED_SECRET,
  API_PROXY_SECRET,
}: PagesEnvironment): string | undefined =>
  PROXY_SHARED_SECRET === undefined || PROXY_SHARED_SECRET === ''
    ? API_PROXY_SECRET
    : PROXY_SHARED_SECRET;

/** Forwards a web app request to the API and turns proxy failures into JSON errors. */
export const proxyApiRequest = async (
  request: Request,
  environment: PagesEnvironment,
  fetchImplementation: FetchImplementation
): Promise<Response> => {
  const apiOrigin = environment.API_ORIGIN;
  if (!isAllowedApiOrigin(apiOrigin)) {
    console.error(
      'API_ORIGIN is missing or not an https URL (http only for localhost); cannot proxy the request.'
    );
    return errorResponse(HTTP_STATUS_INTERNAL_SERVER_ERROR, 'The API proxy is not configured.');
  }
  const apiRequest = createApiRequest(request, {
    apiOrigin,
    proxySecret: proxySecretOf(environment),
  });
  try {
    return await fetchImplementation(apiRequest);
  } catch (error) {
    console.error(`Request to the API at ${apiOrigin} failed`, error);
    return errorResponse(HTTP_STATUS_BAD_GATEWAY, UPSTREAM_UNAVAILABLE_MESSAGE);
  }
};
