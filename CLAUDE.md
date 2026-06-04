# CLAUDE.md — Project context for Claude Code

This file orients any AI agent working in this repo. Read it before making changes.

## What this is

**Swiss Knife** — a locally-run, private "daily cockpit" web app powered by **local Gemma 4 12B** (via Ollama). It's a personal productivity + AI-tools hub that runs entirely on the user's Mac. No third-party logging; all data stays on-machine.

Target machine: Apple Silicon Mac (M5 / 48GB). Built to be shareable with colleagues.

## Hard rules (do not violate)

1. **Ollama runs NATIVELY on macOS, never in Docker.** Docker Desktop on macOS cannot pass the Apple GPU into a container, so containerized Ollama is CPU-only (~5–6× slower). Containers reach the host Ollama via `host.docker.internal`.
2. **Keep everything local.** No cloud LLM calls from the cockpit. The whole point is privacy + zero API cost for daily tasks.
3. **Respect the tiering.** Local Gemma 12B handles drafting, cleanup, summarizing, organizing, and RAG Q&A. It is NOT for heavy agentic/coding work — that stays with Claude/Cursor. Don't design features that demand more than a 12B can deliver.
4. **Don't commit secrets or local data.** `.env`, `*.db`, and `node_modules/` are gitignored. Keep it that way.

## Architecture (3 layers)

- **Engine:** Ollama (native) serving `gemma4:12b` + an embedding model. OpenAI-compatible API at `http://localhost:11434/v1`.
- **Deep-work surface:** Open WebUI (Docker, off-the-shelf) — chat, document RAG, multimodal, prompt library. Configured, not coded.
- **Cockpit (the part we build):** Next.js 15 app (this repo's `cockpit/`). Talks to Ollama directly; owns todo/Kanban/email/prompt tools + a project hub that links into Open WebUI.

## Stack & conventions (cockpit/)

- Next.js 15 (App Router) + TypeScript (strict). Tailwind for styling. Prisma + SQLite for persistence.
- Ollama access goes through `src/lib/ollama.ts` (a thin fetch client) — don't scatter raw fetches.
- DB access through the singleton in `src/lib/db.ts`. Add models to `prisma/schema.prisma`; run `npm run db:push`.
- Env vars: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `DATABASE_URL`.
- New tools live under `src/app/tools/<name>/` with a matching API route under `src/app/api/<name>/`.

## Run / dev

- Full stack (Docker): `./start.sh` → cockpit at :3000, Open WebUI at :3001.
- Local cockpit dev: `cd cockpit && npm install && npm run db:push && npm run dev`.
- **Note:** a Linux `cockpit/node_modules/` may exist from initial scaffolding — delete it before local dev on macOS.

## Status & roadmap

- ✅ Phase 0: engine (compose + model pull). ✅ Phase 1: cockpit skeleton + Prompt Optimizer.
- ⬜ Phase 2: prompt library UI · email writer · brainstorming
- ⬜ Phase 3: todo · Kanban (dnd-kit)
- ⬜ Phase 4: project knowledge base (RAG) · memory · PDF ingest · image input
- ⬜ Phase 5: clipboard quick-capture · screenshots · project hub linking

## Working agreements for the agent

- When writing code against a library/framework, **use Context7** ("use context7") to pull current, version-accurate docs rather than relying on training data.
- For end-to-end UI testing, **use the Playwright MCP** explicitly.
- Keep changes small and committed per feature so they're easy to roll back.
- Update this file and the roadmap when a phase lands.
