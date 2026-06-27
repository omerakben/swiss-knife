# Help-wizard chat bubble

Date: 2026-06-27

## Goal

A floating help bubble (bottom-right) that opens a chat panel — a local-Gemma assistant that is an expert on Haven Desk itself. It explains every tool, how to use it, with examples, and helps the user navigate (names the right tool for an intent and links to it). The product exists to help people who don't know how to use AI; an in-app guide that's an expert on the app closes that loop. Local-only, no cloud.

## Decisions reached (brainstorm + Codex design memo)

- **Explain + navigate, not act.** The wizard only reads and links — it never mutates the user's data. (A local 4B acting on data, with no gate, for the least-technical user, is the wrong place to spend the risk budget.)
- **Haven Desk expert that also answers general questions** — short helpful answer, then steers back to the app.
- **Grounded in the nav registry** (the one source of truth) so it can't reference a tool that doesn't exist, with a drift test.
- **Ephemeral conversation** — in-memory only, never persisted (privacy + no schema change).
- **Professional tools**: included in its knowledge but labeled advanced and down-ranked for everyday asks.

## Design

### UI — a non-modal floating panel

- `components/HelpWizard.tsx` (client) mounts globally in `app/layout.tsx`, beside `CommandPalette`/`Toaster`. A fixed bubble button bottom-right; clicking toggles a **non-modal** fixed Card panel (~380px wide, Intercom-style). Non-modal on purpose: the user reads an answer, clicks a tool chip, and navigates with the page still interactive — a modal Sheet would trap focus and dim the page, fighting the core flow.
- **Mobile**: the panel becomes a full-width bottom sheet, safe-area aware, clear of the existing top hamburger bar.
- **z-index**: above page content, below the command-palette Dialog and the Toaster.
- **State**: ephemeral `useState<{ role, content }[]>` — kept across open/close within the page session (the component stays mounted), gone on reload. No Prisma model, no `db:push`. Matches the palette's non-persisted `ask`.
- **Empty state**: a few static starter-question chips ("What can Haven Desk do?", "How do I turn meeting notes into tasks?", "Which tool writes an email?") that seed the first turn.
- **Streaming + latency**: an elapsed-seconds indicator ("Thinking… 8s") so a cold-4B first token reads as progress, not a hang. Render the panel body only when open.

### Grounding — `lib/wizard.ts` + `lib/manual.ts`

- `lib/wizard.ts` (pure, unit-tested):
  - `buildWizardSystemPrompt(): string` — composes a scope line + the **tool index derived from `NAV_ITEMS`** (label · href · desc · group · professional flag) as an explicit *closed* enumeration + the per-tool how-to/example from `lib/manual.ts` keyed by `href`. The prompt states: "These are the only tools that exist. Never mention a tool not on this list. If nothing fits, say so and suggest the closest. Prefer the everyday tools; the professional ones are advanced (QA & dev)." Plus: "You are the Haven Desk guide; for open-ended questions give a short answer, then point to Quick Actions or ⌘K Ask."
  - `suggestTools(text: string): NavItem[]` — scans the assistant message for `NAV_ITEMS` labels (word-boundary, case-insensitive, **longest-label-first** so "Email Writer" wins over "Email"), dedups, caps at 3, and **down-ranks `professional` items** unless the text/labels clearly match them. The match set *is* the registry, so a returned tool always exists.
- `lib/manual.ts` (pure data): a `Record<href, { howTo: string; examples: string[] }>` holding only what nav's `desc`/`keywords` don't — one how-to sentence + one or two concrete examples per everyday tool. Does not re-state `desc`.
- **Anti-hallucination (the #1 risk for a 4B), three layers**: the closed nav-derived list in the prompt; a low temperature (0.25); and the deterministic chip gate (chips only render for exact nav-label matches, so even if prose names a fake tool, no broken link appears).

### Endpoint — `POST /api/wizard` (streaming)

- `runtime = "nodejs"`, `dynamic = "force-dynamic"`. `assertOllamaReady()` health-gate first. Always the configured **light** chat model (`getEffectiveConfig().model`); never `qaModel`.
- Body `{ messages: { role, content }[] }`. Validate; **cap history server-side** to the last ~8 turns before composing (bounds the 4B's small context).
- Compose `[{ role: "system", content: buildWizardSystemPrompt() }, ...cappedHistory]` and return `streamTextResponse({ messages, injectMemory: false, temperature: 0.25 })`. **No memory injection** — the wizard is about the app, not the user's facts, and a big fact block on the light model is slow (the documented perf lesson). Inherits abort-on-disconnect and the `ERROR_SENTINEL` path.
- Stateless: history lives client-side, POSTed each turn. No server persistence.

### Navigation

The streamed answer renders as markdown (`Markdown.tsx`). Below it, an **"Open ___" chip row** from `suggestTools(answer)` — each chip carries the tool's icon and links to its `href` (a normal client navigation; deep-link params like `?run=` are a later nicety, not v1). One-click to the right tool. (Not `chatJson` structured suggestions — that can't stream and a 4B is shaky at on-demand link syntax.)

### Streaming consumer — `useWizardChat`

`hooks/useWizardChat.ts` — a multi-turn variant of `useAiTool`'s reader loop: holds the message list, appends a streaming assistant message token-by-token, splits on `ERROR_SENTINEL`, aborts the in-flight fetch on unmount or a new send. (`useAiTool` is single-shot — output is replaced each run — so a small dedicated hook is cleaner than bending it.)

## Out of scope (YAGNI)

- Action-execution (creating tasks/emails for the user). Navigate + link only.
- Arbitrary-text prefill on open (a read-only handoff is a clean follow-up; v1 just links).
- Persisting the conversation (in-memory only).
- RAG over a manual doc (the whole manual fits in the prompt for ~24 tools).
- Query-relevant manual injection (a later token-pressure lever; v1 includes the full manual).

## Testing

- **Unit (pure):** `buildWizardSystemPrompt` (includes every nav tool, marks professional ones, never lists a non-nav tool); `suggestTools` (the "Email Writer" vs "Email" longest-first case, dedup, cap, unknown-tool → none, professional down-rank); the **drift test** (every `lib/manual.ts` key is a real `NAV_ITEMS.href`; every non-professional nav item has a manual entry).
- **Route-mocked e2e:** the bubble opens the panel; a starter chip sends a turn (mock `/api/wizard` streaming text mentioning a tool) → the answer renders and an "Open <tool>" chip appears and links to the right href; the panel is non-modal (page still scrollable). The engine-down 503 shows the friendly message.
- **Live verify** on `gemma4:e4b`: ask "how do I turn meeting notes into tasks?" → it explains Meeting Notes with an example and offers an Open Meeting Notes chip; ask "which tool writes an email?" → routes to Email Writer; ask a general question → short answer + steer-back; ask "what's the QA Pipeline?" → explains the advanced tool; mobile bottom-sheet.

## Implementation checklist

1. `lib/manual.ts`: per-tool how-to + examples for the everyday tools (+ short notes for professional ones).
2. `lib/wizard.ts`: pure `buildWizardSystemPrompt()` + `suggestTools()`; unit tests incl. the drift test.
3. `app/api/wizard/route.ts`: streaming endpoint (health-gate, cap history, manual system prompt, `injectMemory:false`).
4. `hooks/useWizardChat.ts`: multi-turn streaming consumer.
5. `components/HelpWizard.tsx`: bubble + non-modal panel + chat + starter chips + suggested-tool chips; mount in `app/layout.tsx`.
6. e2e + live verify + Codex review + CLAUDE.md note. Gate each step (`env -u NODE_ENV`: lint, unit, e2e, build).

## Risks and mitigations

1. **Hallucinated or stale tools** (top risk for a 4B) → the grounding stack: nav-derived closed list + low temp + the deterministic chip gate; the drift test keeps the manual honest as tools change.
2. **Manual drift from the real tool set** (fast-moving repo) → derive the list from `NAV_ITEMS`; the unit test fails when `lib/manual.ts` and nav disagree.
3. **Cold-4B latency vs a chat bubble's "instant" feel** → streaming, the elapsed-seconds indicator, the friendly `assertOllamaReady()` 503, light-model-only, capped history; starters set expectations on the empty state.
