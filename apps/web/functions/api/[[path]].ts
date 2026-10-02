import { createApiRequest } from './create-api-request.ts';

/** Bindings configured for the Pages project (production and preview). */
interface PagesEnvironment {
  /** Origin of the NestJS API, e.g. `https://genialtanken-api.onrender.com`. */
  API_ORIGIN: string;
}

/** Subset of the Cloudflare Pages Function context this proxy uses. */
interface PagesFunctionContext {
  request: Request;
  env: PagesEnvironment;
}

/** Proxies every `/api/*` request of the web app to the API on Render. */
export const onRequest = ({ request, env }: PagesFunctionContext): Promise<Response> =>
  fetch(createApiRequest(request, env.API_ORIGIN));
