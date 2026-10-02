# GenialTanken

Find the cheapest fuel nearby: current prices of the gas stations around you as a list or on a map, filtered by fuel type and radius.

GenialTanken started as a React capstone project and is being rebuilt as a full-stack showcase with Angular and NestJS. See [ROADMAP.md](ROADMAP.md) for decisions and next steps.

## Architecture

```
apps/web            Angular 22 single-page app (standalone, zoneless, signals)
apps/web/functions  Cloudflare Pages Function proxying /api to the API
apps/api            NestJS 12 backend-for-frontend (BFF)
packages/contracts  zod schemas and types shared by web and API (@genialtanken/contracts)
e2e                 Playwright browser tests against web + API + mocked upstream
```

The browser only talks to the BFF. The BFF queries all enabled **fuel price providers** in parallel, merges their stations into one format, sorts them by exact distance and caches the upstream responses:

| Provider | Source                                                                                                                                      | Key needed                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| France   | French government open data ([prix-carburants.gouv.fr](https://www.prix-carburants.gouv.fr/rubrique/opendata/)) via `data.economie.gouv.fr` | no, always enabled                     |
| Germany  | [tankentanken.de](https://www.tankentanken.de/) API                                                                                         | yes, enabled by `TANKENTANKEN_API_KEY` |

Only current prices are served; there is no price history. French data is published under the Licence Ouverte / Open Licence 2.0 (Etalab); the app credits the source.

## Tech stack

- **Web:** Angular 22, signals and `httpResource`, Signal Forms, Leaflet + markercluster, SCSS with design tokens, Vitest
- **API:** NestJS 12 (ESM), native Standard Schema validation with zod 4, `@nestjs/config`, cache-manager, throttler, Swagger, Terminus, Vitest + Supertest
- **Shared:** TypeScript 6 strict, zod 4 contracts
- **Tooling:** pnpm 12 workspaces, ESLint (typescript-eslint strict, angular-eslint incl. template accessibility), Prettier, Playwright, devcontainer
- **Delivery:** GitHub Actions, Cloudflare Pages (web), Render free web service from Docker (API), Dependabot

## Getting started

The recommended setup is the devcontainer (Node 24, pnpm 12, Playwright Chromium preinstalled): open the repository in VS Code and choose **Reopen in Container**, or run `devcontainer up --workspace-folder .`.

Without the devcontainer you need Node 24 (`.nvmrc`) and pnpm 12.8.1 (pinned via `devEngines` in `package.json`):

```bash
pnpm install
pnpm dev        # web on http://localhost:4200, API on http://localhost:3000
```

The French provider needs no configuration, so the app works out of the box. The Angular dev server proxies `/api` to the API.

| URL                            | Purpose           |
| ------------------------------ | ----------------- |
| http://localhost:4200          | Web app           |
| http://localhost:3000/api/docs | OpenAPI (Swagger) |
| http://localhost:3000/health   | Health check      |

## Scripts

| Command                      | What it does                                     |
| ---------------------------- | ------------------------------------------------ |
| `pnpm dev`                   | Start web and API in watch mode                  |
| `pnpm build`                 | Build contracts, API and web                     |
| `pnpm test`                  | Unit tests of all packages                       |
| `pnpm --filter api test:e2e` | API end-to-end tests (Supertest, fake upstreams) |
| `pnpm test:e2e`              | Browser end-to-end tests (Playwright)            |
| `pnpm lint`                  | ESLint for the whole repository                  |
| `pnpm typecheck`             | TypeScript checks of all packages                |
| `pnpm format:check`          | Prettier check (`format:write` to fix)           |

## Configuration

### API (`apps/api`)

| Variable                           | Default                         | Purpose                                                                                                                                       |
| ---------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                             | `3000`                          | HTTP port                                                                                                                                     |
| `WEB_ORIGIN`                       | `http://localhost:4200`         | Comma-separated CORS origins                                                                                                                  |
| `FRANCE_FUEL_PRICES_BASE_URL`      | `https://data.economie.gouv.fr` | French open data API                                                                                                                          |
| `TANKENTANKEN_API_KEY`             | _(unset)_                       | Enables the German provider                                                                                                                   |
| `TANKENTANKEN_BASE_URL`            | `https://api.tankentanken.de`   | German API                                                                                                                                    |
| `UPSTREAM_TIMEOUT_IN_MILLISECONDS` | `8000`                          | Timeout per upstream request                                                                                                                  |
| `CACHE_TIME_TO_LIVE_IN_SECONDS`    | `300`                           | Cache lifetime of upstream responses                                                                                                          |
| `RATE_LIMIT_REQUESTS_PER_MINUTE`   | `60`                            | Requests per client and minute                                                                                                                |
| `PROXY_SHARED_SECRET`              | _(unset)_                       | Shared with the Pages Function (`API_PROXY_SECRET`, at least 32 characters); only then is the forwarded client address used for rate limiting |

Invalid values stop the API at startup with a clear message. The API does not read `.env` files; export variables or use `node --env-file`.

### Web (`apps/web`)

| Variable                     | Purpose                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `NG_APP_MAPBOX_ACCESS_TOKEN` | Public Mapbox token (`pk.*`) read at build time; without it the map uses OpenStreetMap tiles |

## Testing

- **Unit (Vitest):** contracts schemas, API mappers and parsers, Angular services and components through their public interfaces.
- **API end-to-end (Supertest):** the real Nest application against fake upstream servers for France and Germany.
- **Browser end-to-end (Playwright):** web + API + a local stand-in for the French open data API serving recorded real data. Every request leaving the app fails the test unless it is mocked.

## Deployment

All services run on free tiers:

- **Web:** Cloudflare Pages, deployed by GitHub Actions after CI passed (preview per pull request, production on `main`). A Pages Function forwards `/api/*` to the API.
- **API:** Render free web service built from `apps/api/Dockerfile` ([render.yaml](render.yaml)); deploys after the GitHub checks of the commit passed. The free tier sleeps after 15 minutes without traffic; the first request can take about a minute, which the web app announces.

Required settings:

- **GitHub:** secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, variable `MAPBOX_ACCESS_TOKEN`, environments `preview` and `production`.
- **Cloudflare Pages:** variables `API_ORIGIN` (URL of the Render service) and `API_PROXY_SECRET` (random string, at least 32 characters).
- **Render:** `PROXY_SHARED_SECRET` with the same value as `API_PROXY_SECRET`; optionally `TANKENTANKEN_API_KEY`.
