# Deployment checklist

Everything runs on free tiers: web on Cloudflare Workers (static assets), API on Render, CI on GitHub Actions. Work through the steps in order; each step lists where to do it.

## 1. Before going live

- [ ] **Disconnect the old Vercel project** from the repository (Vercel dashboard → project `genial-tanken` → Settings → Git → Disconnect, or delete the project). The legacy React app is gone, so the Vercel check fails on every push — and Render only deploys when _all_ checks of a commit pass.
- [ ] **Rotate or restrict the Mapbox token.** A public `pk.*` token is in the git history (found by gitleaks). In the Mapbox account either rotate it or restrict it to the production URL `https://genialtanken.alexf090.workers.dev` (optionally also `http://localhost:4200` for local development). Mapbox allows no wildcards, so pull request previews cannot use the token; CI embeds it only in builds of `main`, and previews use OpenStreetMap tiles.
- [ ] **Make the repository public** (GitHub → Settings → General → Danger Zone). Gives unlimited free Actions minutes and branch protection on the free plan. Do this only after the Mapbox step.

## 2. Shared proxy secret

- [ ] Generate one random value with at least 32 characters, e.g. `openssl rand -base64 48`. It is used twice under the same name `PROXY_SHARED_SECRET`: in Cloudflare and in Render. It lets the Worker pass the visitor's address to the API, so the rate limit works per visitor and cannot be spoofed.

## 3. Render (API)

- [ ] Render dashboard → **New → Blueprint** → select this repository. Render reads [`render.yaml`](../render.yaml) and creates the free web service `genialtanken-api` (Docker, region Frankfurt, health check `/health`, deploys only after the GitHub checks passed).
- [ ] Set environment variables when asked:
  - `PROXY_SHARED_SECRET`: the value from step 2
- [ ] Note the service URL, e.g. `https://genialtanken-api.onrender.com`, and check `https://…/health` returns `{"status":"ok",…}`.

## 4. Cloudflare Workers (web)

The web app is the Worker `genialtanken` with static assets ([`apps/web/wrangler.jsonc`](../apps/web/wrangler.jsonc)): it serves the Angular build as a single-page application and runs its code first only for `/api/*`, which it proxies to Render. The Worker already exists.

- [ ] **Disconnect Workers Builds** (Workers & Pages → `genialtanken` → Settings → Builds → Disconnect). GitHub Actions deploys (`deploy-web.yml`); with the Git integration connected, every push would deploy twice, and pull requests show a hanging check "Workers Builds: genialtanken".
- [ ] Worker → Settings → Variables and secrets:
  - `API_ORIGIN` (variable): the Render URL from step 3. It must be an `https://` URL; plain `http://` is only accepted for `localhost`, `127.0.0.1` and `[::1]` (local `wrangler dev`).
  - `PROXY_SHARED_SECRET` (secret): the value from step 2, in the dashboard or with
    ```bash
    pnpm --filter web exec wrangler secret put PROXY_SHARED_SECRET
    ```
    Preview versions use the same variables and secrets as production. `wrangler.jsonc` defines no `vars`, and `deploy-web.yml` deploys with `--keep-vars`, so the dashboard value of `API_ORIGIN` survives every deploy.
- [ ] Worker → Settings → Domains & Routes: keep `workers.dev` enabled and enable **Preview URLs** (pull request previews are aliased version URLs).
- [ ] Create an API token (My Profile → API Tokens → template _Edit Cloudflare Workers_, or a custom token with _Account → Workers Scripts → Edit_) and note the account ID.
- [ ] **Old Pages project:** if a Cloudflare Pages project `genialtanken` exists, delete it (Workers & Pages → `genialtanken` (Pages) → Settings → Delete project). The old `genialtanken.pages.dev` address stops working.
- [ ] Optional manual deploy and local preview (needs `wrangler login` or `CLOUDFLARE_API_TOKEN`; the preview reads `API_ORIGIN` and `PROXY_SHARED_SECRET` from `apps/web/.dev.vars`, which is git-ignored):
  ```bash
  pnpm deploy:web    # build, then wrangler deploy (production)
  pnpm preview:web   # build, then wrangler dev: static assets plus the /api proxy locally
  ```

## 5. GitHub settings

- [ ] Settings → Environments: create `preview` and `production` (optionally required reviewers on `production`).
- [ ] Settings → Secrets and variables → Actions:
  - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
  - Variable: `MAPBOX_ACCESS_TOKEN` (the public `pk.*` token; without it the map uses OpenStreetMap tiles)
  - Secret: `RELEASE_TOKEN` for `release.yml`. Create a fine-grained personal access token as a repository admin (GitHub → Settings → Developer settings → Fine-grained tokens): repository access only `AlexF090/GenialTanken`, repository permission **Contents: Read and write**, an expiry date you note down. The release commit is pushed to the protected `main` with it; admins are exempt from branch protection (`enforce_admins` off), `GITHUB_TOKEN` is not. Renew it before it expires, otherwise the release job fails.
- [ ] Settings → General → Pull Requests: allow only **squash merging** with the default commit message **Pull request title** (title only, no description: a description that mentions `BREAKING CHANGE:` would otherwise release a major version). The squash commit then carries the pull request title, which decides the release.
- [ ] After the repository is public: Settings → Branches → protect `main`, require the status check **CI success** and one approving review.

## 6. Merge and release

- [ ] Merge the pull request into `main`. CI runs on `main`; when it is green, `deploy-web.yml` publishes the web app with `wrangler deploy` to https://genialtanken.alexf090.workers.dev and Render deploys the API. Pull request previews are uploaded as Worker versions with the alias `pr-<number>` and served at `https://pr-<number>-genialtanken.alexf090.workers.dev`; the workflow posts the URL as a pull request comment. Previews start working only once `deploy-web.yml` and `apps/web/wrangler.jsonc` exist on `main`: `workflow_run` reads the workflow from the default branch, and the deploy takes `wrangler.jsonc` only from the default branch (a configuration from a pull request could run a build command with the deploy secrets). Until then the deploy job fails with a message saying so. Previews are built only for pull requests that are ready for review: CI skips drafts, and `deploy-web.yml` deploys only when the CI run produced the `web-dist` artifact. Open pull requests as drafts and mark them ready when final.
- [ ] Check production: web app loads, list shows stations, `https://genialtanken.alexf090.workers.dev/api/stations?latitude=48.8566&longitude=2.3522&fuel=e10` answers through the Worker.
- [ ] Releases need no manual step. After CI passed for a push to `main`, `release.yml` runs semantic-release (`release.config.js`). The pull request title, which becomes the squash commit, decides the version: `fix` → patch, `feat` → minor, `!` or a `BREAKING CHANGE` footer → major; `chore`, `docs`, `ci`, `test` and `refactor` release nothing. A release bumps every `package.json` (the API reports that version), updates `CHANGELOG.md`, pushes `chore(release): <version> [skip ci]`, tags `v<version>` and creates the GitHub release. The release commit skips CI and therefore the web deploy; it changes only versions and the changelog. If `main` moved on while CI ran, the job skips and the CI run of the newer commit releases both.
- [ ] Check a release: `pnpm exec semantic-release --dry-run` on an up-to-date `main` (with `GITHUB_TOKEN` set to a token that can read the repository) prints the next version and its notes without changing anything.

## Versions

| Version | Content                                                                 |
| ------- | ----------------------------------------------------------------------- |
| 1.0.0   | Original React capstone (tag `v1.0.0`)                                  |
| 2.0.0   | Angular 22 + NestJS 12 rebuild, French open data, Cloudflare and Render |

Later versions are listed in `CHANGELOG.md` and on the GitHub releases page.
