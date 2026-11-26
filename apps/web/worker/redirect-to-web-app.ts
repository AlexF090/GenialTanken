/** The web app moved from this Worker to static hosting on this origin. */
export const WEB_APP_ORIGIN = 'https://genial-tanken.appool.de';

/**
 * The manifest of the Angular service worker that visitors of the old address still have
 * installed. It fetches `ngsw.json` to look for updates; a 404 makes it unregister itself and
 * delete its caches, whereas a redirect to another origin would only make the check fail and
 * keep the old app alive. Navigations are not affected: it fetches them from the network first
 * (`navigationRequestStrategy: freshness`) and passes the redirect on to the browser.
 */
const SERVICE_WORKER_MANIFEST_PATH = '/ngsw.json';

/**
 * Clients from before the move (a cached app, an old service worker) still call `/api/*` here
 * and parse JSON. A redirect would hand them the HTML of the web app, or fail on CORS; `410 Gone`
 * is an honest, uncached error instead. The web app calls the API on Render directly now.
 */
const FORMER_API_PATH = '/api';

/** Browsers and search engines may remember the move for an hour; the Worker answers cheaply. */
const REDIRECT_CACHE_CONTROL = 'public, max-age=3600';

/**
 * Sends every request to the same path and query on the new origin with a permanent redirect,
 * except the service worker manifest and the former API paths (see above).
 */
export const redirectToWebApp = (request: Request): Response => {
  const { pathname, search } = new URL(request.url);
  if (pathname === SERVICE_WORKER_MANIFEST_PATH) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if (pathname === FORMER_API_PATH || pathname.startsWith(`${FORMER_API_PATH}/`)) {
    return new Response(null, { status: 410, headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(null, {
    status: 301,
    headers: {
      Location: `${WEB_APP_ORIGIN}${pathname}${search}`,
      'Cache-Control': REDIRECT_CACHE_CONTROL,
    },
  });
};
