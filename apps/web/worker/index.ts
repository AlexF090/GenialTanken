import { keepApiAwake } from './keep-awake/keep-api-awake.ts';
import type { KeepAwakeEnvironment } from './keep-awake/keep-api-awake.ts';
import { redirectToWebApp } from './redirect-to-web-app.ts';

/** Variables of the Worker (see `wrangler.jsonc` and `.dev.vars`). */
export type WorkerEnvironment = KeepAwakeEnvironment;

/** Subset of the Workers `ScheduledController` that this Worker uses. */
export interface ScheduledController {
  /** When the cron trigger was due, in milliseconds since the epoch. */
  scheduledTime: number;
}

/** Subset of the Workers `ExecutionContext` that this Worker uses. */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * The web app is no longer served from here (it runs on static hosting, see
 * docs/adr/0001-leave-cloudflare-proxy.md). The Worker keeps two jobs: it redirects every
 * request of the old `workers.dev` address to the new origin, and the cron trigger in
 * `wrangler.jsonc` keeps the free API on Render awake during the day (`keep-awake/`).
 */
export default {
  fetch(request: Request): Promise<Response> {
    return Promise.resolve(redirectToWebApp(request));
  },
  // The awake hours are checked at the time of the call, so `scheduledTime` is not needed.
  scheduled(
    _controller: ScheduledController,
    environment: WorkerEnvironment,
    context: ExecutionContext
  ): void {
    context.waitUntil(
      keepApiAwake(environment, {
        fetchImplementation: request => fetch(request),
        now: () => new Date(),
        random: Math.random,
        sleep: durationInMilliseconds =>
          new Promise(resolve => setTimeout(resolve, durationInMilliseconds)),
      })
    );
  },
};
