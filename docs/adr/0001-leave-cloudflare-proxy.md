# 1. Leave the Cloudflare proxy: static hosting on Hetzner, browser calls the API directly

Status: accepted (November 2026)

## Context

Until now a Cloudflare Worker (`genialtanken`) served the Angular build as static assets and
proxied `/api/*` to the NestJS API on Render. The browser only ever talked to one origin
(`genialtanken.alexf090.workers.dev`), so the build contained no API URL, pull request previews
needed no CORS entries, and the Worker told the API the visitor's address through a shared secret
(`PROXY_SHARED_SECRET`) so that the rate limit worked per visitor.

The app now belongs to the appool.de catalog and moves to Hetzner Webhosting
(`https://genial-tanken.appool.de`), like the other projects: static files on Apache, a shared
legal notice on appool.de and the operator's own domain. Apache can serve files and redirect, but
it cannot proxy `/api` to Render. The free Render instance still has to be kept awake and the old
address still has to lead somewhere, and the Worker does both for free.

## Decision

1. **The web app is static on Hetzner.** `pnpm --filter web build` builds the Angular app and then
   writes the `.htaccess` (`apps/web/hosting/`): HTTPS, `Redirect 301 /impressum` to
   `https://appool.de/impressum`, SPA fallback to `index.html` (real files and directories
   excepted), cache rules, security headers, HSTS without `preload` and a Content Security Policy.
   `deploy-web.yml` uploads the CI artifact by SFTP and runs a smoke test.
2. **The browser calls the API directly** (CORS). The base URL comes from the build
   (`API_BASE_URL`, `environments/`): `/api` with the dev proxy and in tests, the Render origin in
   production. The service worker bypass and the wake-up request follow the base URL. The API
   answers the preflight (the `ngsw-bypass` header makes every call non-simple) and lets the
   browser cache it for a day.
3. **`WEB_ORIGIN` takes a comma-separated list** (it already did). During the move it holds the new
   and the old origin; the old one is removed afterwards.
4. **`PROXY_SHARED_SECRET` is removed** from the API, the contracts (`proxy.ts`) and the
   Worker. It never protected anything by itself: its only effect was to let the Worker name the
   client address for the rate limit. With the browser calling the API directly there is no
   proxy that could be trusted to name it, so the secret has no purpose. The API ignores the
   former `X-GenialTanken-*` headers, and a spec checks that sending them does not change the
   rate-limit key.
5. **The Worker shrinks** to the keep-awake cron and a permanent redirect (301, path and query
   kept) from every `workers.dev` URL to `https://genial-tanken.appool.de`. `/api` and `/api/*`
   answer `410 Gone` (`no-store`) instead, because clients from before the move would otherwise
   get HTML where they expect JSON; `ngsw.json` answers
   404 as well, so service workers installed from the old address unregister themselves rather
   than keep serving the old app. It serves no assets and proxies nothing, and is deployed by its
   own workflow (`deploy-worker.yml`).
6. **Pull request previews are dropped.** They depended on Worker versions with aliased URLs and
   the shared Worker secrets. Pull requests are checked by CI (unit, API and browser end-to-end
   tests, build); nothing is deployed before the merge.

## Consequences

### Security

- **Rate limit.** The API sits behind exactly one proxy hop, Render's. `trust proxy` is `1`
  (`configure-application.ts`), so `request.ip` is the address Render appended to
  `X-Forwarded-For`; entries a client adds itself come before it and are ignored. Rate limiting
  therefore keys on that address (IPv6 clients grouped by subnet by the throttler) and cannot be
  dodged by forging headers; a spec covers the forged-header case. Render states that Express
  should use `trust proxy` `1`; if Render ever adds a hop, every visitor would share one address,
  so the first deploy needs a check (see the runbook). The limit stays per route and client.
  Visitors behind one shared address (company or mobile carrier networks) share a budget, as
  before when the Worker could not name the client.
- **CORS** is an allow list of origins (`WEB_ORIGIN`), no wildcard, no credentials. It protects
  visitors' browsers from other sites reading answers on their behalf; it does not stop scripts
  and bots, which can call the public API anyway. That was already true behind the Worker (the
  Render URL is public) and is accepted: the API serves public data and is protected by the rate
  limit and its caches.
- **Content Security Policy** on the static host: `script-src` allows the own origin and the two
  inline scripts of `index.html` by SHA-256 hash (computed from the build); no `unsafe-eval`.
  `connect-src` allows the own origin and the Render origin. `img-src` allows OpenStreetMap and
  Mapbox tiles. **Exception:** `style-src` keeps `'unsafe-inline'`, because Angular adds the
  styles of its components as `<style>` elements at run time and a static host cannot send a
  nonce. Scripts stay locked down, which is what matters most.
- **Privacy.** The browser now contacts Render (USA) directly, so Render sees visitors' IP
  addresses and request parameters, where before only the Worker did. The privacy policy at
  `/datenschutz` says so and names Hetzner, Render, Photon, the map tile providers and Cloudflare,
  whose Worker still processes requests to the old `workers.dev` address.
- The Cloudflare secret `PROXY_SHARED_SECRET` and the Render variable of the same name are
  obsolete and can be deleted after the move.

### Operations and behavior

- Cold starts of the free Render instance reach the browser directly: the wake-up call and the
  cron stay, and the loading state already shows "Der Server wird gerade gestartet" after a few
  seconds.
- Favorites and settings live in `localStorage` of the old origin and are not carried over to the
  new one; users start with empty favorites on `genial-tanken.appool.de`.
- The Mapbox token must allow `https://genial-tanken.appool.de` (Mapbox has no wildcards).
- A failing browser-to-Render connection (CORS misconfiguration, Render down) shows up in the
  browser; there is no proxy that could turn it into the app's own error body any more. The
  app's error handling already treats network failures and 5xx answers.
- No previews: a change is only seen live after the merge. Local `pnpm dev` and the Playwright
  suite remain the way to try changes.
