#!/usr/bin/env bash
# Swiss Knife one-command launcher.
set -euo pipefail
cd "$(dirname "$0")"

# 1) Ollama must be native (GPU/Metal). Check it's installed.
if ! command -v ollama >/dev/null 2>&1; then
  echo "❌ Ollama not found. Install it first:"
  echo "     brew install ollama   (or https://ollama.com/download)"
  exit 1
fi

# 2) Ensure the Ollama server is running.
if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "▶ Starting Ollama server..."
  ollama serve >/tmp/swissknife-ollama.log 2>&1 &
  for i in $(seq 1 15); do
    curl -s http://localhost:11434/api/tags >/dev/null 2>&1 && break
    sleep 1
  done
fi

# 3) Make sure models are present.
bash scripts/pull-models.sh

# 4) Bring up the containers.
echo "▶ Building & starting containers..."
docker compose up -d --build

cat <<MSG

✅ Swiss Knife is running:
   Cockpit (your app):  http://localhost:3000
   Open WebUI (chat):   http://localhost:3001

Stop everything with:  docker compose down
MSG
