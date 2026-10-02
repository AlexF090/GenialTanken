# Deployment checklist

Everything runs on free tiers: web on Cloudflare Pages, API on Render, CI on GitHub Actions. Work through the steps in order; each step lists where to do it.

## 1. Before going live

- [ ] **Disconnect the old Vercel project** from the repository (Vercel dashboard → project `genial-tanken` → Settings → Git → Disconnect, or delete the project). The legacy React app is gone, so the Vercel check fails on every push — and Render only deploys when _all_ checks of a commit pass.
- [ ] **Rotate or restrict the Mapbox token.** A public `pk.*` token is in the git history (found by gitleaks). In the Mapbox account either rotate it or restrict it to the production domain (`genialtanken.pages.dev` and your custom domain).
- [ ] **Make the repository public** (GitHub → Settings → General → Danger Zone). Gives unlimited free Actions minutes and branch protection on the free plan. Do this only after the Mapbox step.

## 2. Shared proxy secret

- [ ] Generate one random value with at least 32 characters, e.g. `openssl rand -base64 48`. It is used twice: as `API_PROXY_SECRET` in Cloudflare and as `PROXY_SHARED_SECRET` in Render. It lets the Pages Function pass the visitor's address to the API, so the rate limit works per visitor and cannot be spoofed.

## 3. Render (API)

- [ ] Render dashboard → **New → Blueprint** → select this repository. Render reads [`render.yaml`](../render.yaml) and creates the free web service `genialtanken-api` (Docker, region Frankfurt, health check `/health`, deploys only after the GitHub checks passed).
- [ ] Set environment variables when asked:
  - `PROXY_SHARED_SECRET`: the value from step 2
  - `TANKENTANKEN_API_KEY`: optional, enables German stations
- [ ] Note the service URL, e.g. `https://genialtanken-api.onrender.com`, and check `https://…/health` returns `{"status":"ok",…}`.

## 4. Cloudflare Pages (web)

- [ ] Create the project once (Direct Upload, not Git integration):
  ```bash
  pnpm dlx wrangler pages project create genialtanken --production-branch=main
  ```
- [ ] Pages project → Settings → Variables and secrets, for **Production and Preview**:
  - `API_ORIGIN`: the Render URL from step 3
  - `API_PROXY_SECRET` (as secret): the value from step 2
- [ ] Create an API token (My Profile → API Tokens → template _Edit Cloudflare Workers_ or a custom token with _Account → Cloudflare Pages → Edit_) and note the account ID.

## 5. GitHub settings

- [ ] Settings → Environments: create `preview` and `production` (optionally required reviewers on `production`).
- [ ] Settings → Secrets and variables → Actions:
  - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
  - Variable: `MAPBOX_ACCESS_TOKEN` (the public `pk.*` token; without it the map uses OpenStreetMap tiles)
- [ ] After the repository is public: Settings → Branches → protect `main`, require the status check **CI success** and one approving review.

## 6. Merge and release

- [ ] Merge the pull request into `main`. CI runs on `main`; when it is green, `deploy-web.yml` publishes the web app to Cloudflare Pages and Render deploys the API. (Pull request previews start working once `deploy-web.yml` exists on `main`, because it is triggered by `workflow_run`.)
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
