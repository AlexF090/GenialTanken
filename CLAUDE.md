# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GenialTanken shows current fuel prices of nearby gas stations as a list and on a map. Version 2 is an Angular + NestJS rebuild of an older React app. `README.md` covers setup, environment variables and deployment; `ROADMAP.md` (German) records architecture decisions and planned phases (Postgres/Prisma persistence, then auth). Hosting must stay on free tiers — ask before introducing anything paid.

## Commands

Node 24 (`.nvmrc`), pnpm 12.8.1 (pinned via `devEngines`). Run from the repository root.

```bash
pnpm install                 # also builds packages/contracts via its `prepare` script
pnpm dev                     # web (http://localhost:4200) + API (http://localhost:3000) in watch mode
pnpm build                   # contracts, API, web
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
pnpm --filter web test:functions          # Cloudflare Pages Function tests (plain Vitest)
pnpm --filter e2e exec playwright test tests/explore.spec.ts
```

CI (`.github/workflows/ci.yml`) runs format, lint, typecheck, unit, API e2e, build, Docker image build, Playwright and `pnpm audit --prod`.

## Architecture

pnpm workspaces with the official Angular and Nest CLIs — deliberately no Nx (see ROADMAP).

- `packages/contracts` (`@genialtanken/contracts`) — zod 4 schemas and inferred types shared by web and API (`Station`, `StationsQuery`, `apiErrorSchema`, …). Consumers import the compiled `dist/`, so **rebuild after changing it** (`pnpm --filter @genialtanken/contracts build`) before API/web see the change.
- `apps/api` — NestJS 12 backend-for-frontend, ESM. The browser never calls upstream sources directly.
- `apps/web` — Angular 22, standalone, zoneless, signals, `httpResource`, Signal Forms, Leaflet.
- `apps/web/functions` — Cloudflare Pages Function proxying `/api/*` to the API in production.
- `e2e` — Playwright against real web + API with a local stand-in for the French open data API and Photon (`e2e/mock-upstream.ts`, recorded data in `e2e/data`; Photon answers keyed by normalized query in `photon-places.json`). Any unmocked outgoing request fails the test. Project `chromium` (desktop) runs every spec except `bottom-sheet.spec.ts`; the `mobile` project (Pixel 7) runs `bottom-sheet.spec.ts` and `accessibility.spec.ts`.

ESLint forbids `apps/web` and `apps/api` from importing each other; shared code goes into contracts.

### API request flow

1. `StationsController` validates query/params with Nest's built-in Standard Schema validation using the zod schemas from contracts (no `nestjs-zod`).
2. `StationsService` fans out to all enabled `FuelPriceProvider`s (`FUEL_PRICE_PROVIDERS` injection token) with `Promise.allSettled`. Partial results are fine; only when every provider fails does it throw `BadGatewayException`. It computes exact distances, filters by radius and fuel, sorts and caps at 100.
3. Providers live in `src/fuel-price-providers/<country>/`: a provider class, a zod schema for the upstream payload, and a pure `to-station-from-<country>.ts` mapper (unit-tested). Upstream HTTP goes through `UpstreamJsonFetcher` (see below). Providers return `distanceInMeters: null`; the service fills it in. Station IDs are country-prefixed (`fr-…`, `de-…`, see `station-identifier.ts`) so detail lookups route to the right provider.
4. French open data has no station names or brands. `FranceFuelPriceProvider` takes them from the price service's station pages (`FRANCE_STATION_DETAILS_BASE_URL` + `/map/recuperer_infos_pdv/<id>`, HTML parsed by the pure `parse-french-station-identity.ts`) through `UpstreamTextFetcher`, at most 8 at once (`mapWithConcurrency`), cached a week. A failed page only leaves the name missing; the web app then titles the station by its street.
5. France is always enabled; Germany only when `TANKENTANKEN_API_KEY` is set (factory in `fuel-price-providers.module.ts`). A new country = new provider + register it there + add its code to `COUNTRY_CODES` in contracts.
6. Place search (`src/places/`): `GET /api/places` validates with `placesQuerySchema`; `PlacesService` asks Photon (komoot, `PHOTON_BASE_URL`) with the normalized query (trim, collapse whitespace, lowercase), twice the limit and a France/Germany bounding box, maps features with the pure `photon/to-place-from-photon.ts` (drops other countries), dedupes by id and cuts to the limit. Answers are cached `PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS` (default one day); upstream failures become `502` with `ERROR_MESSAGES.placeSearchUnavailable`.

Cross-cutting API pieces:

- Environment is validated once at startup by a zod schema (`src/configuration/environment.ts`) and exposed via the injectable `ApplicationConfiguration`; invalid values abort startup. The API does not read `.env` files.
- `src/upstream/` (`UpstreamModule`) provides `UpstreamJsonFetcher` (and `UpstreamTextFetcher` for HTML) for every external data source: timeout, zod validation, cache per URL (optional per-request `cacheTimeToLiveInMilliseconds`), failures thrown as `UpstreamError` (`FuelPriceProviderError` extends it). Callers turn `UpstreamError` into `502`.
- All client-facing error messages live in `src/common/error-messages.ts`; `api-error.filter.ts` shapes every error body to `apiErrorSchema`.
- `configure-application.ts` holds HTTP setup (prefix `api`, `/health` excluded, CORS, Swagger at `/api/docs`) and is shared by `main.ts` and the e2e tests (`test/support/create-test-application.ts`), so keep setup there, not in `main.ts`.
- Rate limiting: `ClientAddressThrottlerGuard` trusts the forwarded client address only when the request carries the shared secret (`PROXY_SHARED_SECRET`) set by the Pages Function (`resolve-client-address.ts`); `trust proxy` is limited to one hop on purpose.
- Nest DI needs runtime class references, so `consistent-type-imports` is off for `apps/api`. Relative imports in the API use the `.js` extension (ESM).

### Web structure

- `src/app/core/` — framework-light state and services: signal stores (`NearbyStationsStore`, `SettingsStore`, `FavoritesStore`), `StationsApi` (validates every response with the contracts schemas and throws `UnexpectedResponseError` on contract violations), geolocation, browser storage.
- `src/app/pages/` — routed container components that inject stores.
- `src/app/ui/` — presentational components (inputs/outputs only). Reusable controls: `SelectMenu` (iOS-style pull-down menu for single-choice options; top layer via Popover API where available, its own dismissal logic so it behaves the same in jsdom) and `PlaceSearchField` (ARIA 1.2 combobox with a `placeSearchAccessory` slot).
- Explore page UX follows Apple Maps: a floating search field (place search through `PlacesApi`, debounced with Angular's `debounced()`, radius menu inside it), a round locate button, the fuel menu in the sheet header, and "In diesem Bereich suchen" once the user drags the map away from the search center (`StationsMap.visibleCenterChanged` → `shouldOfferAreaSearch` → `SearchCenterStore.useMapArea`, source `map-area`). A chosen price tag is always centered in the part of the map not covered by overlays (`centerForVisibleArea`), also while the sheet moves. Choosing a list row does the same (`StationList` with `selectsOnMap`: the row selects, an ⓘ link opens the details; elsewhere the title links to the details). A station has no page of its own: `stations/:id` is a child route of the explore page, and `StationDetailPage` renders as a card in the sheet (side panel from 48rem) instead of the list, like a place card in Apple Maps. The list stays mounted but hidden, the card's station is selected on the map (`ExplorePage.openedStationId` from the URL; `OpenedStationStore` shares the loaded station so a station outside the results moves the search there, source `station`). ✕ or Escape navigate to `/`; the list then has the station selected and focused. Favorites link to the same card. Every list row and the station card offer a route (`RouteButton`: a native `<select>` over the icon, so phones show their system picker; universal links of Apple Karten, Google Maps and Waze from `core/navigation-apps/`, opened via `OPEN_EXTERNAL_URL`). Price tags are tinted by `priceLevelOf` (thirds of the shown price range); the cheapest stays solid green.
- Favorites persist through the abstract `FavoritesRepository` (localStorage implementation today; ROADMAP phase 2 swaps in an API-backed one).
- The app always calls same-origin `/api` (dev: `proxy.conf.json`; production: Pages Function), so no API URL is baked into the build.
- Styling uses design tokens in `src/styles/tokens.scss`, modeled on Apple's Human Interface Guidelines (system font, iOS system colors with recorded contrast ratios, translucent materials). Keep the `theme-color` metas in `index.html` and the manifest colors in sync with `--color-chrome`/`--color-canvas`.
- Component selectors use the `app` prefix; templates are linted with angular-eslint accessibility rules. Shared test helpers (fake geolocation/storage, station fixtures, `render-page.ts`) are in `src/testing/`.
- `NG_APP_MAPBOX_ACCESS_TOKEN` is injected at build time via `--define`; without it the map falls back to OpenStreetMap tiles (which e2e relies on).

## Conventions

- TypeScript strict everywhere; `interface` for object shapes (lint-enforced), `import type` for type-only imports (except in the API, see above).
- Identifiers and comments use full words, no abbreviations (`configuration`, `identifier`, `InMilliseconds`).
- Prettier: single quotes, `printWidth` 100, `arrowParens: avoid`, `trailingComma: es5`.
- Dependencies are pinned exactly (`saveExact`), and `minimumReleaseAge` blocks releases younger than one day.
- Deployment and release steps: `docs/deployment.md`.
