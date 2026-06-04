# 🔧 Swiss Knife — Local AI Daily Runner

A locally-run, private "daily cockpit" powered by **local Gemma 4 12B** via Ollama.
Two surfaces, one engine:

- **Cockpit** (`http://localhost:3000`) — your custom Next.js app (Phase 1: Prompt Optimizer; later: email writer, todo, Kanban, knowledge base).
- **Open WebUI** (`http://localhost:3001`) — off-the-shelf chat + document RAG + prompt library + multimodal.

Everything stays on your machine. No third-party logging.

---

## Why Ollama runs natively (not in Docker)

Docker Desktop on macOS **cannot** pass the Apple GPU into a container — even on M5.
A containerized Ollama falls back to CPU and runs **~5–6× slower**. So Ollama runs
natively (full Metal/GPU acceleration) and the containers reach it via
`host.docker.internal`. This is the recommended setup for any Apple Silicon Mac.

---

## Prerequisites (one-time, per machine)

1. **Docker Desktop** — https://www.docker.com/products/docker-desktop/
2. **Ollama (native)** — `brew install ollama` or https://ollama.com/download

That's all your colleagues need too.

---

## Run it (one command)

```bash
./start.sh
```

This will:
1. Start the native Ollama server if it isn't already running.
2. Pull `gemma4:12b` (and the embedding model for the future knowledge base).
3. Build & launch the cockpit + Open WebUI containers.

Then open **http://localhost:3000**.

Stop everything: `docker compose down`

> First run downloads the Gemma model (several GB) and builds the cockpit image,
> so it takes a few minutes. Subsequent runs are fast.

---

## What works today (Phase 1)

- **Prompt Optimizer** — rewrite a rough prompt into a sharp one using local Gemma,
  with an option to **save it to your prompt library** (SQLite, on-disk).
- **Dashboard** — entry point + recent prompts.
- **Open WebUI** — full chat, document upload/RAG, and multimodal, ready immediately.

## Architecture

```
        ┌─────────────────────────── your Mac ───────────────────────────┐
        │                                                                 │
        │   Ollama (NATIVE, GPU/Metal)  ── gemma4:12b + embeddings        │
        │        ▲                          ▲                             │
        │        │ host.docker.internal     │                             │
        │   ┌────┴───────┐            ┌──────┴──────┐                      │
        │   │  Cockpit   │            │ Open WebUI  │   (Docker Compose)   │
        │   │ Next.js+TS │            │  chat/RAG   │                      │
        │   │ SQLite     │            └─────────────┘                      │
        │   └────────────┘                                                 │
        └─────────────────────────────────────────────────────────────────┘
```

- **Cockpit stack:** Next.js 15 (App Router), TypeScript, Tailwind, Prisma + SQLite,
  a thin Ollama client hitting the OpenAI-compatible endpoint.
- **Data:** cockpit data (prompts, later todos/Kanban/projects) in a SQLite volume;
  Open WebUI keeps its own data volume.

## Roadmap (next phases)

- **Phase 2:** Prompt library UI · email writer · brainstorming
- **Phase 3:** Todo · Kanban (dnd-kit)
- **Phase 4:** Project knowledge base (RAG) · memory · PDF ingest · image input
- **Phase 5:** Clipboard quick-capture · screenshots · project hub linking

## Notes for sharing with colleagues

- `WEBUI_AUTH=False` in `docker-compose.yml` is fine for single-user local use.
  Set it to `True` before exposing Open WebUI beyond localhost.
- The whole thing is reproducible: clone the folder, install the two prerequisites,
  run `./start.sh`.

## Local development (without Docker)

```bash
cd cockpit
npm install
npm run db:push        # creates the SQLite schema
OLLAMA_BASE_URL=http://localhost:11434/v1 OLLAMA_MODEL=gemma4:12b npm run dev
```
