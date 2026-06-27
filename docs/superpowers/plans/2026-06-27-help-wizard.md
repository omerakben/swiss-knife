# Help-wizard chat bubble — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. (Ultracode is on; executed inline with a Codex review gate.)

**Goal:** A floating help bubble (bottom-right) that opens a non-modal chat panel — a local-Gemma guide that explains every Haven Desk tool, gives examples, and links the user to the right one.

**Architecture:** A pure `lib/wizard.ts` builds the system prompt from the nav registry (the closed, authoritative tool list) + a curated `lib/manual.ts`, and `suggestTools(text)` deterministically matches the answer against nav labels for one-click "Open ___" chips (also the anti-hallucination backstop). A streaming `POST /api/wizard` runs the light model with no memory injection; a `useWizardChat` hook consumes it multi-turn; `HelpWizard` is a non-modal floating panel mounted globally.

**Tech Stack:** Next.js 16 (route handlers + client components), TypeScript strict, `streamTextResponse` (Ollama streaming), Vitest, Playwright, shadcn, react-markdown.

## Global Constraints

- Build with `env -u NODE_ENV npm run build`. Gates from `cockpit/`: `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run build`.
- Local-only. The wizard explains + links; it never mutates data and never executes actions.
- Grounding: the tool list in the prompt is derived from `NAV_ITEMS` (never hardcode a tool list). Low temperature (0.25). `suggestTools` only ever returns real `NAV_ITEMS`.
- The wizard route uses the configured **light** model (`getEffectiveConfig().model` via `streamTextResponse`), **no memory injection** (`injectMemory:false`), capped history.
- Conversation is ephemeral (in-memory) — no Prisma model, no `db:push`.
- Theme tokens, not raw `neutral-*`. Per-feature gated commit: stop dev → `rm -rf .next` → build → lint → unit → e2e → one commit.

---

### Task 1: Grounding — `lib/manual.ts` + `lib/wizard.ts` (TDD, with a drift test)

**Files:**
- Create: `cockpit/src/lib/manual.ts`
- Create: `cockpit/src/lib/wizard.ts`
- Test: `cockpit/src/lib/wizard.test.ts`

**Interfaces:**
- Consumes: `NAV_ITEMS`, `type NavItem` from `@/lib/nav`.
- Produces:
  - `lib/manual.ts`: `export type ManualEntry = { howTo: string; examples: string[] }` and `export const MANUAL: Record<string, ManualEntry>` (keyed by nav `href`).
  - `lib/wizard.ts`: `export function buildWizardSystemPrompt(items?: NavItem[], manual?: Record<string, ManualEntry>): string` and `export function suggestTools(text: string, items?: NavItem[], max?: number): NavItem[]`.

- [ ] **Step 1: Write `lib/manual.ts`** — one entry per everyday (non-professional, `desc`'d) tool, plus the everyday surfaces. Keyed by the exact nav `href`. Example (write the full set — the drift test in Step 3 enforces completeness):

```ts
export type ManualEntry = { howTo: string; examples: string[] };

// Per-tool how-to + examples. Keyed by the nav href (the drift test enforces
// that every key is a real nav tool and every everyday tool has an entry). Holds
// only what nav's desc/keywords don't — it does not re-state the description.
export const MANUAL: Record<string, ManualEntry> = {
  "/tools/quick-actions": {
    howTo: "Pick a one-click action, fill a tiny form, and get a usable result you can refine or save.",
    examples: ["Reply to a message", "Turn notes into a to-do list", "Plan my week"],
  },
  "/tools/tasks": {
    howTo: "Capture to-dos as a list or a Kanban board; AI can turn a goal into tasks or write a standup.",
    examples: ["Add 'send the quote' due Friday", "Generate tasks from a goal"],
  },
  "/tools/meeting-notes": {
    howTo: "Paste rough meeting notes; it extracts the action items, you review and edit, then they become real tasks.",
    examples: ["Paste notes with 'Sam to send the quote by Friday' → reviewed tasks"],
  },
  "/tools/memory": {
    howTo: "Facts the app remembers and weaves into your other tools; you accept what it learns.",
    examples: ["Save your business's tone of voice", "Review suggested facts"],
  },
  "/tools/inbox": {
    howTo: "Drop a file or paste anything — a note, a list, a message — and it's auto-sorted into a task, fact, or idea.",
    examples: ["Paste a brain-dump", "Drop a .txt or .csv"],
  },
  "/tools/image": {
    howTo: "Paste or drop an image and ask about it; tap a question preset for OCR, receipts, or a description.",
    examples: ["Read the text in a screenshot", "Pull the details off a receipt"],
  },
  "/tools/prompt-optimizer": {
    howTo: "Paste a rough prompt and get a sharper version you can save to the library.",
    examples: ["Sharpen 'write me something about my product'"],
  },
  "/tools/templates": {
    howTo: "Browse ready-made templates grouped by category, fill the blanks, and run — like a proposal writer or SOP builder.",
    examples: ["Run the Proposal writer", "Find an email template"],
  },
  "/tools/prompt-library": {
    howTo: "Your saved prompts and where you create or edit your own templates.",
    examples: ["Save a prompt you reuse", "Create a template with {{variables}}"],
  },
  "/tools/email-writer": {
    howTo: "Describe what to say and pick a tone and length; get a draft to copy, save, or send.",
    examples: ["Ask a landlord to fix a leak", "Reply declining a meeting politely"],
  },
  "/tools/brainstorm": {
    howTo: "Pick a thinking technique (alternatives, pros & cons, premortem…) and run it on your topic; results save as ideas.",
    examples: ["Pros & cons of two options", "A premortem on a plan"],
  },
  "/tools/projects": {
    howTo: "Group your prompts, tasks, ideas, and memory by project; pick the active one in the sidebar so new work is filed there.",
    examples: ["Create a project for a client", "Switch the active project"],
  },
  "/tools/packs": {
    howTo: "Install a workflow pack to add ready-made templates, facts, and tasks for a job — like Small Business Ops.",
    examples: ["Install Small Business Ops"],
  },
  "/tools/activity": {
    howTo: "A timeline of what happened — creates, AI runs, deletes.",
    examples: ["See what you added today"],
  },
};
```

- [ ] **Step 2: Write the failing tests** — `cockpit/src/lib/wizard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./nav";
import { MANUAL } from "./manual";
import { buildWizardSystemPrompt, suggestTools } from "./wizard";

describe("wizard grounding", () => {
  it("the system prompt lists every nav tool and marks the advanced ones", () => {
    const p = buildWizardSystemPrompt();
    for (const it of NAV_ITEMS) expect(p, `${it.label} missing`).toContain(it.label);
    expect(p).toContain("/tools/quick-actions");
    expect(p).toMatch(/advanced/i); // professional tools flagged
    expect(p).toMatch(/never (mention|invent)/i); // closed-list instruction
  });

  it("MANUAL only references real nav tools, and covers every everyday tool (drift tripwire)", () => {
    const hrefs = new Set(NAV_ITEMS.map((n) => n.href));
    for (const key of Object.keys(MANUAL)) expect(hrefs.has(key), `MANUAL key ${key} is not a nav href`).toBe(true);
    for (const it of NAV_ITEMS) {
      if (!it.professional && it.desc) {
        expect(MANUAL[it.href], `everyday tool ${it.label} has no manual entry`).toBeTruthy();
      }
    }
  });

  it("suggestTools matches nav labels, longest-first, deduped, capped", () => {
    expect(suggestTools("Use the Email Writer to draft it.").map((t) => t.label)).toEqual(["Email Writer"]);
    expect(suggestTools("nothing here matches a tool").map((t) => t.label)).toEqual([]);
    expect(suggestTools("Open Tasks, then Tasks again").map((t) => t.label)).toEqual(["Tasks"]); // dedup
  });

  it("suggestTools puts everyday tools before advanced ones and caps at 3", () => {
    const labels = suggestTools("Try Quick Actions, the QA Pipeline, Tasks, and Email Writer.").map((t) => t.label);
    expect(labels.length).toBe(3);
    expect(labels.indexOf("QA Pipeline")).toBe(-1 < 0 ? labels.indexOf("QA Pipeline") : 0); // advanced not first
    expect(labels[0]).not.toBe("QA Pipeline");
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd cockpit && env -u NODE_ENV npx vitest run src/lib/wizard.test.ts`
Expected: FAIL ("Cannot find module './wizard'").

- [ ] **Step 4: Implement `lib/wizard.ts`**:

```ts
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { MANUAL, type ManualEntry } from "@/lib/manual";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The Haven Desk manual as a system prompt: a closed tool list derived from the
 *  nav registry (so it can never name a tool that doesn't exist) + per-tool
 *  how-to/examples. */
export function buildWizardSystemPrompt(items: NavItem[] = NAV_ITEMS, manual: Record<string, ManualEntry> = MANUAL): string {
  const lines: string[] = [
    "You are the Haven Desk guide — a friendly, concise in-app assistant.",
    "Haven Desk is a private, local-first daily app: everything runs on the user's machine and nothing leaves it.",
    "",
    "THE TOOLS (this is the complete and only list — never mention a tool that is not here, and never invent a feature):",
  ];
  for (const it of items) {
    const tag = it.professional ? " [advanced: QA & dev]" : "";
    const desc = it.desc ? ` — ${it.desc}` : "";
    lines.push(`- ${it.label} (${it.href})${desc}${tag}`);
    const m = manual[it.href];
    if (m) {
      lines.push(`    How: ${m.howTo}`);
      if (m.examples.length) lines.push(`    Try: ${m.examples.join(" · ")}`);
    }
  }
  lines.push(
    "",
    "HOW TO HELP:",
    "- Explain how to use a tool with a short, concrete example. Keep answers brief.",
    "- When a tool fits the user's need, name it by its exact label so they can open it.",
    "- Prefer the everyday tools; only suggest an [advanced] tool when the user clearly wants QA or developer work.",
    "- You explain and point the way — you do NOT perform actions or change the user's data.",
    "- For an open-ended question that isn't about Haven Desk, give a brief answer, then suggest Quick Actions or pressing Cmd/Ctrl+K to Ask anything.",
    "- If nothing fits, say so plainly and suggest the closest tool. Never invent a tool or feature.",
  );
  return lines.join("\n");
}

/** Tools named in an assistant message, for one-click "Open" chips. Matches nav
 *  labels (word-boundary, longest-first so "Email Writer" beats a shorter
 *  overlap), dedups, puts everyday tools before advanced ones, caps at `max`.
 *  The match set IS the registry, so a returned tool always exists. */
export function suggestTools(text: string, items: NavItem[] = NAV_ITEMS, max = 3): NavItem[] {
  const lower = text.toLowerCase();
  const byLen = [...items].sort((a, b) => b.label.length - a.label.length);
  const matched: NavItem[] = [];
  const used = new Set<string>();
  for (const it of byLen) {
    if (used.has(it.href)) continue;
    const re = new RegExp(`\\b${escapeRegExp(it.label.toLowerCase())}\\b`);
    if (re.test(lower)) {
      matched.push(it);
      used.add(it.href);
    }
  }
  matched.sort((a, b) => {
    const pa = a.professional ? 1 : 0;
    const pb = b.professional ? 1 : 0;
    if (pa !== pb) return pa - pb; // everyday first
    return lower.indexOf(a.label.toLowerCase()) - lower.indexOf(b.label.toLowerCase());
  });
  return matched.slice(0, max);
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd cockpit && env -u NODE_ENV npx vitest run src/lib/wizard.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add cockpit/src/lib/manual.ts cockpit/src/lib/wizard.ts cockpit/src/lib/wizard.test.ts
git commit -m "feat(wizard): nav-grounded manual + system prompt + suggestTools (drift-tested)"
```

---

### Task 2: `POST /api/wizard` (streaming)

**Files:**
- Create: `cockpit/src/app/api/wizard/route.ts`

**Interfaces:**
- Consumes: `assertOllamaReady`, `streamTextResponse`, `buildWizardSystemPrompt`, `type ChatMessage`.
- Produces (HTTP): `POST { messages: {role,content}[] }` → streamed text (light model, no memory) | 503 | 400.

- [ ] **Step 1: Implement the route**:

```ts
import { assertOllamaReady } from "@/lib/health";
import { streamTextResponse } from "@/lib/ai/streamRoute";
import { buildWizardSystemPrompt } from "@/lib/wizard";
import type { ChatMessage } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TURNS = 8;

// The Haven Desk guide: a streaming, manual-grounded chat on the light model.
// No memory injection (it's about the app, not the user's facts — and a fact
// block on the 4B is slow). History is client-side; capped here.
export async function POST(req: Request) {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { messages } = (await req.json().catch(() => ({}))) as {
    messages?: { role?: string; content?: string }[];
  };
  const history: ChatMessage[] = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content!.trim().slice(0, 4000) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "Ask the guide a question." }, { status: 400 });
  }

  return streamTextResponse({
    messages: [{ role: "system", content: buildWizardSystemPrompt() }, ...history],
    temperature: 0.25,
    injectMemory: false,
  });
}
```

- [ ] **Step 2: Lint + build**

Run: `cd cockpit && env -u NODE_ENV npm run lint && env -u NODE_ENV npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add cockpit/src/app/api/wizard/route.ts
git commit -m "feat(wizard): streaming /api/wizard (manual prompt, light model, no memory)"
```

---

### Task 3: `useWizardChat` hook

**Files:**
- Create: `cockpit/src/hooks/useWizardChat.ts`

**Interfaces:**
- Consumes: `ERROR_SENTINEL` from `@/lib/ai/sentinel`.
- Produces: `export type WizardMessage = { role: "user" | "assistant"; content: string }` and `export function useWizardChat()` → `{ messages, streaming, error, elapsedMs, send, stop, reset }`.

- [ ] **Step 1: Implement the hook** (multi-turn variant of `useAiTool`'s reader loop):

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ERROR_SENTINEL } from "@/lib/ai/sentinel";

export type WizardMessage = { role: "user" | "assistant"; content: string };

function withLastAssistant(list: WizardMessage[], content: string): WizardMessage[] {
  const copy = [...list];
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i].role === "assistant") {
      copy[i] = { ...copy[i], content };
      break;
    }
  }
  return copy;
}

export function useWizardChat() {
  const [messages, setMessages] = useState<WizardMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || streaming) return;
      setError(null);
      const history: WizardMessage[] = [...messages, { role: "user", content: q }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);
      setElapsedMs(0);
      const startedAt = Date.now();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/wizard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          let msg = `Request failed (${res.status})`;
          try {
            const d = await res.json();
            if (d?.error) msg = d.error;
          } catch {
            /* keep default */
          }
          throw new Error(msg);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          if (acc.includes(ERROR_SENTINEL)) {
            const [textPart, err] = acc.split(ERROR_SENTINEL);
            setMessages((m) => withLastAssistant(m, textPart));
            throw new Error(err?.trim() || "Stream error");
          }
          setMessages((m) => withLastAssistant(m, acc));
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    },
    [messages, streaming],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, streaming, error, elapsedMs, send, stop, reset };
}
```

- [ ] **Step 2: Lint** (no separate test — exercised by the component e2e + live)

Run: `cd cockpit && env -u NODE_ENV npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add cockpit/src/hooks/useWizardChat.ts
git commit -m "feat(wizard): useWizardChat multi-turn streaming hook"
```

---

### Task 4: `HelpWizard` component + mount

**Files:**
- Create: `cockpit/src/components/HelpWizard.tsx`
- Modify: `cockpit/src/app/layout.tsx` (mount it)

**Interfaces:**
- Consumes: `useWizardChat`, `suggestTools`, `Markdown`, `Button`.
- Produces: `export function HelpWizard()`.

- [ ] **Step 1: Implement `HelpWizard.tsx`**:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircleQuestion, X, Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import { useWizardChat } from "@/hooks/useWizardChat";
import { suggestTools } from "@/lib/wizard";

const STARTERS = [
  "What can Haven Desk do?",
  "How do I turn meeting notes into tasks?",
  "Which tool writes an email?",
];

function ToolChips({ text }: { text: string }) {
  const tools = suggestTools(text);
  if (tools.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tools.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-card px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
          >
            <Icon className="h-3 w-3 text-primary" /> Open {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export function HelpWizard() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, streaming, error, elapsedMs, send, stop } = useWizardChat();
  const secs = Math.round(elapsedMs / 1000);

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    setInput("");
    send(q);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close the Haven Desk guide" : "Open the Haven Desk guide"}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-6 w-6" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Haven Desk guide"
          className="fixed bottom-20 right-4 z-40 flex h-[min(70vh,560px)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <div className="border-b border-border p-3">
            <div className="text-sm font-semibold">Haven Desk guide</div>
            <p className="text-xs text-muted-foreground">Ask how anything works — it runs locally.</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Hi! I can explain any tool and point you to it. Try:</p>
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-sm">
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="max-w-[92%] text-sm">
                    {m.content ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Markdown>{m.content}</Markdown>
                      </div>
                    ) : streaming && i === messages.length - 1 ? (
                      <span className="text-muted-foreground">Thinking… {secs}s</span>
                    ) : null}
                    {m.content && !(streaming && i === messages.length - 1) && <ToolChips text={m.content} />}
                  </div>
                ),
              )
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex gap-2 border-t border-border p-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the guide…"
              aria-label="Ask the Haven Desk guide"
              disabled={streaming}
              className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
            {streaming ? (
              <Button type="button" variant="ghost" size="icon" onClick={stop} aria-label="Stop">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Mount in the layout** — in `cockpit/src/app/layout.tsx`, add `import { HelpWizard } from "@/components/HelpWizard";` and render `<HelpWizard />` right after `<CommandPalette />`.

- [ ] **Step 3: Lint + build + live-verify**

Run: `cd cockpit && env -u NODE_ENV npm run lint && env -u NODE_ENV npm run build`
Expected: clean.
Live on `gemma4:e4b`: the bubble shows bottom-right on every page; clicking opens the panel; a starter ("How do I turn meeting notes into tasks?") streams an answer that explains Meeting Notes and shows an "Open Meeting Notes" chip linking to `/tools/meeting-notes`; ask "which tool writes an email?" → routes to Email Writer; ask a general question → short answer + steer-back; the page stays scrollable behind the panel (non-modal); mobile (390px) the panel fits and the chip works. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add cockpit/src/components/HelpWizard.tsx cockpit/src/app/layout.tsx
git commit -m "feat(wizard): HelpWizard non-modal floating panel + suggested-tool chips"
```

---

### Task 5: e2e + docs + final gate + Codex review

**Files:**
- Create: `cockpit/e2e/wizard.spec.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write route-mocked e2e** — `cockpit/e2e/wizard.spec.ts`: mock `POST /api/wizard` to fulfill streamed text mentioning a tool by its exact nav label (e.g. "Use Meeting Notes to do that."). Open the bubble, click a starter (or type + send), assert the assistant text renders and an "Open Meeting Notes" link to `/tools/meeting-notes` appears; assert the page behind is still interactive (non-modal — e.g. the sidebar Dashboard link is clickable). Follow the route-mock/streaming pattern in `e2e/save-result.spec.ts` (fulfill with `contentType: "text/plain"`).

- [ ] **Step 2: Run the full suite**

Run (dev stopped, `rm -rf .next/dev`): `cd cockpit && env -u NODE_ENV npm run test:e2e`
Expected: all pass.

- [ ] **Step 3: Update `CLAUDE.md`** — add a roadmap bullet for the help wizard.

- [ ] **Step 4: Final gate**

Run: `cd cockpit && env -u NODE_ENV npm run lint && env -u NODE_ENV npm run test:unit && env -u NODE_ENV npm run build`
Expected: lint clean, all unit pass, build green.

- [ ] **Step 5: Commit**

```bash
git add cockpit/e2e/wizard.spec.ts CLAUDE.md
git commit -m "test(wizard): route-mocked e2e + docs"
```

- [ ] **Step 6: Codex adversarial review** — dispatch a Codex review of `git diff main...HEAD` focused on: the anti-hallucination stack (closed nav-derived list, low temp, the chip gate never linking a non-nav tool), `suggestTools` correctness (longest-first, dedup, professional down-rank, word-boundary edge cases), the drift test actually catching a manual/nav mismatch, the route (history cap, no memory, the user-last guard, the light model), `useWizardChat` (abort-on-unmount, ERROR_SENTINEL split, no stale-closure on `messages`), and the panel being genuinely non-modal (no focus trap / scroll lock) with sane z-order vs palette/toaster. Fix confirmed findings, re-gate.

---

## Self-review

**Spec coverage:**
- Non-modal floating bubble + panel, global mount → Task 4. ✓
- Ephemeral in-memory conversation, starter questions → Tasks 3, 4. ✓
- Grounding from nav + manual; closed list; anti-hallucination → Task 1 (`buildWizardSystemPrompt`). ✓
- Drift test → Task 1. ✓
- `suggestTools` chips (deterministic, longest-first, pro down-rank) → Task 1 + Task 4 (`ToolChips`). ✓
- Streaming `/api/wizard`, light model, no memory, capped history → Task 2. ✓
- `useWizardChat` multi-turn streaming (abort, ERROR_SENTINEL, elapsed) → Task 3. ✓
- Explain + navigate, no action-execution → the prompt instructions (Task 1) + chips link only (Task 4). ✓
- Professional tools included-but-down-ranked → Task 1 (prompt tag + `suggestTools` sort). ✓
- Off-topic steer-back → prompt instruction (Task 1). ✓
- Testing (pure unit + drift + route-mocked e2e + live) → Tasks 1, 4, 5. ✓
- YAGNI cuts (no action-exec, no prefill, no persistence, no RAG) — nothing in the plan adds them. ✓

**Placeholder scan:** libs/route/hook/component carry complete code; `MANUAL` (Task 1 Step 1) shows the full structure + every everyday entry, and the drift test enforces completeness, so it is not a placeholder. The e2e (Task 5) is specified by exact intercepts + assertions against the existing streaming-mock pattern.

**Type consistency:** `NavItem`/`NAV_ITEMS` (from nav) flow into `buildWizardSystemPrompt`/`suggestTools` (Task 1) and `ToolChips` (Task 4). `ManualEntry`/`MANUAL` (Task 1) are consumed by `buildWizardSystemPrompt`. `WizardMessage` (Task 3) is produced by `useWizardChat` and consumed by `HelpWizard` (Task 4). `ChatMessage` (route, Task 2) matches the `{role,content}` posted by the hook. The `/api/wizard` contract (`{messages}`) is consistent between the hook (Task 3) and the route (Task 2).
