import { createApiRequest } from './create-api-request.ts';

/** Bindings configured for the Pages project (production and preview). */
export interface PagesEnvironment {
  /** Origin of the NestJS API, e.g. `https://genialtanken-api.onrender.com`. */
  API_ORIGIN?: string;
  /** Shared with the API; enables the trusted client address header for its rate limit. */
  API_PROXY_SECRET?: string;
}

export type FetchImplementation = (request: Request) => Promise<Response>;

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_BAD_GATEWAY = 502;

/** Same body shape as the API's own errors, so the web app handles both alike. */
const errorResponse = (statusCode: number, message: string): Response =>
  Response.json({ statusCode, message }, { status: statusCode });

const isHttpOrigin = (value: string | undefined): value is string => {
  if (value === undefined || !URL.canParse(value)) {
    return false;
  }
  const { protocol } = new URL(value);
  return protocol === 'https:' || protocol === 'http:';
};

/** Forwards a web app request to the API and turns proxy failures into JSON errors. */
export const proxyApiRequest = async (
  request: Request,
  environment: PagesEnvironment,
  fetchImplementation: FetchImplementation
): Promise<Response> => {
  const apiOrigin = environment.API_ORIGIN;
  if (!isHttpOrigin(apiOrigin)) {
    console.error('API_ORIGIN is missing or not an http(s) URL; cannot proxy the request.');
    return errorResponse(HTTP_STATUS_INTERNAL_SERVER_ERROR, 'The API proxy is not configured.');
  }
  const apiRequest = createApiRequest(request, {
    apiOrigin,
    proxySecret: environment.API_PROXY_SECRET,
  });
  try {
    return await fetchImplementation(apiRequest);
  } catch (error) {
    console.error(`Request to the API at ${apiOrigin} failed`, error);
    return errorResponse(HTTP_STATUS_BAD_GATEWAY, 'The fuel price service is unavailable.');
  }
};
