#!/usr/bin/env bash
# Keeps the GitHub CLI login across rebuilds: ~/.config/gh is a Docker volume, so
# `gh auth login` is needed only once per machine.
#
# Then installs the Claude Code plugins enabled in the host settings into the
# container's own plugin registry (a Docker volume on ~/.claude/plugins). The
# registry stores absolute paths, so sharing the host one would break both sides.
# Runs on every start because Claude Code is installed by the dotfiles script,
# which runs after postCreateCommand.
set -uo pipefail

CLAUDE_SETTINGS_FILE="${HOME}/.claude/settings.json"
export PATH="${HOME}/.local/bin:${PATH}"

# A fresh named volume is owned by root because the path does not exist in the image.
sudo chown node:node "${HOME}/.config/gh"
gh config set telemetry disabled
if gh auth status >/dev/null 2>&1; then
  gh auth setup-git
else
  echo "GitHub CLI not logged in; run 'gh auth login' once, the login survives rebuilds."
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code not installed yet; skipping plugin installation."
  exit 0
fi
if ! command -v jq >/dev/null 2>&1 || [ ! -f "${CLAUDE_SETTINGS_FILE}" ]; then
  echo "jq or ${CLAUDE_SETTINGS_FILE} missing; skipping plugin installation."
  exit 0
fi

# A fresh named volume is owned by root because the path does not exist in the image.
sudo chown node:node "${HOME}/.claude/plugins"

for marketplace_repository in $(jq -r '.extraKnownMarketplaces[]?.source.repo // empty' "${CLAUDE_SETTINGS_FILE}"); do
  claude plugin marketplace add "${marketplace_repository}" || true
done
for plugin in $(jq -r '.enabledPlugins // {} | to_entries[] | select(.value) | .key' "${CLAUDE_SETTINGS_FILE}"); do
  claude plugin install "${plugin}" || true
done
