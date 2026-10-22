# Contributing

The source is published for reference (see [LICENSE](LICENSE)); bug reports and suggestions are welcome as issues. This guide covers the workflow; [README.md](README.md) covers architecture and configuration.

## Setup

Requires Node 26 or newer (`.nvmrc`) and pnpm 12.8.1 (pinned via `devEngines` in `package.json`), or the dev container described in the README.

```bash
pnpm install   # also builds packages/contracts and installs the Git hooks
pnpm dev       # web on http://localhost:4200, API on http://localhost:3000
```

After changing `packages/contracts`, rebuild it (`pnpm --filter @genialtanken/contracts build`); web and API import its compiled output.

## Commands

| Command                      | What it does                                                |
| ---------------------------- | ----------------------------------------------------------- |
| `pnpm test`                  | Unit tests of all workspaces and of `scripts/`              |
| `pnpm --filter api test:e2e` | API end-to-end tests (Supertest against fake upstreams)     |
| `pnpm test:e2e`              | Browser end-to-end tests (Playwright, starts its own stack) |
| `pnpm lint`                  | ESLint for the whole repository                             |
| `pnpm typecheck`             | TypeScript checks of all workspaces and of `scripts/`       |
| `pnpm format:check`          | Prettier check (`pnpm format:write` to fix)                 |

## Git hooks

`pnpm install` installs [lefthook](https://lefthook.dev/) hooks (`lefthook.yml`). Before a commit, Prettier and ESLint check the staged files; before a push, `pnpm typecheck` and `pnpm test` run. Skip them once with `LEFTHOOK=0`.

## Commits and pull requests

- Commit messages and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org/), e.g. `feat(web): sort favorites by price` or `fix(api): retry station pages`.
- Pull requests are squash-merged, and the squash commit takes the pull request title. The title therefore decides the release: `fix` → patch, `feat` → minor, `!` → major; `chore`, `docs`, `ci`, `test` and `refactor` release nothing. A required check validates the title.
- Open pull requests as drafts. CI and preview deploys skip drafts; mark the pull request ready for review once it is final, which runs the full pipeline and publishes a preview at `https://pr-<number>-genialtanken.alexf090.workers.dev`.
- Never bump versions or create tags by hand; semantic-release does both after CI passed on `main`.
- Include tests with every change and state in the pull request which checks ran.

## AI-assisted development

`.claude/` and `CLAUDE.md` hold the configuration for the AI-assisted development used in this repository.
