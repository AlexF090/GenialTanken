#!/usr/bin/env bash
set -euo pipefail

# ~/.claude.json is rewritten atomically by Claude Code, which breaks a single-file
# bind mount, so the host file is mounted read-only as a seed and copied once.
if [ -f "${HOME}/.claude.json.seed" ] && [ ! -f "${HOME}/.claude.json" ]; then
  cp "${HOME}/.claude.json.seed" "${HOME}/.claude.json"
fi

sudo npm install -g pnpm@12.8.1
pnpm install
pnpm --filter e2e exec playwright install --with-deps chromium
