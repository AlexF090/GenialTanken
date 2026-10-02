#!/usr/bin/env bash
# Runs on the host before the container starts (initializeCommand). The bind
# mounts in devcontainer.json need ~/.claude, ~/.agents and ~/.claude.json to
# exist; otherwise Docker creates empty directories in their place.
set -euo pipefail

CLAUDE_JSON="${HOME}/.claude.json"

mkdir -p "${HOME}/.claude" "${HOME}/.agents"

if [ ! -d "${HOME}/Developer/dotfiles" ]; then
  echo "Warning: ${HOME}/Developer/dotfiles not found; Claude Code configuration symlinks will not resolve in the container."
fi

if [ ! -f "${CLAUDE_JSON}" ]; then
  echo "Warning: ${CLAUDE_JSON} does not exist; creating an empty fallback. Log in to Claude Code once inside the container."
  echo '{}' > "${CLAUDE_JSON}"
fi
