#!/usr/bin/env bash
set -euo pipefail

sudo npm install -g pnpm@12.8.1
pnpm install
pnpm --filter e2e exec playwright install --with-deps chromium
