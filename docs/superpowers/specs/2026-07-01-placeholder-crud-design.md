# Editable tool placeholders (ToolHint) — design

Date: 2026-07-01 · Status: approved (Claude + Codex debate, maintainer mandate)
Parent goal: `2026-07-01-starter-crud-next-session-goal-prompt.md` item 2.

## Problem

Haven Desk is a personalization tool. Tap-to-fill starter chips and prompt
templates are fully user-CRUD-able, but the grey `placeholder="e.g. …"` hint
texts inside input boxes are still hardcoded strings. The maintainer's mandate:
every hardcoded starter chip AND placeholder must be user-editable.

Hint sites (final scope after the 58-agent audit, 2026-07-01). Static keys:

| Key | Component | Field |
| --- | --- | --- |
| `tasks-goal` | `tasks/TaskAiTools.tsx` | goal box |
| `prompt-template-body` | `library/PromptLibrary.tsx` | template body |
| `qa-refine` | `qa/QaSessionView.tsx` | follow-up instruction |
| `eval-cases-spec` | `eval/EvalCaseGenerator.tsx` | spec box |
| `bug-report` | `tools/BugReportTool.tsx` | rough notes |
| `rubric-designer` | `rubric/RubricDesigner.tsx` | bar description |
| `api-contract` | `api-contract/ApiContractDesigner.tsx` | prose/spec box |
| `email-brief` | `email/EmailWriter.tsx` | brief box |
| `adr-note` | `adr/AdrWriter.tsx` | decision note box |
| `memory-relevance-preview` | `memory/MemoryManager.tsx` | relevance preview query |

Generated keys: every Quick Action input field with a placeholder gets
`quick-action:<actionId>:<fieldName>` (derived from `QUICK_ACTIONS` at module
load — ~40 strings, e.g. "e.g. say yes, but ask to move it to Friday"). They
all render through one generic field loop in `QuickActions.tsx`, so one wiring
site covers every action.

Out of scope (deliberate leaves): `SettingsForm` model-tag hints and
`ProjectHubEditor`'s OWUI URL (config guidance, not examples), `PersonaPicker`
cards (onboarding structure, not input fills), instructional placeholders
("Paste the email you received…", "Paste a user story…", "Search…", "Name",
"Optional"), and seeding a default *input value* on load (changes run
semantics — `canSave`, ⌘Enter, empty-state e2e; deliberately deferred, the key
format leaves room for an `initial:` prefix later).

Companion findings shipped alongside (item 1 of the parent goal, separate
commits): Gherkin Lint and QA Pipeline "Load example" buttons convert to the
Starter system (`gherkin-lint` / `qa-story` single-text targets), and
`FeaturedDemo` switches from the code copy of the reply-to-message example to
the live first starter (code copy stays as the loading/empty fallback) so home
reflects user edits.

## Decision

Option (d): a tiny generic key-value model with a code registry as the
deterministic gate.

Rejected alternatives:

- **(b) reuse `Starter`**: `validateStarter` gates every write on a *runnable*
  payload — hint text is not runnable and would need a `kind` bypass that
  weakens the invariant. Worse, the per-target lazy seed is gated on
  `count(target) > 0`, so a hint row sharing a target namespace would suppress
  future chip seeding for that target. And 7 of the 8 tools have no starter
  target — we'd mint pseudo-targets to render a full chips panel where a
  pencil belongs.
- **(a) `ToolPref { toolId unique, placeholder }`**: EmailWriter has two
  placeholder fields on one page, so one-row-per-tool is wrong on day one.
  Fixed, (a) becomes (d) with a rigid single-purpose column.

## Design

**Schema** (`prisma/schema.prisma`, needs `npm run db:push`):

```prisma
model ToolHint {
  id        String   @id @default(cuid())
  key       String   @unique // e.g. "email-brief" — must exist in PLACEHOLDER_DEFAULTS
  text      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Registry + gate** (`src/lib/toolHints.ts`, pure, unit-tested):
`PLACEHOLDER_DEFAULTS: Record<string, string>` holds every key and its shipped
default (the exact strings in the components today, moved, not rewritten).
`validateHint(key, text)` rejects unknown keys (400), caps length (300 chars),
requires string. Single-line keys strip newlines (all current sites are
textareas, but the gate is written per-key-agnostic with a shared cap).

**API** (`src/app/api/tool-hints/route.ts`):

- `GET` → `{ hints: { [key]: text } }` — bulk, overrides only (< 20 rows).
- `PUT { key, text }` → upsert; empty/whitespace `text` deletes the row
  (empty-on-save = reset — one affordance, one meaning).
- No per-key GET, no DELETE verb needed.

**Client** (`src/hooks/useToolHints.ts` + `src/components/EditHintButton.tsx`):
`usePlaceholder(key)` returns the effective placeholder — code default
immediately (synchronous first render, so the 61 `getByPlaceholder` e2e
selectors stay green on an empty DB), the override after one shared bulk fetch
(module-level cache: a page with 3 fields makes 1 request). `EditHintButton`
is a small pencil icon button rendered beside the field's `<Label>`; it opens
a dialog with a textarea prefilled with the effective placeholder, Save and
"Reset to default" buttons, toast on result, and refreshes the shared cache.

**Wiring**: each site replaces its literal with `usePlaceholder("<key>")` and
adds `<EditHintButton hintKey="<key>" />` next to its label. Tools built on
`AiToolShell` get an optional `hintKey` prop on the shell (renders the pencil
next to its own label and resolves the placeholder internally) if the audit
confirms any shell tool has a hint-type placeholder.

**Backups**: `toolHint.findMany` in `/api/export`, upsert-by-key in
`/api/import` — the `backupCoverage.test.ts` tripwire enforces this.

**Security/perf**: placeholder is a React-escaped attribute (no XSS path);
local-only route, no auth change; table is tiny, no index needed beyond
`@unique`.

## Testing

- Unit: `toolHints.test.ts` — every registry key non-empty and ≤ cap; validate
  rejects unknown key / oversize / non-string; a drift test asserting every
  `usePlaceholder("…")` / `hintKey="…"` literal in `src/` resolves to a
  registry key (grep-based, same style as `manual.ts`'s nav drift test).
- e2e (route-mocked, hermetic): one new spec — mock `GET /api/tool-hints`
  with an override and assert the input shows it; mock the PUT and exercise
  the pencil dialog Save + Reset paths.
- Existing e2e: unaffected on an empty DB (default-first render). Specs run
  against the maintainer's dev DB, so the new spec mocks the GET to `{}` where
  it asserts defaults.

## Rollout

One gated commit (schema + lib + API + hook + button + 9 wirings + backup
coverage + tests), `npm run db:push` note in CLAUDE.md. Estimated ~350 LOC net.
