#!/bin/bash
# Pre-push / PR creation check hook for Claude Code.
# Runs CI-equivalent checks (lint + test) before git push or gh pr create.
# Receives tool input as JSON on stdin.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -qE 'git push|gh pr create'; then
  echo "Running ci:post-check before push..." >&2
  task ci:post-check
  if [ $? -ne 0 ]; then
    echo "ci:post-check failed. Blocking push." >&2
    exit 2
  fi
fi

exit 0
