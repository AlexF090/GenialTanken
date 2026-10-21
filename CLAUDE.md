# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GenialTanken shows current fuel prices of nearby gas stations as a list and on a map. Version 2 is an Angular + NestJS rebuild of an older React app. `README.md` covers setup, environment variables and deployment; `ROADMAP.md` (German) records architecture decisions and planned phases (Postgres/Prisma persistence, then auth). Hosting must stay on free tiers — ask before introducing anything paid.

## Commands

Node 24 (`.nvmrc`), pnpm 12.8.1 (pinned via `devEngines`). Run from the repository root.

```bash
pnpm install                 # also builds packages/contracts and installs the lefthook Git hooks (`prepare` scripts)
pnpm dev                     # web (http://localhost:4200) + API (http://localhost:3000) in watch mode
pnpm build                   # contracts, API, web
pnpm preview:web             # build web, serve it with the Worker via wrangler dev (needs apps/web/.dev.vars)
pnpm deploy:web              # build web, wrangler deploy to Cloudflare Workers (manual; CI normally deploys)
pnpm test                    # unit tests of all workspaces
pnpm --filter api test:e2e   # API end-to-end tests (Supertest against fake upstreams)
pnpm test:e2e                # Playwright; starts mock upstream, API and web itself
pnpm lint                    # ESLint for the whole repository
pnpm typecheck               # tsc in every workspace
pnpm format:check            # Prettier (format:write to fix)
```

Single tests:

```bash
pnpm --filter api exec vitest run src/fuel-price-providers/distance-in-meters.spec.ts
pnpm --filter api exec vitest run --config vitest.config.e2e.ts test/stations.e2e-spec.ts
pnpm --filter @genialtanken/contracts exec vitest run src/station.spec.ts
pnpm --filter web exec ng test --watch=false --include src/app/pages/settings-page/settings-page.spec.ts
pnpm --filter web test:worker             # Cloudflare Worker tests (plain Vitest)
pnpm --filter e2e exec playwright test tests/explore.spec.ts
```

CI (`.github/workflows/ci.yml`) runs format, lint, typecheck, unit, API e2e, build, Docker image build, Playwright and `pnpm audit --prod`. It skips draft pull requests (every job has a draft condition; `ready_for_review` triggers it), so open pull requests as drafts and mark them ready when final. `deploy-web.yml` (triggered by `workflow_run`, never runs code from the pull request) deploys only when the CI run produced the `web-dist` artifact (`dist/web/browser` plus `worker/` sources): `wrangler deploy` for `main`, `wrangler versions upload --preview-alias pr-<number>` for pull requests (`https://pr-<number>-genialtanken.alexf090.workers.dev`). It takes `apps/web/wrangler.jsonc` only from the default branch and rejects a `build` section, so keep the file free of build commands. Only builds of `main` embed the Mapbox token (it is restricted to the production URL); previews use OpenStreetMap tiles.

Git hooks (`lefthook.yml`, installed by the root `prepare: lefthook install`): pre-commit runs `prettier --check` and ESLint on the staged files, pre-push runs `pnpm typecheck` and `pnpm test`. Skip them with `LEFTHOOK=0`. The hooks are installed for the Linux binary inside the dev container, so committing from the macOS host on the same checkout may fail; run `pnpm install` on the host or use `LEFTHOOK=0`.

## Architecture

pnpm workspaces with the official Angular and Nest CLIs — deliberately no Nx (see ROADMAP).

- `packages/contracts` (`@genialtanken/contracts`) — zod 4 schemas and inferred types shared by web and API (`Station`, `StationsQuery`, `apiErrorSchema`, …). Consumers import the compiled `dist/`, so **rebuild after changing it** (`pnpm --filter @genialtanken/contracts build`) before API/web see the change.
- `apps/api` — NestJS 12 backend-for-frontend, ESM. The browser never calls upstream sources directly.
- `apps/web` — Angular 22, standalone, zoneless, signals, `httpResource`, Signal Forms, Leaflet.
- `apps/web/worker` — Cloudflare Worker `genialtanken` with static assets (`apps/web/wrangler.jsonc`): it serves the Angular build as a single-page application and runs first only for `/api/*` (`run_worker_first`), which it proxies to the API in production. Entry `worker/index.ts`, proxy modules in `worker/api/`. It reads `PROXY_SHARED_SECRET` and accepts only https API origins, except `localhost`, `127.0.0.1` and `[::1]`. Header names and the unavailable message are duplicated from contracts on purpose (the deploy bundles `worker/` without `node_modules`); specs keep them in sync.
- `e2e` — Playwright against real web + API with a local stand-in for the French open data API and Photon (`e2e/mock-upstream.ts`, recorded data in `e2e/data`; Photon answers keyed by normalized query in `photon-places.json`). It uses its own ports (API 3100, web 4300 with `e2e/web-proxy.conf.json`, mock upstream 4110), so a running dev server on 3000/4200 is never reused. Any unmocked outgoing request fails the run; a `globalTeardown` checks the mock upstream for unexpected requests. Project `chromium` (desktop) runs every spec except `bottom-sheet.spec.ts`; the `mobile` project (Pixel 7) runs `bottom-sheet.spec.ts` and `accessibility.spec.ts`.

ESLint forbids `apps/web` and `apps/api` from importing each other; shared code goes into contracts.

### API request flow

1. `StationsController` validates query/params with Nest's built-in Standard Schema validation using the zod schemas from contracts (no `nestjs-zod`).
2. `StationsService` fans out to all enabled `FuelPriceProvider`s (`FUEL_PRICE_PROVIDERS` injection token) with `Promise.allSettled`. Partial results are fine; only when every provider fails does it throw `BadGatewayException`. It computes exact distances, filters by radius and fuel, sorts and caps at 100.
3. `GET /api/stations/by-identifiers?identifiers=<comma-separated, 1–50 after removing duplicates>` (`stationLookupQuerySchema` in contracts `station-lookup.ts`) is declared before `:id`, because `by-identifiers` also matches the identifier pattern. `findStationsByIdentifiers` looks each identifier up with its provider and answers `{ stations, unavailableIdentifiers, failedIdentifiers }`; only when every lookup fails does it throw `BadGatewayException`. The web favorites use it (`StationsApi.loadStationsByIdentifiers`, chunks of 50).
4. Providers live in `src/fuel-price-providers/<country>/`: a provider class, a zod schema for the upstream payload, and a pure `to-station-from-<country>.ts` mapper (unit-tested). Upstream HTTP goes through `UpstreamJsonFetcher` (see below). Providers return `distanceInMeters: null`; the service fills it in. Station IDs are country-prefixed (`fr-…`, see `station-identifier.ts`) so detail lookups route to the right provider; a prefix without provider (e.g. old `de-…` favorites) is answered as unknown.
5. French open data has no station names or brands. `FranceFuelPriceProvider` takes them from the price service's station pages (`FRANCE_STATION_DETAILS_BASE_URL` + `/map/recuperer_infos_pdv/<id>`, HTML parsed by the pure `parse-french-station-identity.ts`) through `UpstreamTextFetcher`, at most 8 at once (`mapWithConcurrency`), cached a week. One search waits for its pages at most `FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS` in total (default 3000, one abort signal per search). Missing or failed pages are cached as missing for 10 minutes; pages cut off by the budget are not. A missing page only leaves the name missing; the web app then titles the station by its street.
6. France is the only country for now and always enabled (registered in `fuel-price-providers.module.ts`; decision in ROADMAP). The API accepts radii up to 30 km (`MAXIMUM_RADIUS_IN_KILOMETERS` in contracts). A new country = new provider + register it there + add its code to `COUNTRY_CODES` in contracts.
7. Place search (`src/places/`): `GET /api/places` validates with `placesQuerySchema`; `PlacesService` asks Photon (komoot, `PHOTON_BASE_URL`) with the normalized query (trim, collapse whitespace, lowercase), twice the limit and a metropolitan France bounding box (including Corsica), maps features with the pure `photon/to-place-from-photon.ts` (drops other countries), dedupes by id and cuts to the limit. Answers are cached `PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS` (default one day); upstream failures become `502` with `ERROR_MESSAGES.placeSearchUnavailable`.

Cross-cutting API pieces:

- Environment is validated once at startup by a zod schema (`src/configuration/environment.ts`) and exposed via the injectable `ApplicationConfiguration`, which converts durations to milliseconds (the environment stays in seconds); invalid values abort startup. The API does not read `.env` files.
- `src/upstream/` (`UpstreamModule`) provides `UpstreamJsonFetcher` (and `UpstreamTextFetcher` for HTML) for every external data source: timeout, zod validation, cache per URL (optional per-request `cacheTimeToLiveInMilliseconds`), optional abort `signal` from the caller, failures thrown as `UpstreamError` (`FuelPriceProviderError` extends it; a caller abort becomes `UpstreamAbortedError`, which says nothing about the source and must not be cached as a failure). Callers turn `UpstreamError` into `502`.
- The cache is a bounded in-memory LRU (`@cacheable/memory`, `CACHE_MAXIMUM_ENTRIES`, default 5000), set up in `app.module.ts`.
- All client-facing error messages live in `src/common/error-messages.ts`; `api-error.filter.ts` shapes every error body to `apiErrorSchema`.
- `configure-application.ts` holds HTTP setup (prefix `api`, `/health` excluded, CORS, Swagger at `/api/docs`) and is shared by `main.ts` and the e2e tests (`test/support/create-test-application.ts`), so keep setup there, not in `main.ts`.
- Rate limiting: `ClientAddressThrottlerGuard` trusts the forwarded client address only when the request carries the shared secret (`PROXY_SHARED_SECRET`) set by the Worker (`resolve-client-address.ts`); `trust proxy` is limited to one hop on purpose. Header names and the unavailable message are shared in contracts (`proxy.ts`).
- Nest DI needs runtime class references, so `consistent-type-imports` is off for `apps/api`. Relative imports in the API use the `.js` extension (ESM).

### Web structure

- `src/app/core/` — framework-light state and services: signal stores (`NearbyStationsStore`, `SettingsStore`, `FavoritesStore`), `StationsApi` (validates every response with the contracts schemas through `parseResponse` in `core/http/`, which throws `UnexpectedResponseError` on contract violations), geolocation, browser storage. Log through the injectable `Logger` (`core/logging/logger.ts`), never `console`; only the bootstrap in `main.ts` uses `console.error`.
- `src/app/pages/` — routed container components that inject stores.
- `src/app/ui/` — presentational components (inputs/outputs only). Reusable controls: `SelectMenu` (iOS-style pull-down menu for single-choice options; top layer via Popover API where available, its own dismissal logic so it behaves the same in jsdom) and `PlaceSearchField` (ARIA 1.2 combobox with a `placeSearchAccessory` slot).
- Explore page UX follows Apple Maps: a floating search field (place search through `PlacesApi` in `injectPlaceSearch()` from `pages/explore-page/place-search.ts`, debounced with Angular's `debounced()`, radius menu inside it), a round locate button, the fuel menu in the sheet header, and "In diesem Bereich suchen" once the user drags the map away from the search center (`StationsMap.visibleCenterChanged` → `shouldOfferAreaSearch` → `SearchCenterStore.useMapArea`, source `map-area`). A chosen price tag is always centered in the part of the map not covered by overlays (`centerForVisibleArea` in `ui/map/map-viewport.ts`, which holds the map geometry), also while the sheet moves. Choosing a list row does the same (`StationList` with `selectsOnMap`: the row selects, an ⓘ link opens the details; elsewhere the title links to the details). A station has no page of its own: `stations/:id` is a child route of the explore page, and `StationDetailPage` renders as a card in the sheet (side panel from 48rem) instead of the list, like a place card in Apple Maps. The list stays mounted but hidden, the card's station is selected on the map (`ExplorePage.openedStationIdentifier` from the URL; `OpenedStationStore` shares the loaded station so a station outside the results moves the search there, source `station`). ✕ or Escape navigate to `/`; the list then has the station selected and focused (through `BottomSheet.scrollPosition`/`restoreScrollPosition` and `StationList.focusStation`, not DOM queries). Favorites link to the same card. Every list row and the station card offer a route (`RouteButton`: a native `<select>` over the icon, so phones show their system picker; universal links of Apple Karten, Google Maps and Waze from `core/navigation-apps/`, opened via `OPEN_EXTERNAL_URL`). Price tags are tinted by `priceLevelOf` (thirds of the shown price range); the cheapest stays solid green.
- Favorites persist through the abstract `FavoritesRepository` (localStorage implementation today; ROADMAP phase 2 swaps in an API-backed one).
- The app always calls same-origin `/api` (dev: `proxy.conf.json`; production: Worker), so no API URL is baked into the build.
- Styling uses design tokens in `src/styles/tokens.scss`, modeled on Apple's Human Interface Guidelines (system font, iOS system colors with recorded contrast ratios, translucent materials). Keep the `theme-color` metas in `index.html` and the manifest colors in sync with `--color-chrome`/`--color-canvas`.
- Component selectors use the `app` prefix; templates are linted with angular-eslint accessibility rules. Shared test helpers (fake geolocation/storage, station fixtures, `render-page.ts`) are in `src/testing/`.
- `NG_APP_MAPBOX_ACCESS_TOKEN` is injected at build time via `--define`; without it the map falls back to OpenStreetMap tiles (which e2e relies on).

## Conventions

- TypeScript strict everywhere; `interface` for object shapes (lint-enforced), `import type` for type-only imports (except in the API, see above).
- Identifiers and comments use full words, no abbreviations (`configuration`, `identifier`, `InMilliseconds`).
- Prettier: single quotes, `printWidth` 100, `arrowParens: avoid`, `trailingComma: es5`.
- Dependencies are pinned exactly (`saveExact`), and `minimumReleaseAge` blocks releases younger than one day.
- Commits and pushes run the lefthook hooks (see Commands); `LEFTHOOK=0` skips them.
- Deployment and release steps: `docs/deployment.md`.
