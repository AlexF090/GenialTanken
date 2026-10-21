#!/usr/bin/env bash
# Runs on the host before the container starts (initializeCommand). Docker refuses
# bind mounts whose source is missing, so ~/.claude, ~/.agents, ~/Developer/dotfiles,
# ~/.claude.json and ~/.zsh_history must exist (CI runners and fresh machines have
# none of them).
set -euo pipefail

CLAUDE_JSON="${HOME}/.claude.json"

mkdir -p "${HOME}/.claude" "${HOME}/.agents"
touch "${HOME}/.zsh_history"

if [ ! -d "${HOME}/Developer/dotfiles" ]; then
  echo "Warning: ${HOME}/Developer/dotfiles not found; creating an empty one. Claude Code configuration symlinks will not resolve in the container."
  mkdir -p "${HOME}/Developer/dotfiles"
fi

if [ ! -f "${CLAUDE_JSON}" ]; then
  echo "Warning: ${CLAUDE_JSON} does not exist; creating an empty fallback. Log in to Claude Code once inside the container."
  echo '{}' > "${CLAUDE_JSON}"
fi
