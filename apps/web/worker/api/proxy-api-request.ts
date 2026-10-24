import { isAllowedApiOrigin } from './api-origin.ts';
import { createApiRequest } from './create-api-request.ts';

/** Worker variables and secrets the API proxy reads (production and preview). */
export interface ApiProxyEnvironment {
  /** Origin of the NestJS API, e.g. `https://genialtanken-api.onrender.com`. */
  API_ORIGIN?: string;
  /** Same value as the API's `PROXY_SHARED_SECRET`; enables the trusted client address header. */
  PROXY_SHARED_SECRET?: string;
}

export type FetchImplementation = (request: Request) => Promise<Response>;

// Duplicated from @genialtanken/contracts on purpose: Wrangler bundles `worker/` without
// node_modules. proxy-api-request.spec.ts keeps both in sync.
export const UPSTREAM_UNAVAILABLE_MESSAGE = 'The fuel price service is unavailable.';

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_BAD_GATEWAY = 502;

/** Same body shape as the API's own errors, so the web app handles both alike. */
const errorResponse = (statusCode: number, message: string): Response =>
  Response.json({ statusCode, message }, { status: statusCode });

/** Forwards a web app request to the API and turns proxy failures into JSON errors. */
export const proxyApiRequest = async (
  request: Request,
  environment: ApiProxyEnvironment,
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
    proxySecret: environment.PROXY_SHARED_SECRET,
  });
  try {
    return await fetchImplementation(apiRequest);
  } catch (error) {
    console.error(`Request to the API at ${apiOrigin} failed`, error);
    return errorResponse(HTTP_STATUS_BAD_GATEWAY, UPSTREAM_UNAVAILABLE_MESSAGE);
  }
};
