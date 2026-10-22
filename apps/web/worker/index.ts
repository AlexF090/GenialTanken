import { proxyApiRequest } from './api/proxy-api-request.ts';
import type { ApiProxyEnvironment } from './api/proxy-api-request.ts';
import { keepApiAwake } from './keep-awake/keep-api-awake.ts';

/** Subset of the Workers `Fetcher` type of the static assets binding that this Worker uses. */
export interface StaticAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

/** Bindings, variables and secrets of the Worker (see `wrangler.jsonc` and `.dev.vars`). */
export interface WorkerEnvironment extends ApiProxyEnvironment {
  /** The built Angular app from `dist/web/browser`. */
  ASSETS: StaticAssetsBinding;
}

/** Subset of the Workers `ScheduledController` that this Worker uses. */
export interface ScheduledController {
  /** When the cron trigger was due, in milliseconds since the epoch. */
  scheduledTime: number;
}

/** Subset of the Workers `ExecutionContext` that this Worker uses. */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const API_PATH = '/api';

const isApiPath = (pathname: string): boolean =>
  pathname === API_PATH || pathname.startsWith(`${API_PATH}/`);

/**
 * Proxies every `/api/*` request of the web app to the API on Render and serves everything else
 * from the static assets. `run_worker_first` in `wrangler.jsonc` routes only `/api/*` here, so
 * the assets fallback covers requests that reach the Worker anyway. The cron trigger in
 * `wrangler.jsonc` keeps the API awake during the day (`keep-awake/`).
 */
export default {
  fetch(request: Request, environment: WorkerEnvironment): Promise<Response> {
    if (isApiPath(new URL(request.url).pathname)) {
      return proxyApiRequest(request, environment, apiRequest => fetch(apiRequest));
    }
    return environment.ASSETS.fetch(request);
  },
  scheduled(
    controller: ScheduledController,
    environment: WorkerEnvironment,
    context: ExecutionContext
  ): void {
    context.waitUntil(
      keepApiAwake(environment, new Date(controller.scheduledTime), {
        fetchImplementation: request => fetch(request),
        random: Math.random,
        sleep: durationInMilliseconds =>
          new Promise(resolve => setTimeout(resolve, durationInMilliseconds)),
      })
    );
  },
};
