#!/usr/bin/env bash
set -euo pipefail

# ~/.claude.json is rewritten atomically by Claude Code, which breaks a single-file
# bind mount, so the host file is mounted read-only as a seed and copied once.
if [ -f "${HOME}/.claude.json.seed" ] && [ ! -f "${HOME}/.claude.json" ]; then
  cp "${HOME}/.claude.json.seed" "${HOME}/.claude.json"
fi

# The host MCP server definitions assume macOS: headroom and unifi-network point to
# host-only binaries, so drop them. npx refuses to run inside this repository because
# devEngines requires pnpm, so context7 resolves its package from /tmp instead.
if [ -f "${HOME}/.claude.json" ]; then
  jq '
    if .mcpServers then
      .mcpServers |= (
        del(.headroom, ."unifi-network")
        | if .context7 then
            .context7.args = ["-y", "--prefix", "/tmp"]
              + (.context7.args | map(select(. != "-y" and . != "--prefix" and . != "/tmp")))
          else . end
      )
    else . end
  ' "${HOME}/.claude.json" > "${HOME}/.claude.json.tmp"
  mv "${HOME}/.claude.json.tmp" "${HOME}/.claude.json"
fi

sudo npm install -g pnpm@12.8.1
pnpm install
pnpm --filter e2e exec playwright install --with-deps chromium
