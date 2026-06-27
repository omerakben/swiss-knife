# Save a Quick Action result — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. (Ultracode is on; executed inline with a Codex review gate.)

**Goal:** Let a user turn a Quick Action result into real Tasks (list/plan actions, review-then-add) or save any result as a note — closing the loop after the result + one-tap refine.

**Architecture:** A thin `ResultSaveActions` component on the runner result area. "Save as note" → `POST /api/ideas` verbatim (no model re-run). "Save as tasks" (flagged actions) → extract via a new `POST /api/result-tasks` → a review dialog reusing a shared `DraftTaskReview` → transactional create. The task-extraction + create logic is shared in a new server lib; the deterministic `gateMeetingTasks` gate is reused unchanged.

**Tech Stack:** Next.js 16 route handlers, TypeScript strict, Prisma + SQLite, `chatJson` (Ollama native JSON), Vitest, Playwright, shadcn, sonner.

## Global Constraints

- Build with `env -u NODE_ENV npm run build`. Gates from `cockpit/`: `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run build`.
- Local-only, single-user. No cloud calls. Save never re-runs the model (persist the existing result verbatim).
- `lib/meetingNotes.ts` stays pure (its `DraftTask` type is `import type`'d by client components — do NOT add `prisma`/`chatJson` to it). Server task logic goes in `lib/tasksFromText.ts`.
- `gateMeetingTasks` stays byte-identical (the shared deterministic gate). Meeting Notes' *extract* prompt is untouched this round; only its *create* branch and the review *component* are shared.
- DB via `import { prisma } from "@/lib/db"`. Route handlers: `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`. Active project via `getActiveProjectId()` (no client prop).
- Per-feature gated commit: stop dev → `rm -rf .next` → build → lint → unit → e2e → one commit.

---

### Task 1: Pure foundations — `deriveNoteTitle` + the `canSaveTasks` flag

**Files:**
- Create: `cockpit/src/lib/resultTitle.ts`
- Test: `cockpit/src/lib/resultTitle.test.ts`
- Modify: `cockpit/src/lib/quickActions.ts` (add `canSaveTasks?` to `QuickAction`; set it on four actions)
- Modify: `cockpit/src/lib/quickActions.test.ts` (assert the flag set)

**Interfaces:**
- Produces: `export function deriveNoteTitle(text: string, fallback: string): string`
- Produces: `QuickAction.canSaveTasks?: boolean`, true on `notes-to-list`, `find-action-items`, `plan-week`, `study-plan`.

- [ ] **Step 1: Write the failing test** — `cockpit/src/lib/resultTitle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveNoteTitle } from "./resultTitle";

describe("deriveNoteTitle", () => {
  it("uses a leading markdown heading", () => {
    expect(deriveNoteTitle("# My weekly plan\n\n- a\n- b", "Plan my week")).toBe("My weekly plan");
    expect(deriveNoteTitle("## Action items\nstuff", "X")).toBe("Action items");
  });
  it("uses a short first line when there is no heading", () => {
    expect(deriveNoteTitle("Reply to the school\n\nrest", "Reply")).toBe("Reply to the school");
  });
  it("falls back when the first line is long or empty", () => {
    const long = "x".repeat(120);
    expect(deriveNoteTitle(long, "Plan my week")).toBe("Plan my week");
    expect(deriveNoteTitle("   \n\n", "Summarize this")).toBe("Summarize this");
  });
  it("trims and caps the derived title", () => {
    expect(deriveNoteTitle("#   Spaced   ", "X")).toBe("Spaced");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd cockpit && env -u NODE_ENV npx vitest run src/lib/resultTitle.test.ts`
Expected: FAIL ("Cannot find module './resultTitle'").

- [ ] **Step 3: Implement `lib/resultTitle.ts`**:

```ts
// Deterministic title for a saved note (no model call). Prefer a leading
// markdown heading, else a short first line, else the action's title.
const MAX = 80;

export function deriveNoteTitle(text: string, fallback: string): string {
  const lines = text.split(/\r?\n/);
  const firstNonEmpty = lines.find((l) => l.trim().length > 0)?.trim() ?? "";

  const heading = firstNonEmpty.match(/^#{1,6}\s+(.+)$/);
  if (heading) return heading[1].trim().slice(0, MAX);

  if (firstNonEmpty && firstNonEmpty.length <= MAX) return firstNonEmpty;
  return fallback;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd cockpit && env -u NODE_ENV npx vitest run src/lib/resultTitle.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the `canSaveTasks` flag** — in `cockpit/src/lib/quickActions.ts`, add to the `QuickAction` type (next to `category`/`icon`):

```ts
  /** Result is a list/plan worth turning into real Tasks (shows "Save as tasks"). */
  canSaveTasks?: boolean;
```

Then set `canSaveTasks: true` on exactly these four action objects: `notes-to-list`, `find-action-items`, `plan-week`, `study-plan` (add the property to each literal).

- [ ] **Step 6: Assert the flag set** — append to `cockpit/src/lib/quickActions.test.ts`:

```ts
  it("canSaveTasks is set on exactly the list/plan actions", () => {
    const flagged = QUICK_ACTIONS.filter((a) => a.canSaveTasks).map((a) => a.id).sort();
    expect(flagged).toEqual(["find-action-items", "notes-to-list", "plan-week", "study-plan"]);
  });
```

- [ ] **Step 7: Run the quickActions + resultTitle tests**

Run: `cd cockpit && env -u NODE_ENV npx vitest run src/lib/quickActions.test.ts src/lib/resultTitle.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add cockpit/src/lib/resultTitle.ts cockpit/src/lib/resultTitle.test.ts cockpit/src/lib/quickActions.ts cockpit/src/lib/quickActions.test.ts
git commit -m "feat(save-result): deriveNoteTitle + canSaveTasks flag"
```

---

### Task 2: Server lib — `extractTasksFromText` + `createDraftTasks`

Shared task logic in a new server lib. The Meeting Notes route delegates its `{create}` branch here (pure-DB, no behavior change); its extract is untouched.

**Files:**
- Create: `cockpit/src/lib/tasksFromText.ts`
- Modify: `cockpit/src/app/api/meeting-notes/route.ts` (create branch → `createDraftTasks`)

**Interfaces:**
- Consumes: `gateMeetingTasks`, `DraftTask`, `GateResult` from `@/lib/meetingNotes`.
- Produces:
  - `export async function extractTasksFromText(text: string, cfg: { model: string; baseUrl: string }): Promise<GateResult>`
  - `export async function createDraftTasks(drafts: DraftTask[], projectId: string | null, source: string): Promise<number>`

- [ ] **Step 1: Implement `lib/tasksFromText.ts`**:

```ts
// Server task logic shared by Meeting Notes and "save a result as tasks".
// extractTasksFromText runs a neutral-prompt chatJson and applies the
// deterministic gateMeetingTasks gate; createDraftTasks does the transactional
// Task create + a parameterized activity log. Kept out of lib/meetingNotes.ts so
// that pure module (whose DraftTask type is import-type'd by client components)
// never pulls prisma/chatJson into a client bundle.

import { chatJson } from "@/lib/ollama";
import { prisma } from "@/lib/db";
import { parseDueDateInput } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { gateMeetingTasks, type DraftTask, type GateResult } from "@/lib/meetingNotes";

const TASK_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, owner: { type: "string" }, due: { type: "string" } },
        required: ["title"],
      },
    },
  },
  required: ["tasks"],
} as const;

// Neutral (not "meeting notes"): the result may be a grouped plan, so tell the
// model to ignore section headers and only pull real action items.
const SYSTEM =
  "Read this text and list any action items as tasks. Ignore section headers and grouping. " +
  "For each task: a short imperative title; an owner only if a person is clearly named; a due date " +
  "phrase only if one is stated (for example 'tomorrow', 'friday', 'in 3 days'). Only include real " +
  "to-dos the text actually contains. Do not invent tasks, owners, or dates.";

export async function extractTasksFromText(
  text: string,
  cfg: { model: string; baseUrl: string }
): Promise<GateResult> {
  const raw = await chatJson(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: text.trim() },
    ],
    TASK_SCHEMA,
    { model: cfg.model, baseUrl: cfg.baseUrl, temperature: 0 }
  );
  return gateMeetingTasks(raw);
}

// Transactional Task create from a reviewed list (no model). source goes into the
// activity summary ("from a quick action" / "from meeting notes").
export async function createDraftTasks(
  drafts: DraftTask[],
  projectId: string | null,
  source: string
): Promise<number> {
  const clean = drafts.filter((t) => t && typeof t.title === "string" && t.title.trim()).slice(0, 50);
  if (clean.length === 0) return 0;
  const max = await prisma.task.aggregate({ where: { status: "todo" }, _max: { order: true } });
  let order = (max._max.order ?? 0) + 1;
  const creates = clean.map((t) => {
    const dueDate = typeof t.dueDate === "string" && t.dueDate ? parseDueDateInput(t.dueDate) : null;
    return prisma.task.create({
      data: {
        title: t.title.trim().slice(0, 200),
        status: "todo",
        priority: "medium",
        dueDate: dueDate ?? null,
        notes: typeof t.owner === "string" && t.owner.trim() ? `Owner: ${t.owner.trim().slice(0, 120)}` : null,
        order: order++,
        projectId,
      },
    });
  });
  const created = await prisma.$transaction(creates);
  await logActivity({ entity: "task", action: "created", summary: `Added ${created.length} tasks from ${source}`, projectId });
  return created.length;
}
```

- [ ] **Step 2: Delegate the Meeting Notes create branch** — in `cockpit/src/app/api/meeting-notes/route.ts`, replace the whole `if (Array.isArray(create)) { … }` block body (the manual aggregate/map/$transaction/logActivity) with a delegation, keeping the same guards and response:

```ts
  if (Array.isArray(create)) {
    const created = await createDraftTasks(create, projectId, "meeting notes");
    if (created === 0) return Response.json({ error: "No tasks selected to add." }, { status: 400 });
    return Response.json({ created });
  }
```

Add `import { createDraftTasks } from "@/lib/tasksFromText";` and remove the now-unused imports (`parseDueDateInput`, `logActivity`) from the route only if nothing else uses them (the extract branch does not).

- [ ] **Step 3: Verify Meeting Notes still works (no regression)**

Run: `cd cockpit && env -u NODE_ENV npm run lint && env -u NODE_ENV npm run build`
Expected: clean.
Live (dev server up): open `/tools/meeting-notes`, paste "call the printer tomorrow, Sam to send the quote", Extract → review shows the two tasks → Add → toast "Added 2 tasks", and they appear in `/tools/tasks`. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add cockpit/src/lib/tasksFromText.ts cockpit/src/app/api/meeting-notes/route.ts
git commit -m "feat(save-result): shared extractTasksFromText + createDraftTasks (Meeting Notes delegates create)"
```

---

### Task 3: `POST /api/result-tasks`

**Files:**
- Create: `cockpit/src/app/api/result-tasks/route.ts`

**Interfaces:**
- Consumes: `extractTasksFromText`, `createDraftTasks` from `@/lib/tasksFromText`; `assertOllamaReady`, `getEffectiveConfig`, `getActiveProjectId`.
- Produces (HTTP): `{ text }` → `{ tasks: DraftTask[], dropped }` (413 over 80k); `{ create: DraftTask[] }` → `{ created }`.

- [ ] **Step 1: Implement the route**:

```ts
import { assertOllamaReady } from "@/lib/health";
import { getEffectiveConfig } from "@/lib/config";
import { getActiveProjectId } from "@/lib/project";
import { extractTasksFromText, createDraftTasks } from "@/lib/tasksFromText";
import type { DraftTask } from "@/lib/meetingNotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Turn any text (a Quick Action result) into reviewed Task records. Neutral
// provenance (not the meeting-notes route, which logs "from meeting notes").
export async function POST(req: Request) {
  const { text, create } = (await req.json().catch(() => ({}))) as { text?: string; create?: DraftTask[] };
  const projectId = await getActiveProjectId();

  if (Array.isArray(create)) {
    const created = await createDraftTasks(create, projectId, "a quick action");
    if (created === 0) return Response.json({ error: "No tasks selected to add." }, { status: 400 });
    return Response.json({ created });
  }

  const t = typeof text === "string" ? text.trim() : "";
  if (!t) return Response.json({ error: "Nothing to turn into tasks." }, { status: 400 });
  if (t.length > 80_000) return Response.json({ error: "That result is too long." }, { status: 413 });

  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const cfg = await getEffectiveConfig();
  try {
    return Response.json(await extractTasksFromText(t, { model: cfg.model, baseUrl: cfg.baseUrl }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't read the result." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Smoke-test live** (dev server up): in the browser console or a quick fetch, POST `{ "text": "call the printer tomorrow, send Sam the quote" }` to `/api/result-tasks` → JSON `{ tasks: [...], dropped }`. (If the shell is sandboxed off localhost, verify via the Task 5 UI instead.)

- [ ] **Step 3: Commit**

```bash
git add cockpit/src/app/api/result-tasks/route.ts
git commit -m "feat(save-result): /api/result-tasks (extract + create)"
```

---

### Task 4: `DraftTaskReview` component (shared with Meeting Notes)

**Files:**
- Create: `cockpit/src/components/tasks/DraftTaskReview.tsx`
- Modify: `cockpit/src/app/tools/meeting-notes/page.tsx` (consume it)

**Interfaces:**
- Produces: `export type ReviewRow = DraftTask & { keep: boolean }` and `export function DraftTaskReview({ rows, onUpdate }: { rows: ReviewRow[]; onUpdate: (i: number, patch: Partial<ReviewRow>) => void })`.

- [ ] **Step 1: Implement `DraftTaskReview.tsx`** — lift the `<ul>…</ul>` row list from `meeting-notes/page.tsx:121-167` verbatim into a component:

```tsx
"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DraftTask } from "@/lib/meetingNotes";

export type ReviewRow = DraftTask & { keep: boolean };

/** The keep/edit row list for reviewed draft tasks. Shared by Meeting Notes and
 *  the runner's "Save as tasks". Assumes rows.length > 0 (callers handle empty). */
export function DraftTaskReview({
  rows,
  onUpdate,
}: {
  rows: ReviewRow[];
  onUpdate: (i: number, patch: Partial<ReviewRow>) => void;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
          <input
            type="checkbox"
            checked={r.keep}
            onChange={(e) => onUpdate(i, { keep: e.target.checked })}
            aria-label={`Keep ${r.title}`}
            className="h-4 w-4 shrink-0 accent-primary"
          />
          <input
            value={r.title}
            onChange={(e) => onUpdate(i, { title: e.target.value })}
            aria-label="Task title"
            className="min-w-0 flex-1 bg-transparent text-sm focus-visible:outline-none"
          />
          {r.owner && (
            <button
              type="button"
              onClick={() => onUpdate(i, { owner: null })}
              aria-label={`Clear owner ${r.owner}`}
              title="Clear owner"
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <Badge variant="outline" className="gap-1 text-[10px]">
                {r.owner}
                <X className="h-2.5 w-2.5" />
              </Badge>
            </button>
          )}
          {r.dueLabel && (
            <button
              type="button"
              onClick={() => onUpdate(i, { dueDate: null, dueLabel: null })}
              aria-label={`Clear due date ${r.dueLabel}`}
              title="Clear due date"
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <Badge variant="secondary" className="gap-1 text-[10px]">
                due {r.dueLabel}
                <X className="h-2.5 w-2.5" />
              </Badge>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Consume it in Meeting Notes** — in `meeting-notes/page.tsx`: change the local `type Row = DraftTask & { keep: boolean }` to `import { DraftTaskReview, type ReviewRow } from "@/components/tasks/DraftTaskReview"` and use `ReviewRow` for the state; replace the `<ul className="mt-3 space-y-2">…</ul>` block with `<DraftTaskReview rows={rows} onUpdate={update} />`; remove the now-unused `X`/`Badge` imports if nothing else in the page uses them.

- [ ] **Step 3: Lint + build + verify Meeting Notes review unchanged**

Run: `cd cockpit && env -u NODE_ENV npm run lint && env -u NODE_ENV npm run build`
Expected: clean.
Live: `/tools/meeting-notes` extract → the review list renders and Add still works (same as Task 2). Screenshot.

- [ ] **Step 4: Commit**

```bash
git add cockpit/src/components/tasks/DraftTaskReview.tsx cockpit/src/app/tools/meeting-notes/page.tsx
git commit -m "refactor(save-result): shared DraftTaskReview (Meeting Notes consumes it)"
```

---

### Task 5: `ResultSaveActions` + mount on the runner

**Files:**
- Create: `cockpit/src/components/tools/ResultSaveActions.tsx`
- Modify: `cockpit/src/components/QuickActions.tsx` (mount it in the result area)

**Interfaces:**
- Consumes: `DraftTaskReview`/`ReviewRow`, `deriveNoteTitle`, `QuickAction`, `DraftTask`; `/api/result-tasks`, `/api/ideas`.
- Produces: `export function ResultSaveActions({ text, action }: { text: string; action: QuickAction })`.

- [ ] **Step 1: Implement `ResultSaveActions.tsx`**:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ListPlus, StickyNote, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DraftTaskReview, type ReviewRow } from "@/components/tasks/DraftTaskReview";
import { deriveNoteTitle } from "@/lib/resultTitle";
import type { QuickAction } from "@/lib/quickActions";
import type { DraftTask } from "@/lib/meetingNotes";

export function ResultSaveActions({ text, action }: { text: string; action: QuickAction }) {
  const [savedNote, setSavedNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [adding, setAdding] = useState(false);

  async function saveNote() {
    const snapshot = text; // snapshot at click — a refine may still stream
    if (!snapshot.trim() || savingNote) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: deriveNoteTitle(snapshot, action.title), content: snapshot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      setSavedNote(true);
      toast.success("Saved as a note", {
        action: { label: "Open", onClick: () => { window.location.href = "/tools/brainstorm"; } },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSavingNote(false);
    }
  }

  async function extractTasks() {
    const snapshot = text;
    if (!snapshot.trim() || extracting) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/result-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: snapshot }),
      });
      const data = (await res.json().catch(() => ({}))) as { tasks?: DraftTask[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't read the result");
      const tasks = data.tasks ?? [];
      if (tasks.length === 0) {
        toast.message("No clear to-dos found", { description: "Try “Save as note” to keep this result." });
        return;
      }
      setRows(tasks.map((t) => ({ ...t, keep: true })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read the result");
    } finally {
      setExtracting(false);
    }
  }

  async function addTasks() {
    const keep = (rows ?? []).filter((r) => r.keep && r.title.trim());
    if (keep.length === 0 || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/result-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ create: keep }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't add the tasks");
      const n = data.created ?? keep.length;
      setRows(null);
      toast.success(`Added ${n} tasks`, {
        action: { label: "Open Tasks", onClick: () => { window.location.href = "/tools/tasks"; } },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the tasks");
    } finally {
      setAdding(false);
    }
  }

  function update(i: number, patch: Partial<ReviewRow>) {
    setRows((rs) => (rs ? rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : rs));
  }

  const keepCount = (rows ?? []).filter((r) => r.keep && r.title.trim()).length;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Save it:</span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={saveNote}
        disabled={!text || savingNote}
      >
        {savedNote ? <Check className="mr-1 h-3.5 w-3.5" /> : <StickyNote className="mr-1 h-3.5 w-3.5" />}
        {savedNote ? "Saved" : "Save as note"}
      </Button>
      {action.canSaveTasks && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={extractTasks}
          disabled={!text || extracting}
        >
          <ListPlus className="mr-1 h-3.5 w-3.5" />
          {extracting ? "Reading…" : "Save as tasks"}
        </Button>
      )}

      <Dialog open={rows !== null} onOpenChange={(o) => !o && setRows(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review tasks</DialogTitle>
            <DialogDescription>Untick anything you don’t want. Nothing is added until you confirm.</DialogDescription>
          </DialogHeader>
          {rows && <DraftTaskReview rows={rows} onUpdate={update} />}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRows(null)}>
              Cancel
            </Button>
            <Button onClick={addTasks} disabled={adding || keepCount === 0}>
              {adding ? "Adding…" : `Add ${keepCount} tasks`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

(Note: `Link` import is unused in this version — omit it. Navigation uses `window.location.href` inside toast actions; if the project prefers router navigation, inject `useRouter` — but a full nav is fine here.)

- [ ] **Step 2: Mount on the runner** — in `QuickActions.tsx`, add `import { ResultSaveActions } from "@/components/tools/ResultSaveActions";`, and inside the `{status === "done" && output && ( … )}` block (the refine row), render `<ResultSaveActions text={output} action={active} />` directly below the "Make it:" refine row (still inside the same `status === "done" && output` guard).

- [ ] **Step 3: Lint + build + live-verify**

Run: `cd cockpit && env -u NODE_ENV npm run lint && env -u NODE_ENV npm run build`
Expected: clean.
Live on `gemma4:e4b`:
- `/tools/quick-actions?action=plan-week`, run the "A busy week" starter → result → "Save as tasks" → review dialog → Add → toast, tasks appear in `/tools/tasks` (grouped headings not turned into tasks).
- `/tools/quick-actions?action=reply-to-message` (no `canSaveTasks`) → only "Save as note" shows; click it → "Saved", a note is created.
- A flagged action whose result has no to-dos → the "No clear to-dos found" toast.
Screenshot each.

- [ ] **Step 4: Commit**

```bash
git add cockpit/src/components/tools/ResultSaveActions.tsx cockpit/src/components/QuickActions.tsx
git commit -m "feat(save-result): Save-as-note + Save-as-tasks on the runner result"
```

---

### Task 6: e2e + docs + final gate + Codex review

**Files:**
- Create: `cockpit/e2e/save-result.spec.ts`
- Modify: `CLAUDE.md` (roadmap entry)

- [ ] **Step 1: Write route-mocked e2e** — `cockpit/e2e/save-result.spec.ts`: on `/tools/quick-actions?action=plan-week`, mock `/api/quick-action` to stream a short result so the result area renders (or seed via the example run with the engine mocked like other specs). Then: mock `/api/result-tasks` GET-shape to return two tasks → click "Save as tasks" → assert the review dialog shows both → mock the create → click "Add 2 tasks" → assert the success toast. Separately, mock `/api/ideas` → click "Save as note" → assert it flips to "Saved". On `action=reply-to-message`, assert "Save as tasks" is absent. Follow the existing run-mock pattern (`e2e/quick-actions*`/`starters.spec.ts`): intercept the streaming `/api/quick-action` to produce `output` deterministically.

- [ ] **Step 2: Run the full suite**

Run (dev stopped, `rm -rf .next/dev`): `cd cockpit && env -u NODE_ENV npm run test:e2e`
Expected: all pass.

- [ ] **Step 3: Update `CLAUDE.md`** — add a roadmap bullet for the save-a-result feature.

- [ ] **Step 4: Final gate**

Run: `cd cockpit && env -u NODE_ENV npm run lint && env -u NODE_ENV npm run test:unit && env -u NODE_ENV npm run build`
Expected: lint clean, all unit pass, build green.

- [ ] **Step 5: Commit**

```bash
git add cockpit/e2e/save-result.spec.ts CLAUDE.md
git commit -m "test(save-result): route-mocked e2e + docs"
```

- [ ] **Step 6: Codex adversarial review** — dispatch a Codex review of `git diff main...HEAD` focused on: the Meeting Notes create-delegation being behavior-identical (order, priority, owner-note, log), the 0-task/empty UX (no dead-end dialog), the snapshot-at-click for a streaming refine, the 80k cap, project scoping, and that `deriveNoteTitle` never produces an empty title. Fix confirmed findings, re-gate.

---

## Self-review

**Spec coverage:**
- ResultSaveActions on the runner result → Task 5. ✓
- Save as note (verbatim, deterministic title, no re-run, disabled-when-empty, Saved✓) → Task 1 (`deriveNoteTitle`) + Task 5. ✓
- Save as tasks (flagged actions, extract→review→add, empty→note-fallback toast) → Task 1 (flag) + Task 3 (endpoint) + Task 4 (review) + Task 5. ✓
- Shared `extractTasksFromText` (neutral prompt) + `createDraftTasks` + unchanged `gateMeetingTasks` → Task 2. ✓
- `DraftTaskReview` shared; Meeting Notes consumes it → Task 4. ✓
- Meeting Notes create delegates; extract prompt untouched → Task 2. ✓
- `/api/result-tasks` (extract + create, 80k cap, neutral provenance) → Task 3. ✓
- Snapshot at click, auto project scoping → Task 5 (snapshot) + Tasks 2-3 (`getActiveProjectId`). ✓
- YAGNI cuts honored (no project picker, no tasks+note, no extract-prompt unify) — nothing in the plan adds them. ✓
- Testing (pure unit + route-mocked e2e + live) → Tasks 1, 6. ✓

**Placeholder scan:** libs, route, and components carry complete code; the e2e (Task 6 Step 1) is specified by the exact intercepts + assertions to write against the existing run-mock pattern (the streaming `/api/quick-action` mock varies per spec, so it's described precisely rather than pre-written).

**Type consistency:** `DraftTask`/`GateResult` (from `lib/meetingNotes`) flow through `tasksFromText` (Task 2), the route (Task 3), `ReviewRow = DraftTask & {keep}` (Task 4), and `ResultSaveActions` (Task 5) with matching names. `deriveNoteTitle(text, fallback)` (Task 1) is called with `(snapshot, action.title)` (Task 5). `createDraftTasks(drafts, projectId, source)` is called from both routes (Tasks 2, 3) with the same signature. `canSaveTasks` (Task 1) gates the button (Task 5).

**Deviation from spec (flagged):** server task logic lives in a new `lib/tasksFromText.ts`, not in `lib/meetingNotes.ts` as the spec's checklist loosely implied — because `lib/meetingNotes.ts` must stay pure (its `DraftTask` type is `import type`'d by client components; adding `prisma` would break the client bundle). `gateMeetingTasks` + types stay in `meetingNotes.ts`.
