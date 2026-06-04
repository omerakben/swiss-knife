# Swiss Knife — Local AI Daily Runner: Build Plan

**Owner:** Ozzy · **Machine:** Apple M5 / 48GB · **Date:** 2026-06-04
**Goal:** A locally-run, private "daily cockpit" web app powered by local Gemma 4 12B, combining productivity tools, AI assistants, and a project knowledge base — with no third-party logging and all data on-machine.

---

## 1. Decisions locked in

| Decision | Choice |
|---|---|
| Build approach | **Hybrid** — reuse an existing platform for chat/RAG, build custom for the rest |
| Custom stack | **Next.js + TypeScript** |
| MVP scope | Prompt optimizer + library · Knowledge base + memory · Email writer + brainstorming · Todo + Kanban |
| Non-text input | Documents/PDFs · Clipboard / quick capture · Images / screenshots |
| Tiering | Local Gemma = drafts, cleanup, organizing, RAG Q&A. Claude/Cursor = heavy agentic / real coding. |

---

## 2. Architecture (3 layers)

**Layer 1 — Engine (Ollama, already chosen)**
- `gemma4:12b` for chat/generation and image understanding (natively multimodal).
- An embedding model (`embeddinggemma` or `nomic-embed-text`) for the knowledge base.
- Exposes an OpenAI-compatible API at `http://localhost:11434/v1` that both layers above talk to.

**Layer 2 — Deep-work surface (Open WebUI, configured not coded)**
- Handles what already exists off-the-shelf: rich multimodal chat, document/PDF RAG knowledge bases per project, prompt library, image input.
- Runs locally (Docker or pip), points at Ollama. Zero custom code.

**Layer 3 — The Cockpit (custom Next.js app — the part we build)**
- Your home base / daily driver. Dashboard + the bespoke tools Open WebUI doesn't have:
  todo, Kanban, email writer, brainstorming quick-tools, prompt optimizer, clipboard quick-capture,
  and a project index that deep-links into the matching Open WebUI knowledge base.
- Talks directly to Ollama for its own AI actions.

**Shared data (local, private)**
- SQLite via Prisma for cockpit data: todos, Kanban cards, projects, saved prompts, drafts, lightweight memory facts.
- PDFs/docs for deep RAG live in Open WebUI; the cockpit links to them. Everything stays on the M5.

**Cockpit tech**: Next.js 15 (App Router), Tailwind + shadcn/ui, dnd-kit (Kanban drag-drop), Prisma + SQLite, `openai` npm client pointed at the local endpoint, `pdf-parse` for ingest.

---

## 3. How each MVP feature maps

| Feature | Lives in | Notes |
|---|---|---|
| Prompt optimizer | Cockpit | One-shot AI action; great first end-to-end proof |
| Prompt library | Cockpit (+ Open WebUI has one too) | Stored in SQLite, reusable/taggable |
| Email writer + brainstorming | Cockpit | Text AI actions reusing the same Ollama client |
| Todo + Kanban | Cockpit | Standard app work; light model dependence |
| Knowledge base | Open WebUI | RAG over PDFs/docs per project; cockpit links in |
| Memory | Cockpit | Lightweight facts store injected into prompts |
| Images / screenshots | Cockpit + Open WebUI | Sent to gemma4 vision |
| Clipboard quick-capture | Cockpit | Fast capture into notes/knowledge |

---

## 4. Phased build order (value early, not all-at-once)

- **Phase 0 — Engine:** Pull `gemma4:12b` + embedding model; get Open WebUI running and talking to Ollama. Verify.
- **Phase 1 — Cockpit skeleton:** Next.js app, layout, dashboard, SQLite/Prisma, Ollama client wired, **prompt optimizer working end-to-end.** First thing you can actually use.
- **Phase 2 — Text AI tools:** Prompt library + email writer + brainstorming (fast wins, shared client).
- **Phase 3 — Productivity:** Todo + Kanban (dnd-kit).
- **Phase 4 — Knowledge & memory:** Wire Open WebUI knowledge per project; PDF ingest; lightweight memory; image input.
- **Phase 5 — Multimodal polish:** Clipboard quick-capture, screenshots, project hub linking.

---

## 5. Honest risks / constraints

- **12B capability ceiling:** weak at "quick prototype builder" and agentic coding — scope that as "Gemma drafts a spec, you hand it to Claude," not "Gemma builds the app."
- **Two surfaces:** Hybrid means the cockpit + Open WebUI are two windows. We make the cockpit home base and deep-link out, so it feels like one system.
- **Scope:** the full feature list is large; phasing above keeps it shippable.

---

## 6. Open questions before Phase 1

1. Open WebUI via **Docker** (cleaner) or **pip** (lighter)? — affects setup steps.
2. Want a one-command **launcher** (start Ollama + Open WebUI + cockpit together) from day one, or add later?
3. Confirm I should **start with Phase 0 + 1** now.
