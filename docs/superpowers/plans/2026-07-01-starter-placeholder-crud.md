# Starter + placeholder CRUD sweep — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every remaining hardcoded starter chip and every content-bearing placeholder hint in Haven Desk becomes user-CRUD-able.

**Architecture:** Two mechanisms. (1) The existing `Starter` system absorbs the two remaining hardcoded "Load example" buttons (Gherkin Lint, QA Pipeline) as new single-text targets, and `FeaturedDemo` switches to the live starter list. (2) A new tiny `ToolHint` key-value model (code registry = deterministic gate, code default = synchronous fallback) makes placeholder hints editable via a shared `usePlaceholder` hook + `EditHintButton` pencil.

**Tech Stack:** Next.js 15 App Router, Prisma + SQLite, Vitest, Playwright. All commands run from `cockpit/`. Build/gates prefixed `env -u NODE_ENV`.

## Global constraints

- Spec: `docs/superpowers/specs/2026-07-01-placeholder-crud-design.md` (approved).
- Shipped default strings MOVE verbatim — never reworded.
- Every model write path has a deterministic gate; unknown hint keys are 400s.
- New Prisma model ⇒ `/api/export` + `/api/import` coverage (`backupCoverage.test.ts` tripwire) and a `npm run db:push` note in CLAUDE.md.
- e2e that assert an editable string must route-mock the API that serves it.
- Gate after each task: `env -u NODE_ENV npm run lint && env -u NODE_ENV npm run test:unit && env -u NODE_ENV npm run build && env -u NODE_ENV npm run test:e2e`.
- One commit per task, conventional message.

---

### Task 1: Gherkin Lint + QA Pipeline "Load example" → Starter system

**Files:**
- Modify: `src/lib/quickActions.ts` (targets ~line 37, `TEXT_STARTER_TARGETS` ~line 41, `BUILTIN_STARTERS` tail ~line 500)
- Modify: `src/components/gherkin/GherkinLinter.tsx` (delete `EXAMPLE` lines 19–28, replace button lines 90–99)
- Modify: `src/components/qa/QaPipeline.tsx` (delete `EXAMPLE` lines 28–29, replace button lines 358–367)
- Test: `src/lib/starters.test.ts` (single-text invariant, line 50)

**Interfaces:**
- Produces: `GHERKIN_TARGET = "gherkin-lint"`, `QA_STORY_TARGET = "qa-story"` exported from `lib/quickActions.ts`, members of `TEXT_STARTER_TARGETS`.

- [ ] **Step 1: Extend the single-text invariant test (fails first)**

In `src/lib/starters.test.ts` add `GHERKIN_TARGET, QA_STORY_TARGET` to the import from `./quickActions` and to the target list at line 50. Run `env -u NODE_ENV npm run test:unit -- starters` — FAIL (unknown exports).

- [ ] **Step 2: Add targets + built-ins**

In `src/lib/quickActions.ts` after `PROJECTS_TARGET`:

```ts
export const GHERKIN_TARGET = "gherkin-lint";
export const QA_STORY_TARGET = "qa-story";
```

Append both to `TEXT_STARTER_TARGETS`. Append to `BUILTIN_STARTERS` (texts copied verbatim from the deleted component constants):

```ts
  { target: GHERKIN_TARGET, key: "gherkin:pos-cash-sale", label: "POS cash sale .feature",
    inputs: { [INBOX_FIELD]: `Feature: Point of Sale — cash sale\n  A walk-in customer buys in-stock items and pays cash.\n\n  @valid @smoke @ui\n  Scenario: a completed cash sale prints a receipt\n    Given an open Cash Drawer [drawer]\n    And a Cart [cart] holding one in-stock item\n    When the cashier tenders the exact cash amount\n    Then the sale is invoiced against [drawer]\n    And a receipt prints for [cart]` } },

  { target: QA_STORY_TARGET, key: "qa-story:tax-exempt-sale", label: "Tax-exempt POS sale",
    inputs: { [INBOX_FIELD]: `As a cashier, I want to make a walk-in cash sale of in-stock items tax-exempt at the point of sale, so a tax-exempt customer is charged correctly.\nThe sale must record the tax-exemption reason, and an over-tender must return the right change.` } },
```

- [ ] **Step 3: Replace the Gherkin "Load example" button with StarterChips**

Delete the `EXAMPLE` const and the outline Button. Below the button row add:

```tsx
<StarterChips
  target={GHERKIN_TARGET}
  fallback={builtinStartersFor(GHERKIN_TARGET)}
  current={{ [INBOX_FIELD]: text }}
  onPick={(inputs) => { setText(inputs[INBOX_FIELD] ?? ""); setResult(null); }}
  editFields={[{ name: INBOX_FIELD, label: "Feature text", type: "textarea" }]}
  headline="Try an example — tap to fill:"
/>
```

(imports: `StarterChips`, and `GHERKIN_TARGET, INBOX_FIELD, builtinStartersFor` from `@/lib/quickActions`).

- [ ] **Step 4: Same for QA Pipeline story box**

`onPick` sets `setInput(inputs[INBOX_FIELD] ?? "")` and `setNeedsPack(false)`; `editFields` label "User story"; headline "Try an example — tap to fill:". Delete its `EXAMPLE` const + button.

- [ ] **Step 5: Gate + commit** — `feat(starters): gherkin-lint and qa-story Load-example become editable starters`

### Task 2: FeaturedDemo reads live starters

**Files:**
- Modify: `src/components/FeaturedDemo.tsx`
- Check: `grep -rn "bake sale" e2e/` — if a spec asserts the demo copy, add a `/api/starters**` route mock returning one `reply-to-message` starter.

**Interfaces:**
- Consumes: `GET /api/starters?target=reply-to-message` (lazy-seeds, so ≥1 row always returns).

- [ ] **Step 1: Fetch the live first starter, fall back to the code copy**

```tsx
const [live, setLive] = useState<QuickActionExample | null>(null);
useEffect(() => {
  let cancelled = false;
  fetch(`/api/starters?target=${FEATURED_DEMO.actionId}`)
    .then((r) => r.json())
    .then((d) => {
      const s = Array.isArray(d.starters) ? d.starters[0] : null;
      if (!cancelled && s && s.inputs) setLive({ label: s.label, inputs: s.inputs });
    })
    .catch(() => {});
  return () => { cancelled = true; };
}, []);
// …
const example = live ?? demo.example;
```

(`FEATURED_DEMO` + `QuickActionExample` are exported from `lib/quickActions.ts`; `seeItWork` and the input preview switch to `example`.)

- [ ] **Step 2: Gate + commit** — `feat(home): FeaturedDemo runs the live first starter, not the code copy`

### Task 3: ToolHint core (schema, registry gate, API, hook, pencil, backups)

**Files:**
- Modify: `prisma/schema.prisma` (+ `npm run db:push`)
- Create: `src/lib/toolHints.ts`, `src/lib/toolHints.test.ts`
- Create: `src/app/api/tool-hints/route.ts`
- Create: `src/hooks/useToolHints.ts`
- Create: `src/components/EditHintButton.tsx`
- Modify: `src/app/api/export/route.ts`, `src/app/api/import/route.ts`

**Interfaces:**
- Produces: `PLACEHOLDER_DEFAULTS`, `MAX_HINT = 300`, `validateHint(key, text)`, `quickActionHintKey(actionId, field)` from `lib/toolHints`; `usePlaceholder(key): string` + `refreshToolHints()` from `hooks/useToolHints`; `<EditHintButton hintKey label />`.

- [ ] **Step 1: Failing unit tests** (`src/lib/toolHints.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { MAX_HINT, PLACEHOLDER_DEFAULTS, quickActionHintKey, validateHint } from "./toolHints";
import { QUICK_ACTIONS } from "./quickActions";

describe("toolHints registry", () => {
  it("every default is non-empty and within the cap", () => {
    for (const [k, v] of Object.entries(PLACEHOLDER_DEFAULTS)) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(v.length, k).toBeLessThanOrEqual(MAX_HINT);
    }
  });
  it("covers every quick-action input that ships a placeholder", () => {
    for (const a of QUICK_ACTIONS) for (const inp of a.inputs) {
      if (inp.placeholder) expect(PLACEHOLDER_DEFAULTS[quickActionHintKey(a.id, inp.name)]).toBe(inp.placeholder);
    }
  });
  it("gates writes: unknown key, oversize, non-string", () => {
    expect(validateHint("no-such-key", "x").ok).toBe(false);
    expect(validateHint("email-brief", "x".repeat(MAX_HINT + 1)).ok).toBe(false);
    expect(validateHint("email-brief", 5 as unknown as string).ok).toBe(false);
    expect(validateHint("email-brief", "custom hint").ok).toBe(true);
  });
});
```

Plus a drift test scanning `src/` (readdirSync recursive) for `usePlaceholder("…")` / `hintKey="…"` literals, asserting each key exists in `PLACEHOLDER_DEFAULTS` (same style as the manual/nav drift test).

- [ ] **Step 2: Registry + gate** (`src/lib/toolHints.ts`) — static defaults are the 10 component strings moved verbatim; generated defaults from `QUICK_ACTIONS`:

```ts
import { QUICK_ACTIONS } from "./quickActions";

export const MAX_HINT = 300;
export const quickActionHintKey = (actionId: string, field: string) => `quick-action:${actionId}:${field}`;

const STATIC_DEFAULTS: Record<string, string> = {
  "tasks-goal": "e.g. Prepare and ship the Q3 launch announcement",
  "prompt-template-body": "e.g. Summarize {{text}} into {{count}} bullet points.",
  "qa-refine": "e.g. add a boundary case for a special order with a 50% deposit…",
  "eval-cases-spec": "Paste the spec or rule being tested, e.g. “Tax-exempt sales require a valid exemption certificate on file; the cashier must…”",
  "bug-report": "e.g. POS partial ROA payment errors when amount is less than balance — should accept and apply oldest-invoice-first…",
  "rubric-designer": "What artifact is being judged, and what separates good from bad? e.g. “API error responses: actionable message, right status code, no internals leaked…”",
  "api-contract": 'e.g. "An endpoint to list a project\'s invoices with filtering by status, plus fetching one invoice by id" — or paste an openapi: 3.1.0 document',
  "email-brief": "e.g. Ask for a 2-day extension on the report, apologize for the delay, propose Thursday.",
  "adr-note": "Describe the decision: the problem, the options you weighed, what you picked and why…",
  "memory-relevance-preview": "e.g. Write a Gherkin scenario for a tax-exempt POS sale",
};

const generated: Record<string, string> = {};
for (const a of QUICK_ACTIONS) for (const inp of a.inputs) {
  if (inp.placeholder) generated[quickActionHintKey(a.id, inp.name)] = inp.placeholder;
}
export const PLACEHOLDER_DEFAULTS: Record<string, string> = { ...generated, ...STATIC_DEFAULTS };

export type HintValidation = { ok: boolean; error?: string };
export function validateHint(key: string, text: string): HintValidation {
  if (!(key in PLACEHOLDER_DEFAULTS)) return { ok: false, error: "Unknown hint." };
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "The hint needs some text." };
  if (text.length > MAX_HINT) return { ok: false, error: "That hint is too long." };
  return { ok: true };
}
```

- [ ] **Step 3: Schema + push**

```prisma
model ToolHint {
  id        String   @id @default(cuid())
  key       String   @unique // must exist in PLACEHOLDER_DEFAULTS (lib/toolHints.ts)
  text      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Run `npm run db:push`.

- [ ] **Step 4: API** (`src/app/api/tool-hints/route.ts`) — GET returns `{ hints: {key: text} }` (known keys only); PUT `{ key, text }`: unknown key → 400; empty/whitespace text → `deleteMany({ where: { key } })` and return `{ key, text: PLACEHOLDER_DEFAULTS[key], reset: true }`; else `validateHint` → upsert → `{ key, text }`. `runtime = "nodejs"`, `dynamic = "force-dynamic"`.

- [ ] **Step 5: Hook** (`src/hooks/useToolHints.ts`) — module-level store (`useSyncExternalStore`, same idiom as `usePersisted`/`useIsMac`): one shared bulk GET on first subscribe, `overrides[key] ?? PLACEHOLDER_DEFAULTS[key] ?? ""` snapshot (server snapshot = default, so first paint and `getByPlaceholder` e2e stay deterministic), exported `refreshToolHints()` re-fetches and notifies.

- [ ] **Step 6: Pencil** (`src/components/EditHintButton.tsx`) — ghost icon Button (Pencil, `h-3.5 w-3.5`, muted) + Dialog: Label "Hint text", Textarea prefilled with the effective placeholder, description "This is the grey example text shown in the box before you type. Make it yours."; Save → PUT + `refreshToolHints()` + toast "Hint updated"; "Reset to default" → PUT empty + toast "Hint reset". `aria-label={\`Edit hint: ${label}\`}`.

- [ ] **Step 7: Backups** — export: add `prisma.toolHint.findMany()` → `toolHints` field + count. Import: upsert by `key` (like the starters' `sourceKey` branch, so cross-machine imports don't duplicate), counting `{ok,failed}` into `imported.toolHints`/`skipped.toolHints`.

- [ ] **Step 8: Gate + commit** — `feat(hints): ToolHint model + registry gate + API + usePlaceholder + EditHintButton`

### Task 4: Wire the sites

**Files:**
- Modify (static keys): `tasks/TaskAiTools.tsx:75`, `library/PromptLibrary.tsx:588`, `qa/QaSessionView.tsx:226`, `eval/EvalCaseGenerator.tsx:147`, `tools/BugReportTool.tsx:110`, `rubric/RubricDesigner.tsx:133`, `api-contract/ApiContractDesigner.tsx:71`, `email/EmailWriter.tsx:181`, `adr/AdrWriter.tsx:161`, `memory/MemoryManager.tsx:572`
- Modify (generated keys): `components/QuickActions.tsx` field loop (~line 240)

**Interfaces:**
- Consumes: `usePlaceholder`, `EditHintButton`, `quickActionHintKey`.

- [ ] **Step 1: Canonical wiring (EmailWriter shown; repeat per site with its key)**

```tsx
const briefPlaceholder = usePlaceholder("email-brief");
// label row:
<div className="flex items-center gap-1">
  <Label htmlFor="brief">Brief — what should it say?</Label>
  <EditHintButton hintKey="email-brief" label="Brief" />
</div>
// field:
<VoiceTextarea … placeholder={briefPlaceholder} />
```

Sites without a `<Label>` (AdrWriter, GherkinLinter-style boxes) right-align the pencil above the box. Hooks go at component top level — for `QaSessionView`/`PromptLibrary` the call sites are inside the component body already.

- [ ] **Step 2: QuickActions generic loop** — one hook call for the whole map is impossible per-field; instead `usePlaceholder` is called in a tiny `HintedField` wrapper or the loop reads from a `useToolHints()` bulk variant. Implement `useToolHintOverrides(): Record<string,string>` in the same hook module (same store, returns the overrides map) and in the loop: `placeholder={overrides[quickActionHintKey(active.id, inp.name)] ?? inp.placeholder}` + `<EditHintButton hintKey={quickActionHintKey(active.id, inp.name)} label={inp.label} />` beside each field label.

- [ ] **Step 3: Gate + commit** — `feat(hints): every placeholder hint is editable (10 tools + all Quick Action fields)`

### Task 5: e2e — new spec + hermeticity mocks

**Files:**
- Create: `e2e/tool-hints.spec.ts`
- Modify: `e2e/memory-loop.spec.ts`, `e2e/rubric-designer.spec.ts`, `e2e/api-contract.spec.ts`, `e2e/adr.spec.ts`, `e2e/save-result.spec.ts` (+ any spec `grep -l getByPlaceholder` whose string is now hint-backed): add `await page.route("**/api/tool-hints", (r) => r.fulfill({ contentType: "application/json", body: '{"hints":{}}' }))` in their setup so a locally-edited hint can't break the suite.

- [ ] **Step 1: New spec** — (1) mock GET `{"hints":{"email-brief":"CUSTOM HINT"}}` → `/tools/email` brief textarea has placeholder CUSTOM HINT; (2) pencil dialog → type → Save → assert PUT body `{key:"email-brief", text:"…"}` (route-captured) + dialog closes; (3) Reset sends empty text.
- [ ] **Step 2: Gate + commit** — `test(e2e): tool-hints spec + hint-mock hermeticity for placeholder selectors`

### Task 6: Docs + ship

- [ ] CLAUDE.md roadmap entry (+ **run `npm run db:push`** note) and goal-doc status update; commit `docs: roadmap — starter/placeholder CRUD sweep`.
- [ ] Live Chrome verify on real Gemma (`npm run dev`, :3000): edit a hint → survives reload; Gherkin/QA chips fill; FeaturedDemo shows an edited starter; export contains `toolHints`.
- [ ] Codex adversarial review of the branch; fix confirmed findings; re-gate. Push + PR to `main`.

## Self-review

- Spec coverage: item 1 (Tasks 1–2), item 2 (Tasks 3–4), verification + hermeticity (Task 5, Global constraints), db:push + roadmap (Task 6). ✓
- No placeholders/TBDs; types named consistently (`PLACEHOLDER_DEFAULTS`, `validateHint`, `usePlaceholder`, `quickActionHintKey`). ✓
- Risk noted: `getByPlaceholder` selectors — mitigated by default-first snapshot + Task 5 mocks. ✓
