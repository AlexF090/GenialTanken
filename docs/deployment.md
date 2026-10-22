# Deployment runbook

Everything runs on free tiers: web on Cloudflare Workers (static assets), API on Render, CI on GitHub Actions.

| Part     | Where                                   | Deployed by                                                          |
| -------- | --------------------------------------- | -------------------------------------------------------------------- |
| Web      | Cloudflare Worker `genialtanken`        | `deploy-web.yml` after CI passed (production and previews)           |
| API      | Render web service `genialtanken-api`   | Render after the GitHub checks passed; `release.yml` after a release |
| Releases | GitHub tags and releases (`v<version>`) | `release.yml` (semantic-release) after CI passed on `main`           |

## Shared proxy secret

`PROXY_SHARED_SECRET` is set under the same name in Cloudflare and in Render. It lets the Worker pass the visitor's address to the API, so the rate limit works per visitor and cannot be spoofed. Generate a value with at least 32 characters, e.g. `openssl rand -base64 48`. To rotate it, set the new value in both places; until both match, the API rate-limits by the connecting Cloudflare address, so visitors share limits.

## Render (API)

- The service comes from the Blueprint [`render.yaml`](../render.yaml) (Render dashboard → **New → Blueprint**): free Docker web service `genialtanken-api`, region Frankfurt, health check `/health`, `autoDeployTrigger: checksPass`.
- Environment variable: `PROXY_SHARED_SECRET`. All other variables have defaults (see the README).
- Check: `<service URL>/health` (e.g. `https://genialtanken-api.onrender.com/health`) returns `{"status":"ok",…}`. The free tier sleeps after 15 minutes without traffic; the first request then takes about a minute.
- Keeping it awake: the Worker's cron trigger (`triggers.crons` `*/10 * * * *` in `wrangler.jsonc`, handler in `apps/web/worker/keep-awake/`) calls `<API_ORIGIN>/health` from 06:00 to midnight Berlin time (daylight saving time included), each time after a random delay of up to 4 minutes, so the gap between calls stays below 15 minutes. That is about 18 × 31 ≈ 560 instance hours a month; Render's free tier has 750 per workspace, so a second free service would exceed it. At night the API sleeps; the web app calls `GET /api/wake-up` (answers 204) on start, so the API starts while the browser asks for the location. Cron triggers run only for the deployed production Worker, not for preview versions, and `deploy-web.yml` takes `wrangler.jsonc` from `main`, so a changed schedule takes effect after the merge. Cloudflare logs every run under Worker → Settings → Trigger events; failed health checks are logged, never thrown. The Workers free plan allows 10 ms CPU time per run (waiting does not count) and 15 minutes wall time.

## Cloudflare Workers (web)

The Worker is configured by [`apps/web/wrangler.jsonc`](../apps/web/wrangler.jsonc): it serves the Angular build as a single-page application and runs its code first only for `/api/*`, which it proxies to Render. GitHub Actions deploys it; keep Workers Builds (the Cloudflare Git integration) disconnected, otherwise every push deploys twice.

- Worker → Settings → Variables and secrets:
  - `API_ORIGIN` (variable): the Render URL. It must be an `https://` URL; plain `http://` is only accepted for `localhost`, `127.0.0.1` and `[::1]` (local `wrangler dev`).
  - `PROXY_SHARED_SECRET` (secret): in the dashboard or with
    ```bash
    pnpm --filter web exec wrangler secret put PROXY_SHARED_SECRET
    ```
    Preview versions use the same variables and secrets as production. This is a deliberate trade-off: a pull request's Worker code runs with the production `PROXY_SHARED_SECRET`, so anyone who can push branches to this repository can read it (forks are excluded). Only the owner pushes branches today; give previews their own secret before granting others write access. `wrangler.jsonc` defines no `vars`, and `deploy-web.yml` deploys with `--keep-vars`, so the dashboard value of `API_ORIGIN` survives every deploy.
- Worker → Settings → Domains & Routes: `workers.dev` and **Preview URLs** stay enabled (pull request previews are aliased version URLs).
- The deploy token is a Cloudflare API token (template _Edit Cloudflare Workers_, or a custom token with _Account → Workers Scripts → Edit_).
- Manual deploy and local preview (needs `wrangler login` or `CLOUDFLARE_API_TOKEN`; the preview reads `API_ORIGIN` and `PROXY_SHARED_SECRET` from the git-ignored `apps/web/.dev.vars`):
  ```bash
  pnpm deploy:web    # build, then wrangler deploy (production)
  pnpm preview:web   # build, then wrangler dev: static assets plus the /api proxy locally
  ```

### Service worker and caching

The production build contains the Angular service worker (`apps/web/ngsw-config.json`). It keeps the app shell (`index.html`, scripts, styles, manifest) for offline starts and caches icons on first use. It caches no `/api` answers: there are no `dataGroups`, navigations to `/api/**` never get the app shell, and the web app sends API requests with the `ngsw-bypass` header, so they skip the service worker entirely. Navigations go to the network first (`navigationRequestStrategy: freshness`).

[`apps/web/public/_headers`](../apps/web/public/_headers) sets the cache times of the static assets. Hashed scripts and styles are immutable for a year (`/*.js`), but the service worker files must be revalidated on every request, or browsers would keep an old worker for a year. So `/ngsw-worker.js`, `/safety-worker.js`, `/worker-basic.min.js`, `/ngsw.json`, `/index.html` and `/` first remove the inherited header (`! Cache-Control`) and then set `Cache-Control: no-cache`. `scripts/static-asset-caching.spec.ts` (`pnpm test:scripts`) guards these rules. Paths of the single-page application (for example `/favorites`) get Cloudflare's default for HTML, which revalidates as well.

After a deploy, the service worker finds the new `ngsw.json` when the app starts or navigates, downloads the new version in the background, and the app shows "Neue Version verfügbar" with "Neu laden". If the cache is broken, the app reloads on its own.

Rollback if a broken service worker is live: copy `safety-worker.js` over `ngsw-worker.js` in the build output and deploy that build:

```bash
pnpm --filter web build
cp apps/web/dist/web/browser/safety-worker.js apps/web/dist/web/browser/ngsw-worker.js
pnpm --filter web run deploy
```

The safety worker unregisters itself and deletes the service worker caches, so the next load of every visitor comes from the network again. Deploy a regular build afterwards to bring the service worker back.

## Mapbox

The public `pk.*` token is restricted to `https://genialtanken.alexf090.workers.dev` (optionally `http://localhost:4200` for local development). Mapbox allows no wildcards, so CI embeds the token only in builds of `main`; pull request previews and local builds without the variable use OpenStreetMap tiles.

## GitHub settings

- Environments: `preview` and `production` (optionally with required reviewers on `production`).
- Actions secrets and variables:

  | Name                     | Kind     | Purpose                                                              |
  | ------------------------ | -------- | -------------------------------------------------------------------- |
  | `CLOUDFLARE_API_TOKEN`   | secret   | Deploys the Worker                                                   |
  | `CLOUDFLARE_ACCOUNT_ID`  | secret   | Cloudflare account of the Worker                                     |
  | `MAPBOX_ACCESS_TOKEN`    | variable | Public Mapbox token for builds of `main`                             |
  | `RELEASE_TOKEN`          | secret   | Pushes the release commit and tag to the protected `main`            |
  | `RENDER_DEPLOY_HOOK_URL` | secret   | Deploy hook of `genialtanken-api` (Service → Settings → Deploy Hook) |

- `RELEASE_TOKEN` is a fine-grained personal access token of a repository admin: repository access only `AlexF090/GenialTanken`, permission **Contents: Read and write**, with an expiry date. Admins are exempt from branch protection while `enforce_admins` stays off and the ruleset "main protect" stays disabled; turning on either one blocks releases until the token (or a GitHub App replacing it) may bypass. Renew it before it expires, otherwise the release job fails.
- `RENDER_DEPLOY_HOOK_URL` is the service's deploy hook, not the Blueprint's sync hook. The release commit has no checks, and `checksPass` never deploys such a commit, so `release.yml` calls the hook after a release.
- Branch protection of `main`: required status checks **CI success** and **Conventional Commits title**, one approving review.
- Pull requests: only **squash merging**, default commit message **Pull request title** (title only: a description mentioning `BREAKING CHANGE:` would otherwise release a major version).

## Deploys

- **Production:** a merge into `main` runs CI; when it passes, `deploy-web.yml` runs `wrangler deploy` to https://genialtanken.alexf090.workers.dev and Render deploys the API.
- **Previews:** for every pull request that is ready for review, `deploy-web.yml` uploads a Worker version with the alias `pr-<number>` (`https://pr-<number>-genialtanken.alexf090.workers.dev`) and posts the URL as a pull request comment. CI skips drafts, and the deploy runs only when the CI run produced the `web-dist` artifact.
- `deploy-web.yml` runs from the default branch and takes `apps/web/wrangler.jsonc` and `scripts/verify-wrangler-configuration.ts` only from there, never from the pull request: a configuration with a `build` section could run a command with the deploy secrets.
- Check production: the web app loads, the list shows stations, and `https://genialtanken.alexf090.workers.dev/api/stations?latitude=48.8566&longitude=2.3522&fuel=e10` answers through the Worker.

## Releases

Releases need no manual step. After CI passed for a push to `main`, `release.yml` runs semantic-release (`release.config.js`):

- The pull request title, which becomes the squash commit, decides the version: `fix`, `perf` and `revert` → patch, `feat` → minor, `!` or a `BREAKING CHANGE` footer → major; `chore`, `docs`, `ci`, `test`, `build`, `style` and `refactor` release nothing. GitHub's revert button titles a pull request `Revert "feat: …"`; rename it to `revert: …` before merging, otherwise the title check fails.
- A release bumps every `package.json` (the API reports that version), writes `CHANGELOG.md`, pushes `chore(release): <version> [skip ci]`, tags `v<version>`, creates the GitHub release and deploys the API through the Render deploy hook. The release commit skips CI and therefore the web deploy; the web build does not show the version.
- If `main` moved on while CI ran, the job skips and the CI run of the newer commit releases both.
- After a failed release (for example an expired `RELEASE_TOKEN`), fix the cause and start Actions → Release → Run workflow; it releases the current `main`.
- Dry run: `GITHUB_TOKEN=$(gh auth token) pnpm exec semantic-release --dry-run` on an up-to-date `main` prints the next version and its notes; it checks push access but changes nothing.

## Versions

| Version | Content                                                                 |
| ------- | ----------------------------------------------------------------------- |
| 1.0.0   | Original React capstone (tag `v1.0.0`)                                  |
| 2.0.0   | Angular 22 + NestJS 12 rebuild, French open data, Cloudflare and Render |

Later versions are listed on [GitHub Releases](https://github.com/AlexF090/GenialTanken/releases).
