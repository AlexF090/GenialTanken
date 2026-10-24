import type { HttpInterceptorFn } from '@angular/common/http';

/** The Angular service worker passes requests with this header straight to the network. */
const SERVICE_WORKER_BYPASS_HEADER = 'ngsw-bypass';

/**
 * Prices must never come from a cache, and the service worker caches no API answers anyway. It
 * would still answer a failed API request offline with its own 504, which looks like a broken
 * upstream; bypassing it keeps the browser's status 0, which the app explains as being offline.
 */
export const bypassServiceWorkerForApi: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { [SERVICE_WORKER_BYPASS_HEADER]: 'true' } }));
};
