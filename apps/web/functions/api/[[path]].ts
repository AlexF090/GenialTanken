import { proxyApiRequest } from './proxy-api-request.ts';
import type { PagesEnvironment } from './proxy-api-request.ts';

/** Subset of the Cloudflare Pages Function context this proxy uses. */
interface PagesFunctionContext {
  request: Request;
  env: PagesEnvironment;
}

/** Proxies every `/api/*` request of the web app to the API on Render. */
export const onRequest = ({ request, env }: PagesFunctionContext): Promise<Response> =>
  proxyApiRequest(request, env, apiRequest => fetch(apiRequest));
