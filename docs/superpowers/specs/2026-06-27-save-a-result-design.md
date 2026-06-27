# Save a Quick Action result

Date: 2026-06-27

## Goal

A Quick Action result is just text today — Copy or Export. The everyday next step is to *act on it*: turn a "turn notes into a to-do list" or "plan my week" result into real Tasks, and keep any result as a note. This generalizes the Meeting Notes magic (text → reviewed Task records) and closes the loop after the result + the one-tap refine. Aligned with the vision: one tap turns a result into something durable.

## Decisions reached (brainstorm + Codex design memo)

- **Two saves on the runner result**, under the refine "Make it:" row.
- **Save as note** on every result; **Save as tasks** only on curated list/plan actions.
- **Review, then add** for tasks — reuse the Meeting Notes safe flow (a local 4B mis-splits lists; nothing lands until the user confirms).
- **Save never re-runs the model** — note save persists the existing result verbatim; the model only runs to *extract* tasks.
- **Share at the lib layer**, with the deterministic `gateMeetingTasks` kept byte-identical.

## Design

### Where it lives

A new thin component `components/tools/ResultSaveActions.tsx` (props: `text: string`, `action: QuickAction`) renders the two save buttons and owns their dialogs/toasts/busy state. It mounts as a one-liner in the runner result area (`QuickActions.tsx`, beside the refine row, rendered when `status === "done" && output`), so `QuickActions.tsx` grows by one element. The result `text` is snapshotted at click time (a refine may still be streaming).

### Save as note (every result)

One tap → `POST /api/ideas` (existing) with:
- `content` = the result verbatim (no model call).
- `title` = a deterministic derivation: the first markdown heading, else the first line if it is short and heading-like (≤ ~80 chars), else `action.title` (e.g. "Plan my week"). Pure helper `deriveNoteTitle(text, fallback)`, unit-tested.

Disabled when `!text`. After success the button flips to "Saved ✓" briefly (guards a double-fire). Toast "Saved · Open" linking to where ideas surface; an Undo (DELETE `/api/ideas/[id]`) is a cheap bonus mirroring quick-add.

### Save as tasks (flagged actions only)

`QuickAction` gains `canSaveTasks?: boolean`, set on **notes-to-list, find-action-items, plan-week, study-plan**. Excluded on purpose: packing-list and meal-plan (checklists; 20 packing items as Kanban cards is junk — they save as a note), and every prose action (a reply/summary has ~no action items).

Flow when the button shows:
1. Extract: `POST /api/result-tasks { text }` → `extractTasksFromText` → `{ tasks: DraftTask[], dropped }`. Shows an elapsed/loading state (the 4B pass takes a beat).
2. If `tasks.length === 0`: no dialog — a friendly toast "No clear to-dos found — save as a note instead?" (offering the note path), never an error or empty dialog.
3. Otherwise open a compact review dialog using the shared `DraftTaskReview` (every row checked by default, per-row keep/uncheck + edit title + owner/due chips) with a prominent "Add N tasks".
4. Add: `POST /api/result-tasks { create: DraftTask[] }` → `createDraftTasks(...)` → transactional Task rows. Toast "Added N tasks · Open Tasks".

### Shared libs

- `extractTasksFromText(text, cfg): Promise<GateResult>` (in `lib/meetingNotes.ts`, the task-extraction home): a `chatJson` call with a **neutral** system prompt — "Read this text and list any action items as tasks. Ignore section headers and grouping; a short imperative title each, an owner only if a person is clearly named, a due phrase only if stated. Don't invent tasks, owners, or dates." — plus the **existing SCHEMA**, returning `gateMeetingTasks(raw)`. The "ignore section headers" clause matters for grouped results (Plan my week's Must do / Should do).
- `gateMeetingTasks` — unchanged, the shared deterministic gate (trims, dedupes, caps at 25, resolves due phrases). The safety net between a 4B and real records.
- `createDraftTasks(drafts: DraftTask[], projectId: string | null, source: string): Promise<number>` (in `lib/meetingNotes.ts` or a sibling): the transactional `prisma.task.create` batch + a **parameterized** `logActivity` summary (`from a quick action` vs `from meeting notes`). The Meeting Notes route delegates its `{create}` branch to this (pure-DB, safe).
- `DraftTaskReview` (`components/tasks/DraftTaskReview.tsx`): the checkbox + editable-title + owner/due-chip row list lifted from `meeting-notes/page.tsx`. Meeting Notes becomes a consumer (its inline layout stays; only the list swaps) — the real DRY win, de-bloating both surfaces.

### New endpoint

`POST /api/result-tasks` (neutral provenance — not the meeting-notes route, which would log "from meeting notes" and couple the runner to a tool):
- `{ text }` → health-gate, cap `text` at 80k chars (413 over, matching the refine guard), `extractTasksFromText` → `{ tasks, dropped }`.
- `{ create: DraftTask[] }` → `createDraftTasks(create, activeProjectId, "a quick action")` → `{ created }`. No model call.

### Project scoping

Automatic: the server resolves `getActiveProjectId()` for both the idea and the tasks (no client prop, no picker). Saved items land in the active project, global when there is none.

## Out of scope (YAGNI)

- A project picker in the dialog; "save as tasks AND note" in one tap; per-task priority/scheduling beyond what `DraftTaskReview` already offers.
- Unifying the Meeting Notes *extract* prompt with the neutral one — its meeting-specific prompt stays this round (avoids a regression); only the *create* path and the review *component* are shared now. Documented follow-up.
- Server-side dedupe of notes (saving twice can be intentional; the ideas route has none).

## Testing

- **Unit (pure):** `deriveNoteTitle` (heading, short first line, fallback, empty); the `canSaveTasks` flag set (exactly the four actions); `extractTasksFromText`/`createDraftTasks` lean on the already-tested `gateMeetingTasks`.
- **Route-mocked e2e:** Save as note adds an idea (mock `/api/ideas`); Save as tasks → extract (mock `/api/result-tasks` GET-shape) → review dialog → Add (mock create); the 0-task note-fallback toast; the button only shows on a flagged action.
- **Live verify** on `gemma4:e4b`: a *Plan my week* result → Save as tasks → review → tasks land in the board (grouped headings not turned into tasks); a reply result → Save as note → appears in ideas; a flagged result with no to-dos → the note-fallback toast.
- Meeting Notes is re-verified after it adopts `DraftTaskReview` + `createDraftTasks` (its own flow still extracts and adds).

## Implementation checklist

1. `lib/meetingNotes.ts`: add `extractTasksFromText` (neutral prompt + SCHEMA + gate) and `createDraftTasks` (transactional create + parameterized log); export `DraftTask`/`GateResult` as needed.
2. `lib/quickActions.ts`: add `canSaveTasks?: boolean` to `QuickAction`; set it on notes-to-list, find-action-items, plan-week, study-plan.
3. `lib/resultTitle.ts` (or in quickActions): pure `deriveNoteTitle(text, fallback)` + unit tests.
4. `components/tasks/DraftTaskReview.tsx`: extract from the Meeting Notes page; rewire Meeting Notes to consume it.
5. `app/api/result-tasks/route.ts`: extract + create (caps, health-gate, delegate to the libs).
6. `app/api/meeting-notes/route.ts`: delegate its `{create}` branch to `createDraftTasks` (no behavior change).
7. `components/tools/ResultSaveActions.tsx`: the two buttons + the extract→review dialog + note save; mount in `QuickActions.tsx`.
8. e2e + live verify + Codex review + CLAUDE.md note. Gate each step (`env -u NODE_ENV`: lint, unit, e2e, build).

## Risks and mitigations

1. **Junk tasks from a 4B mis-splitting a grouped list** → review-then-Add + the unchanged gate + the "ignore section headers" prompt clause. No one-tap create-all.
2. **Confusing empty extraction** → the button is flag-gated to list/plan producers, and a 0-task result is a friendly note-fallback toast, never an error or empty dialog.
3. **Meeting Notes regression** → share only the *create* path and the review *component* (no prompt change to Meeting Notes); keep `gateMeetingTasks` byte-identical; re-verify Meeting Notes after it adopts the shared pieces. "Save as note" is a pure verbatim write (no model re-run).
