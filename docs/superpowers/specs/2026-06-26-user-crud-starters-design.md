# User-CRUD-able starters for Quick Actions and Smart Inbox

Date: 2026-06-26

## Goal

Today's Quick Action examples (the "School bake sale" chip on *Reply to a message*) are hardcoded in `quickActions.ts` — one per action, authored by a developer, not editable. Make them **user-CRUD-able**: ship a set of standard starters people can edit, duplicate, and delete, plus a one-tap way to save the form they just filled as a new starter. The same system also fills the Smart Inbox empty state with editable capture chips. This serves the product vision directly — a non-technical user adjusts a ready-made starter to their needs instead of facing a blank form.

A "starter" is a labelled set of pre-fill values. Tapping its chip fills a form (and, for Quick Actions, runs it). It is not a prompt body or a `{{variable}}` template — it is concrete filled values bound to a code-defined target.

## Decisions reached (brainstorm + Codex design memo)

- **Editable seed.** Ship the standards as real, editable rows. Restoring shipped content is an explicit "Reset to defaults", never automatic.
- **Inline CRUD.** Manage starters where they are used — on the Quick Action runner and on the Smart Inbox page — not in a central manager or the Prompt Library.
- **Unified target.** One `Starter` model with a `target` discriminator powers both surfaces. A Quick Action starter targets an action id and carries that action's named inputs; an Inbox starter targets `"inbox"` and carries a single `text` field.
- **Focused seed coverage.** 2–3 starters on the ~6 highest-value everyday actions (reply-to-message, notes-to-list, plan-week, summarize, polite-message, meal-plan), one on the rest. Roughly 12–18 standard rows, plus ~3 Inbox starters (a meeting note, a list of to-dos, a quick fact to remember).

## Design

### Data model — new `Starter` model

```prisma
model Starter {
  id        String   @id @default(cuid())
  target    String   // a QuickAction id (e.g. "reply-to-message") or "inbox"
  label     String
  inputs    String   @default("{}") // JSON: field name -> value; inbox uses { "text": "…" }
  builtin   Boolean  @default(false) // a seeded standard vs a user-created starter
  order     Float    @default(0)     // stable display order
  sourceKey String?  @unique         // idempotent seed key; null for user rows
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([target])
}
```

Reusing `Prompt` or `Template` is the wrong fit: a starter would pollute the Prompt Library search/export and the `Template.kind` slug resolver for no gain. The columns mirror the repo's existing idempotent-seed pattern (`sourceKey` on Prompt/Task/Template, `order` on Task, `builtin` on Template). `target` is a plain string, not a relation — Quick Actions live in code, not the DB.

### Built-ins stay in code; the DB is additive

`EXAMPLES` in `quickActions.ts` is renamed `BUILTIN_STARTERS` and becomes a flat array, each entry carrying a stable `key` (its `sourceKey`):

```ts
type BuiltinStarter = { target: string; key: string; label: string; inputs: Record<string, string> };
export const BUILTIN_STARTERS: BuiltinStarter[] = [ … ];
```

The existing synchronous consumers keep working unchanged, because the code stays the source of truth for them:
- The module-load attach (`a.examples = …`) and `getFeaturedDemo()` read a map derived by grouping `BUILTIN_STARTERS` by `target`. The home `FeaturedDemo` renders server-side with zero DB dependency.
- The two unit tests (`every action has at least one example`, `the featured demo resolves`) keep passing because built-ins stay in code.

The DB is additive **for the runner and the Inbox only**: they fetch the live list and render it, falling back to the code built-ins while the fetch is in flight or if it fails, so chips appear instantly and never flash empty.

### Seeding — create-only, never clobbers an edit

A pure, unit-tested `buildStarterSeedPlan(BUILTIN_STARTERS)` produces rows `{ sourceKey: key, target, label, inputs: JSON.stringify(inputs), builtin: true, order }`. Applied two ways:
- `prisma/seed.mjs` runs it on `npm run db:seed` (fresh installs get the standards).
- `ensureBuiltinStarters()` runs it lazily on the first `GET /api/starters` **only when the Starter table is empty** (`count() === 0`), so a user who pulls the feature without re-seeding still gets the standards.

The upsert is **create-only — the `update` branch is a no-op**. This is the single most important rule: re-running the seed never overwrites a starter the user edited, echoing how the pack installer omits `status` so a reinstall never resets a moved task. Because `ensureBuiltinStarters` only fires on an empty table, a deleted standard stays deleted (it does not silently reappear on the next read).

Restoring shipped content is the explicit **`POST /api/starters/reset` `{ target }`**: delete the seeded rows for that target (`builtin: true`), then re-apply the plan for that target. User-created rows (`sourceKey: null`) are untouched. (Benign edge: deleting *every* starter returns the table to empty, so the next read re-seeds the standards — acceptable and recoverable.)

### API routes (mirror the prompts route pair)

- `GET /api/starters?target=…` — `ensureBuiltinStarters()`, then return the target's rows ordered by `order, createdAt`, with `inputs` parsed.
- `POST /api/starters` — create a user starter (`builtin: false`, `sourceKey: null`).
- `PATCH /api/starters/[id]` — edit `label` / `inputs` (allowed on built-in rows too — that is the "adjust on their needs" path).
- `DELETE /api/starters/[id]` — delete (built-in or user), P2025-idempotent like the sibling routes.
- `POST /api/starters/reset` — reset a target to defaults (above).

### Validation — keeps the tap-and-run promise

A pure `validateStarter(target, label, inputs)` returns errors or ok:
- `target` is a known `getQuickAction(target)` id **or** `"inbox"`; else reject.
- `label` non-empty, ≤ 100 chars.
- `inputs` is a JSON object of string→string, serialized ≤ 8 KB.
- Action target: `missingInputs(getQuickAction(target), inputs)` must be empty — guarantees the chip fills the required fields and runs, the same invariant the built-in test enforces.
- Inbox target: `inputs.text` is a non-empty string.

Orphaned rows (a target removed from code) are filtered at read, like `recentActions()` already drops unknown ids.

### Inline UI

A shared `StarterChips` component renders the chips plus the manage affordances; the edit surface is target-aware.

- **Quick Action runner** (`QuickActions.tsx`): the example row becomes DB-backed. Each chip keeps tap-to-fill-and-run; a manage toggle reveals a small edit (pencil) and delete (×) per chip. A **"Save current as starter"** button snapshots the live `values` and POSTs (prompts for a label). A group **"Reset to defaults"** sits behind a confirm. The edit dialog reuses the action's own input fields, prefilled.
- **Smart Inbox** (`InboxTool.tsx`): the empty state shows `target: "inbox"` starter chips; tapping fills the textarea with `inputs.text`. The same Save-current / edit / delete / reset, where the edit surface is a single text field.

## Out of scope (YAGNI)

- Project scoping — global only, matching the pack-install v1 decision. Starters are inherently per-target.
- Favorites, tags, search, drag-reorder UI on starters (keep the `order` column for a stable sort; no drag UI).
- Export/import of starters. Known gap: starters are not yet in `/api/export`; flag it, do not build it this round.
- Value-content validation beyond known-target + required-filled + JSON + size.

## Testing

- **Unit (pure):** `buildStarterSeedPlan` (unique keys, JSON-serialized inputs, stable order) and `validateStarter` (unknown target, missing required inputs, empty inbox text, size caps, good cases).
- **Route-mocked e2e:** chip appears → fill-and-run; Save-current-as-starter → new chip; edit a starter; delete; reset to defaults — on both the runner and the Inbox.
- **Live verify** on `gemma4:e4b`: edit "School bake sale", save a new starter from a filled form, run it, reset, and confirm an Inbox starter fills the textarea.
- `FeaturedDemo.tsx` and its tests stay untouched.

## Implementation checklist

1. Schema: add `Starter`; `npm run db:push`.
2. `quickActions.ts`: rename `EXAMPLES` → `BUILTIN_STARTERS` (flat, with `key`); derive the by-target map for the existing attach + `getFeaturedDemo()`; add the focused new seed content.
3. New `src/lib/starters.ts`: pure `buildStarterSeedPlan()` + `validateStarter()` + `parseInputs()` (unit-tested).
4. `prisma/seed.mjs`: call the seed (create-only upsert).
5. Routes: `api/starters/route.ts` (GET + POST + `ensureBuiltinStarters`), `api/starters/[id]/route.ts` (PATCH + DELETE), `api/starters/reset/route.ts`.
6. `StarterChips` component + wire into `QuickActions.tsx` and `InboxTool.tsx`.
7. Gate (lint, unit, e2e, build with `env -u NODE_ENV`) + live verify + Codex review. Note the `db:push`/`db:seed` step in CLAUDE.md.

## Risks and mitigations

1. **Re-seed clobbers a user edit** → create-only upsert (`update: {}`) + lazy seed only on an empty table + explicit Reset. (Highest risk; the core safety rule.)
2. **Featured-demo / test coupling** → built-ins stay in code as the synchronous source; the DB is additive for the runner/Inbox only; `FeaturedDemo` and its tests are untouched.
3. **Unrunnable user starter** → `validateStarter` rejects unknown targets and action starters that miss required inputs; orphans filtered at read.
