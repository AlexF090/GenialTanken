# Deployment checklist

Everything runs on free tiers: web on Cloudflare Pages, API on Render, CI on GitHub Actions. Work through the steps in order; each step lists where to do it.

## 1. Before going live

- [ ] **Disconnect the old Vercel project** from the repository (Vercel dashboard → project `genial-tanken` → Settings → Git → Disconnect, or delete the project). The legacy React app is gone, so the Vercel check fails on every push — and Render only deploys when _all_ checks of a commit pass.
- [ ] **Rotate or restrict the Mapbox token.** A public `pk.*` token is in the git history (found by gitleaks). In the Mapbox account either rotate it or restrict it to the production domain (`genialtanken.pages.dev` and your custom domain).
- [ ] **Make the repository public** (GitHub → Settings → General → Danger Zone). Gives unlimited free Actions minutes and branch protection on the free plan. Do this only after the Mapbox step.

## 2. Shared proxy secret

- [ ] Generate one random value with at least 32 characters, e.g. `openssl rand -base64 48`. It is used twice under the same name `PROXY_SHARED_SECRET`: in Cloudflare and in Render. It lets the Pages Function pass the visitor's address to the API, so the rate limit works per visitor and cannot be spoofed.

## 3. Render (API)

- [ ] Render dashboard → **New → Blueprint** → select this repository. Render reads [`render.yaml`](../render.yaml) and creates the free web service `genialtanken-api` (Docker, region Frankfurt, health check `/health`, deploys only after the GitHub checks passed).
- [ ] Set environment variables when asked:
  - `PROXY_SHARED_SECRET`: the value from step 2
- [ ] Note the service URL, e.g. `https://genialtanken-api.onrender.com`, and check `https://…/health` returns `{"status":"ok",…}`.

## 4. Cloudflare Pages (web)

- [ ] Create the project once (Direct Upload, not Git integration):
  ```bash
  pnpm --filter web exec wrangler pages project create genialtanken --production-branch=main
  ```
- [ ] Optional manual deploy and local preview (needs `wrangler login` or `CLOUDFLARE_API_TOKEN`; the preview reads `API_ORIGIN` and `PROXY_SHARED_SECRET` from `apps/web/.dev.vars`, which is git-ignored):
  ```bash
  pnpm deploy:web    # build, then publish dist/web/browser to the production branch
  pnpm preview:web   # build, then serve it with the Pages Function locally
  ```
- [ ] Pages project → Settings → Variables and secrets, for **Production and Preview**:
  - `API_ORIGIN`: the Render URL from step 3. It must be an `https://` URL; plain `http://` is only accepted for `localhost`, `127.0.0.1` and `[::1]` (local `wrangler pages dev`).
  - `PROXY_SHARED_SECRET` (as secret): the value from step 2
- [ ] **Existing project:** rename the secret `API_PROXY_SECRET` to `PROXY_SHARED_SECRET` (create `PROXY_SHARED_SECRET` with the same value for Production and Preview, then delete `API_PROXY_SECRET`). The Pages Function still reads the old name as a fallback for one release only.
- [ ] Create an API token (My Profile → API Tokens → template _Edit Cloudflare Workers_ or a custom token with _Account → Cloudflare Pages → Edit_) and note the account ID.

## 5. GitHub settings

- [ ] Settings → Environments: create `preview` and `production` (optionally required reviewers on `production`).
- [ ] Settings → Secrets and variables → Actions:
  - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
  - Variable: `MAPBOX_ACCESS_TOKEN` (the public `pk.*` token; without it the map uses OpenStreetMap tiles)
- [ ] After the repository is public: Settings → Branches → protect `main`, require the status check **CI success** and one approving review.

## 6. Merge and release

- [ ] Merge the pull request into `main`. CI runs on `main`; when it is green, `deploy-web.yml` publishes the web app to Cloudflare Pages and Render deploys the API. (Pull request previews start working once `deploy-web.yml` exists on `main`, because it is triggered by `workflow_run`.) Previews are built only for pull requests that are ready for review: CI skips drafts, and `deploy-web.yml` deploys only when the CI run produced the `web-dist` artifact. Open pull requests as drafts and mark them ready when final.
- [ ] Check production: web app loads, list shows stations, `/api/stations?latitude=48.8566&longitude=2.3522&fuel=e10` answers through the Pages domain.
- [ ] Tag the release on the merge commit:
  ```bash
  git switch main && git pull
  git tag -a v2.0.0 -m "GenialTanken 2.0.0: Angular and NestJS rebuild"
  git push origin v2.0.0
  gh release create v2.0.0 --title "2.0.0 – Angular + NestJS rebuild" --generate-notes
  ```

## Versions

| Version | Content                                                                 |
| ------- | ----------------------------------------------------------------------- |
| 1.0.0   | Original React capstone (tag `v1.0.0`)                                  |
| 2.0.0   | Angular 22 + NestJS 12 rebuild, French open data, Cloudflare and Render |
