# Deployment runbook

Web on Hetzner Webhosting (static, Apache), API on Render (free tier), a small Cloudflare Worker (free) for the keep-awake cron and the redirect of the old address, CI on GitHub Actions. Why the web app left Cloudflare: [ADR 0001](adr/0001-leave-cloudflare-proxy.md).

| Part     | Where                                         | Deployed by                                                          |
| -------- | --------------------------------------------- | -------------------------------------------------------------------- |
| Web      | Hetzner Webhosting, `genial-tanken.appool.de` | `deploy-web.yml` after CI passed on `main` (SFTP)                    |
| API      | Render web service `genialtanken-api`         | Render after the GitHub checks passed; `release.yml` after a release |
| Worker   | Cloudflare Worker `genialtanken`              | `deploy-worker.yml` after `deploy-web.yml` succeeded                 |
| Releases | GitHub tags and releases (`v<version>`)       | `release.yml` (semantic-release) after CI passed on `main`           |

## Render (API)

- The service comes from the Blueprint [`render.yaml`](../render.yaml) (Render dashboard → **New → Blueprint**): free Docker web service `genialtanken-api`, region Frankfurt, health check `/health`, `autoDeployTrigger: checksPass`.
- Environment variable `WEB_ORIGIN`: the origins of the web app that CORS allows, comma-separated, no wildcard. Since the move only `https://genial-tanken.appool.de`: the old `workers.dev` address only redirects, so no browser calls the API from there. All other variables have defaults (see the README). `PROXY_SHARED_SECRET` is obsolete and deleted.
- Check: `<service URL>/health` (e.g. `https://genialtanken-api.onrender.com/health`) returns `{"status":"ok",…}`. The free tier sleeps after 15 minutes without traffic; the first request then takes about a minute.
- CORS check: `curl -si -H 'Origin: https://genial-tanken.appool.de' <service URL>/api/wake-up` answers `204` with `access-control-allow-origin: https://genial-tanken.appool.de`.
- Rate limit check after the first deploy: the API counts requests per client address behind exactly one proxy hop (`trust proxy` 1). Send more than `RATE_LIMIT_REQUESTS_PER_MINUTE` requests (default 60) to one route from your own connection and expect `429`; then request once from another network (for example a phone on mobile data) and expect `200`. If the second request is `429` as well, Render added a hop and every visitor shares one address; then raise `TRUSTED_PROXY_HOPS` in `apps/api/src/configure-application.ts`.
- Keeping it awake: the Worker's cron trigger (`triggers.crons` `*/5 * * * *` in `wrangler.jsonc`, handler in `apps/web/worker/keep-awake/`) calls `<API_ORIGIN>/health` from 06:00 to midnight Berlin time (daylight saving time included, checked at the time of the call), each time after a random delay of up to 2 minutes, so two calls are at most 7 minutes apart, and 12 when Cloudflare skips a run, below the 15 idle minutes. That is about 18 × 31 ≈ 560 instance hours a month; Render's free tier has 750 per workspace, so a second free service would exceed it. At night the API sleeps; the web app calls `GET /api/wake-up` (answers 204) on start, so the API starts while the browser asks for the location, and shows a hint while it starts. Cloudflare logs every run under Worker → Settings → Trigger events; failed health checks are logged, never thrown. The Workers free plan allows 10 ms CPU time per run (waiting does not count) and 15 minutes wall time.

## Hetzner Webhosting (web)

The web app is a static build. `pnpm --filter web build` runs `ng build` and then `apps/web/hosting/generate-hosting-files.ts`, which writes `dist/web/browser/.htaccess`: `301` to `https://genial-tanken.appool.de` for plain HTTP and for every other host name served from the same directory (see the alias below), `Redirect 301 /impressum https://appool.de/impressum` (the legal notice lives on appool.de), the SPA fallback to `index.html` for client routes (real files and directories are served as they are; a missing file with an extension is a 404 that shows the app), cache rules, security headers, HSTS without `preload` and the Content Security Policy. The file is generated from `apps/web/hosting/htaccess.ts` (tests in `htaccess.spec.ts`); the next deploy overwrites whatever is on the server.

- **Deploy:** `deploy-web.yml` runs after a successful CI run for a push to `main`. It downloads the `web-dist` artifact (the build with its `.htaccess`), checks it (no maps, no configuration files, the `.htaccess` names the API origin and the `/impressum` redirect, no placeholders), uploads it with lftp over SFTP (`mirror --reverse --delete`; the host key comes from the secret `SFTP_KNOWN_HOSTS`, the password through `LFTP_PASSWORD` and `--env-password`) and runs a smoke test. The SFTP user is restricted in konsoleH to the web directory of the subdomain, so the server root is the target; `--delete` removes everything else there.
- **Secrets** (environment `Production`, written exactly like that in the workflows): `SFTP_HOST`, `SFTP_PORT`, `SFTP_USER`, `SFTP_PASSWORD`, `SFTP_KNOWN_HOSTS`.
- **Smoke test:** `/` answers `200` with `Content-Security-Policy` and `Strict-Transport-Security`; `http://` redirects to `https://`; a client route (`/favorites`, `/stations/fr-75012010`) and `/datenschutz` answer `200` as HTML; `/impressum` redirects with `301` to `https://appool.de/impressum`; `/ngsw.json` and `/ngsw-worker.js` carry `Cache-Control: no-cache`; a missing file answers `404`.
- **Rollback:** the upload runs before the smoke test, so a red smoke test leaves the new build live; nothing restores the old one by itself (deliberately no staging directory). Fix it forward or go back:
  1. Fastest: Actions → Deploy web → open the last green run of the previous version → **Re-run all jobs**. A re-run replays the same event, so it downloads the `web-dist` artifact of that older CI run (kept 7 days) and uploads it again, then the smoke test runs again. `workflow_dispatch` cannot start the deploy for an older commit (it always follows the CI run of the dispatched ref).
  2. Durable: `git revert <commit>` on a branch, merge it to `main` (pull request, as for any change); CI and the deploy then run as usual. Do this in any case, otherwise the next merge brings the bad change back.
  3. Without GitHub: download the artifact (`gh run download <CI run id> -n web-dist`) and upload it by hand as below.
     If the service worker itself is the problem, use the safety worker rollback below.
- **Manual deploy** (no CI): `pnpm --filter web build`, then upload `apps/web/dist/web/browser/` including the hidden `.htaccess` to the web directory.
- **Alias `genialtanken.appool.de`:** whoever types the name without hyphen lands on `https://genial-tanken.appool.de` (`301`, path and query kept). The alias only redirects and never serves the app itself, because favorites and settings live in `localStorage`, which belongs to one origin; a second origin would show empty favorites. Set it up once in konsoleH:
  1. Add the subdomain `genialtanken` to `appool.de` with the same target directory as `genial-tanken` (the `.htaccess` there redirects every foreign host name). If konsoleH offers only a separate directory, put a `.htaccess` with `Redirect 301 / https://genial-tanken.appool.de/` there instead.
  2. Order a Let's Encrypt certificate for `genialtanken.appool.de`; without it `https://genialtanken.appool.de` fails before Apache can redirect.
  3. Check: `curl -sI http://genialtanken.appool.de/favorites` and `curl -sI https://genialtanken.appool.de/favorites` both answer `301` with `location: https://genial-tanken.appool.de/favorites`.
- **Content Security Policy:** scripts only from the own origin plus the two inline scripts of `index.html` by SHA-256 hash (computed from the build, so the hashes follow every build); `connect-src` the own origin and the Render origin (`API_ORIGIN` in `apps/web/src/environments/api-origin.ts`); map tiles from OpenStreetMap and Mapbox. `style-src` allows `'unsafe-inline'` because Angular adds component styles at run time and a static host cannot send a nonce; this is the only exception. A new external service (another tile provider, an analytics script) needs a change in `htaccess.ts` and a test.

### Service worker and caching

The production build contains the Angular service worker (`apps/web/ngsw-config.json`). It keeps the app shell (`index.html`, scripts, styles, manifest) for offline starts and caches icons on first use. It caches no API answers: there are no `dataGroups`, navigations to `/api/**` never get the app shell, and the web app sends API requests with the `ngsw-bypass` header, so they skip the service worker entirely. Navigations go to the network first (`navigationRequestStrategy: freshness`).

The `.htaccess` sets the cache times. Hashed scripts and styles (`main-XXXXXXXX.js`) and `/media/` are immutable for a year; icons are cached for a day. `index.html`, `ngsw.json`, `ngsw-worker.js`, `safety-worker.js`, `worker-basic.min.js`, `manifest.webmanifest` and every HTML answer (client routes and the 404 page are `index.html`) revalidate on every request, or browsers would keep an old service worker for a year. `hosting/htaccess.spec.ts` guards this against the file names of a real build. After changing the rules, check the served headers, e.g. `curl -sI https://genial-tanken.appool.de/favorites | grep -i cache-control` for a route, `/ngsw-worker.js`, a hashed `/main-*.js` and an icon.

After a deploy, the service worker finds the new `ngsw.json` when the app starts or navigates, downloads the new version in the background, and the app shows "Neue Version verfügbar" with "Neu laden". The app also checks for a new version whenever it becomes visible again. If the cache is broken, the app reloads on its own, at most once every 10 minutes.

Rollback if a broken service worker is live: copy `safety-worker.js` over `ngsw-worker.js` in the build output and deploy that build by hand:

```bash
pnpm --filter web build
cp apps/web/dist/web/browser/safety-worker.js apps/web/dist/web/browser/ngsw-worker.js
# upload apps/web/dist/web/browser/ (with .htaccess) to the web directory
```

The safety worker unregisters itself and deletes the service worker caches, so the next load of every visitor comes from the network again. Deploy a regular build afterwards to bring the service worker back.

## Cloudflare Worker (redirect and cron)

The Worker is configured by [`apps/web/wrangler.jsonc`](../apps/web/wrangler.jsonc). It serves no assets and proxies nothing: `fetch` redirects every request of the old `https://genialtanken.alexf090.workers.dev` address with `301` to the same path and query on `https://genial-tanken.appool.de`, answers `/ngsw.json` with `404`, which makes service workers installed from the old address unregister themselves, and answers `/api` and `/api/*` with `410 Gone` (`Cache-Control: no-store`): clients from before the move that still call the API there would otherwise receive the HTML of the web app. The cron trigger is described under Render. GitHub Actions deploys it (`deploy-worker.yml`, configuration from the default branch, `build` sections are rejected by `scripts/verify-wrangler-configuration.ts`); keep Workers Builds (the Cloudflare Git integration) disconnected, otherwise every push deploys twice.

- Worker → Settings → Variables and secrets: `API_ORIGIN` (variable), the Render URL, `https://` only (plain `http://` for `localhost`, `127.0.0.1` and `[::1]` during `wrangler dev`). `PROXY_SHARED_SECRET` is obsolete: delete the secret. `wrangler.jsonc` defines no `vars`, and the deploy uses `--keep-vars`, so the dashboard value survives every deploy.
- Worker → Settings → Domains & Routes: `workers.dev` stays enabled (it is the address that redirects); Preview URLs are not needed.
- The deploy token is a Cloudflare API token (template _Edit Cloudflare Workers_, or a custom token with _Account → Workers Scripts → Edit_), stored as `CLOUDFLARE_API_TOKEN` with `CLOUDFLARE_ACCOUNT_ID`.
- Manual deploy and local run (needs `wrangler login` or `CLOUDFLARE_API_TOKEN`; the cron reads `API_ORIGIN` from the git-ignored `apps/web/.dev.vars`):
  ```bash
  pnpm deploy:worker    # wrangler deploy
  pnpm preview:worker   # wrangler dev
  ```

## Order of the move

1. Render: set `WEB_ORIGIN` to `https://genial-tanken.appool.de,https://genialtanken.alexf090.workers.dev` (or merge so the Blueprint does) and wait until the API is deployed. Both origins work from now on.
2. Mapbox: allow `https://genial-tanken.appool.de` in the URL restrictions of the public token.
3. Merge to `main`. CI builds, `deploy-web.yml` uploads and runs the smoke test; check the app on the new address, including the rate limit check above.
4. Once the web deploy succeeded, `deploy-worker.yml` deploys the Worker: from then on the old address redirects. It deliberately waits for `deploy-web.yml`, so the old address never redirects to an app that is not there yet.
5. Afterwards: remove the old origin from `WEB_ORIGIN`, delete `PROXY_SHARED_SECRET` in Render and in Cloudflare, delete the GitHub environment `Preview` and the Mapbox URL of the old address.

## Mapbox

The public `pk.*` token is restricted to `https://genial-tanken.appool.de` (optionally `http://localhost:4200` for local development). Mapbox allows no wildcards, so CI embeds the token only in builds of `main`; other builds without the variable use OpenStreetMap tiles.

## GitHub settings

- Environment: `Production` (capital P, as in the workflows; optionally with required reviewers). The former `preview` environment is no longer used.
- Actions secrets and variables:

  | Name                     | Kind     | Purpose                                                              |
  | ------------------------ | -------- | -------------------------------------------------------------------- |
  | `CLOUDFLARE_API_TOKEN`   | secret   | Deploys the Worker (cron and redirect)                               |
  | `CLOUDFLARE_ACCOUNT_ID`  | secret   | Cloudflare account of the Worker                                     |
  | `MAPBOX_ACCESS_TOKEN`    | variable | Public Mapbox token for builds of `main`                             |
  | `RELEASE_TOKEN`          | secret   | Pushes the release commit and tag to the protected `main`            |
  | `RENDER_DEPLOY_HOOK_URL` | secret   | Deploy hook of `genialtanken-api` (Service → Settings → Deploy Hook) |

- `RELEASE_TOKEN` is a fine-grained personal access token of a repository admin: repository access only `AlexF090/GenialTanken`, permission **Contents: Read and write**, with an expiry date. Admins are exempt from branch protection while `enforce_admins` stays off and the ruleset "main protect" stays disabled; turning on either one blocks releases until the token (or a GitHub App replacing it) may bypass. Renew it before it expires, otherwise the release job fails.
- `RENDER_DEPLOY_HOOK_URL` is the service's deploy hook, not the Blueprint's sync hook. The release commit has no checks, and `checksPass` never deploys such a commit, so `release.yml` calls the hook after a release.
- Branch protection of `main`: required status checks **CI success** and **Conventional Commits title**, one approving review.
- Pull requests: only **squash merging**, default commit message **Pull request title** (title only: a description mentioning `BREAKING CHANGE:` would otherwise release a major version).

## Deploys

- **Production:** a merge into `main` runs CI; when it passes, `deploy-web.yml` uploads the web app to Hetzner and runs the smoke test, `deploy-worker.yml` deploys the Worker once that succeeded, and Render deploys the API.
- **No previews:** pull requests are not deployed. CI skips drafts and runs the full pipeline once the pull request is ready.
- `deploy-web.yml` and `deploy-worker.yml` run from the default branch (`workflow_run`) and react only to successful runs for pushes to `main` (CI, then Deploy web), never to pull requests. `deploy-web.yml` checks out nothing; `deploy-worker.yml` takes `apps/web/wrangler.jsonc` and `scripts/verify-wrangler-configuration.ts` from the default branch: a configuration with a `build` section could run a command with the deploy secrets.
- Check production: the web app loads at https://genial-tanken.appool.de, the list shows stations (the browser calls `https://genialtanken-api.onrender.com/api/stations?...` directly), and https://genialtanken.alexf090.workers.dev/ redirects there.

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
