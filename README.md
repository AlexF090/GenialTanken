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

Place suggestions for the search field (`GET /api/places`) come from the public [Photon](https://photon.komoot.io/) geocoder (OpenStreetMap data), limited to France and Germany and cached for a day.

Only current prices are served; there is no price history. French data is published under the Licence Ouverte / Open Licence 2.0 (Etalab); the app credits the source.

## Tech stack

- **Web:** Angular 22, signals and `httpResource`, Signal Forms, Leaflet + markercluster, SCSS with design tokens, Vitest
- **API:** NestJS 12 (ESM), native Standard Schema validation with zod 4, `@nestjs/config`, cache-manager, throttler, Swagger, Terminus, Vitest + Supertest
- **Shared:** TypeScript 6 strict, zod 4 contracts
- **Tooling:** pnpm 12 workspaces, ESLint (typescript-eslint strict, angular-eslint incl. template accessibility), Prettier, Playwright, devcontainer
- **Delivery:** GitHub Actions, Cloudflare Pages (web), Render free web service from Docker (API), Dependabot

## Running locally

The French data source needs no API key, so the app works out of the box.

### Option A: VS Code devcontainer (recommended)

1. Start Docker (Docker Desktop or OrbStack).
2. Open the repository in VS Code and choose **Reopen in Container**. The first build installs Node 24, pnpm and all dependencies.
3. In the VS Code terminal run `pnpm dev:container` (plain `pnpm dev` binds to `localhost` inside the container and is not reachable through the published port).
4. Open http://localhost:4200.

The container reuses your Claude Code setup from the host: `~/.claude` (login, settings, skills) is bind-mounted, `~/.claude.json` is copied in once as a seed, and `~/Developer/dotfiles` plus `~/.agents` are mounted at their host paths so the symlinks in `~/.claude` resolve. Plugins get their own Docker volume (`genialtanken-claude-plugins`) and are installed on every start from the plugins enabled in `~/.claude/settings.json`. Mounts only change when the container is rebuilt (**Dev Containers: Rebuild Container**).

### Option B: devcontainer from the command line

```bash
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . pnpm dev:container
```

`dev:container` binds the Angular dev server to all interfaces inside the container; the ports 4200 and 3000 are published to your machine. Open http://localhost:4200.

### Option C: without a container

Requires Node 24 (`.nvmrc`) and pnpm 12.8.1 (pinned via `devEngines` in `package.json`):

```bash
pnpm install
pnpm dev
```

### Local URLs

| URL                            | Purpose                             |
| ------------------------------ | ----------------------------------- |
| http://localhost:4200          | Web app (proxies `/api` to the API) |
| http://localhost:3000/api/docs | OpenAPI (Swagger)                   |
| http://localhost:3000/health   | Health check                        |

The browser asks for your location. Outside France the list stays empty unless the German provider is enabled (`TANKENTANKEN_API_KEY`); to try it anyway, allow location access and use the browser's developer tools to override the location (e.g. Paris 48.8566, 2.3522).

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

| Variable                               | Default                         | Purpose                                                                                                                                       |
| -------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                 | `3000`                          | HTTP port                                                                                                                                     |
| `WEB_ORIGIN`                           | `http://localhost:4200`         | Comma-separated CORS origins                                                                                                                  |
| `FRANCE_FUEL_PRICES_BASE_URL`          | `https://data.economie.gouv.fr` | French open data API                                                                                                                          |
| `TANKENTANKEN_API_KEY`                 | _(unset)_                       | Enables the German provider                                                                                                                   |
| `TANKENTANKEN_BASE_URL`                | `https://api.tankentanken.de`   | German API                                                                                                                                    |
| `PHOTON_BASE_URL`                      | `https://photon.komoot.io`      | Photon (komoot) geocoder behind the place search (`GET /api/places`)                                                                          |
| `PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS` | `86400`                         | Cache lifetime of place search answers                                                                                                        |
| `UPSTREAM_TIMEOUT_IN_MILLISECONDS`     | `8000`                          | Timeout per upstream request                                                                                                                  |
| `CACHE_TIME_TO_LIVE_IN_SECONDS`        | `300`                           | Cache lifetime of upstream responses                                                                                                          |
| `RATE_LIMIT_REQUESTS_PER_MINUTE`       | `60`                            | Requests per client and minute                                                                                                                |
| `PROXY_SHARED_SECRET`                  | _(unset)_                       | Shared with the Pages Function (`API_PROXY_SECRET`, at least 32 characters); only then is the forwarded client address used for rate limiting |

Invalid values stop the API at startup with a clear message. The API does not read `.env` files; export variables or use `node --env-file`.

### Web (`apps/web`)

| Variable                     | Purpose                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `NG_APP_MAPBOX_ACCESS_TOKEN` | Public Mapbox token (`pk.*`) read at build time; without it the map uses OpenStreetMap tiles |

## Testing

- **Unit (Vitest):** contracts schemas, API mappers and parsers, Angular services and components through their public interfaces.
- **API end-to-end (Supertest):** the real Nest application against fake upstream servers for France and Germany.
- **Browser end-to-end (Playwright):** web + API + a local stand-in for the French open data API and the Photon place search serving recorded real data. Every request leaving the app fails the test unless it is mocked.

## Deployment

All services run on free tiers:

- **Web:** Cloudflare Pages, deployed by GitHub Actions after CI passed (preview per pull request, production on `main`). A Pages Function forwards `/api/*` to the API.
- **API:** Render free web service built from `apps/api/Dockerfile` ([render.yaml](render.yaml)); deploys after the GitHub checks of the commit passed. The free tier sleeps after 15 minutes without traffic; the first request can take about a minute, which the web app announces.

Step-by-step setup, including the release of a new version: [docs/deployment.md](docs/deployment.md).

## Versions

- **1.0.0** – original React capstone (tag `v1.0.0`)
- **2.0.0** – Angular + NestJS rebuild (this version; tagged after merge to `main`)
