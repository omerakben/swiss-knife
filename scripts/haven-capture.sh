#!/usr/bin/env bash
# Quick-capture into Haven Desk from anywhere (e.g. a macOS Shortcut hotkey).
# No secret is stored here: the capture token is fetched from the running cockpit
# at runtime, so this file is safe to commit.
#
# Usage:
#   haven-capture.sh                 # captures the clipboard as a task
#   haven-capture.sh "buy milk"      # captures the given text as a task
#   haven-capture.sh "" fact         # captures the clipboard as a memory fact
#   haven-capture.sh "idea text" idea # task | fact | prompt | idea
set -euo pipefail

BASE="${HAVEN_BASE:-http://localhost:4141}"
PY="$(command -v python3 || echo /usr/bin/python3)"

TEXT="${1:-}"
[ -z "$TEXT" ] && TEXT="$(pbpaste 2>/dev/null || true)"
TARGET="${2:-task}"

notify() { osascript -e "display notification \"$1\" with title \"Haven Desk\"" >/dev/null 2>&1 || true; }

if [ -z "${TEXT// /}" ]; then
  notify "Nothing to capture (clipboard empty)"
  echo "Nothing to capture." >&2
  exit 1
fi

TOKEN="$(curl -s --max-time 5 "$BASE/api/capture/token" | "$PY" -c 'import json,sys;print(json.load(sys.stdin).get("token") or "")' 2>/dev/null || true)"
if [ -z "$TOKEN" ]; then
  notify "Quick capture not set up — open Settings"
  echo "No capture token. Generate one in the cockpit Settings → Quick capture." >&2
  exit 1
fi

BODY="$("$PY" -c 'import json,sys;print(json.dumps({"target":sys.argv[1],"text":sys.argv[2]}))' "$TARGET" "$TEXT")"
CODE="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/capture" \
  -H "x-capture-token: $TOKEN" -H "Content-Type: application/json" -d "$BODY")"

if [ "$CODE" = "200" ]; then
  notify "Captured to ${TARGET}"
else
  notify "Capture failed (HTTP $CODE)"
  echo "Capture failed: HTTP $CODE" >&2
  exit 1
fi
