# Refine — the AHA idea-discussion coach (design)

Date: 2026-07-01
Status: built

## The ask (maintainer)

Integrate the **AHA framework** (github.com/omerakben/aha — "Aligned Human-AI", a
prompting kit the maintainer uses daily) into Haven Desk, and add a **Refinement**
concept: "interview me" / "ask me questions" — an idea-discussion tool that acts
like a product manager to explore edge cases and flesh out a fuzzy idea. Keep it
**simple, easy, a minimum fraction** — "Brainstorm Kit" + "Prompt Refine" in an
idea-discussion style.

## The insight

AHA is already exactly this. Its five standalone skills map onto the request:

| AHA skill        | What it does                                             | Haven Desk lens |
| ---------------- | ------------------------------------------------------- | --------------- |
| `ask-me`         | 3-5 leverage-ranked clarifying questions, no solving     | **Interview me** |
| `align-me`       | restate + assumptions + unknowns + confidence            | **Align**        |
| `critique-this`  | steelman, then adversarial with fixes + highest leverage | **Critique**     |
| `optimize-prompt`| rough ask → a crisp standalone brief/spec                | **Sharpen**      |

So "Brainstorm Kit" = the four lenses; "Prompt Refine" = the multi-turn
conversation that runs them. One new surface, not three — the minimum fraction.

## Design decisions

- **One tool, four lenses.** `/tools/refine`. The lenses are one-click chips. The
  chosen lens is the system prompt for the next turn, so a person can go
  ask → critique → sharpen non-linearly (the AHA pipeline, made one-click).
- **Ported, not imported.** The AHA skills are Cursor/Claude-Code prompts for a
  frontier model. Re-authored for the local 4B (`gemma4:e4b`): explicit rules +
  a fixed output shape (the everyday prompt-kit reliability lesson), plain
  language, a product-manager framing for everyday ideas rather than agent tasks.
  Lives in `lib/refine.ts` (pure, unit-tested); the streaming route rebuilds the
  system prompt from the lens id each turn (`buildRefineSystem`), with a
  `getRefineMode` fallback so an unknown/absent lens degrades to Interview.
- **Reuses the proven chat spine.** Same shape as the Help Wizard:
  `useRefineChat` (multi-turn streaming consumer, aborts on unmount) →
  `POST /api/refine/chat` (health-gated, history capped, `streamTextResponse`).
  `injectMemory:false` — Refine reasons about the idea being typed, not stored
  facts, and a fact block slows the 4B (the documented perf lesson).
- **Local-first, unchanged.** No new network path, no persistence of the chat
  (ephemeral, like the wizard). The only writes are user-initiated: **Save as
  note** (an Idea, verbatim) and **Turn into tasks** (the shared
  `ExtractTasksButton`).
- **Safety.** A shared HOUSE block (never invent facts, plain language, don't pose
  as a lawyer/doctor/accountant) is appended to every lens — mirrors the everyday
  prompt kit's `HOUSE_RULES`.

## Wiring

- `nav.tsx` (Write group) + `manual.ts` (so the Help Wizard can point at it; the
  drift test requires it).
- Dashboard card + ⌘K search are derived from the nav registry automatically.

## Verification

lint · 409 unit (incl. `refine.test.ts`) · build · 99 e2e (incl. a route-mocked
`refine-tool.spec.ts`: start an idea → one-click lens switch → save the answer).
Live model verification is on the maintainer's machine (this build environment has
no Ollama; the route returns the graceful 503 health-gate as designed).

## Deliberately deferred (keep it simple)

- Editable example ideas via the `Starter` system (inline examples for v1).
- Memory injection / project scope on the coach.
- Saving the whole transcript (only the latest answer is saveable).
- An installable "AHA pack" (the lenses are built-in, always available).
