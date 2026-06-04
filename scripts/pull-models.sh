#!/usr/bin/env bash
set -e
MODEL="${OLLAMA_MODEL:-gemma4:12b-mlx}"
EMBED="${EMBED_MODEL:-embeddinggemma}"
echo "Pulling chat model: $MODEL"
ollama pull "$MODEL"
echo "Pulling embedding model (for the Phase 4 knowledge base): $EMBED"
ollama pull "$EMBED" || echo "  (embedding model optional for now — skipping)"
