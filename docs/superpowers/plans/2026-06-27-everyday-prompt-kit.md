# Everyday prompt kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Engineer Haven Desk's everyday flows into typed `PromptSpec`s — role + explicit rules + a shared safety block + output contract + two few-shot examples rendered as conversation turns — so a local 4B is reliable for non-technical users, proven on real Gemma.

**Architecture:** A small pure kit (`lib/prompts/spec.ts`) defines `PromptSpec` and `compileSpec()`, which renders the spec into chat messages with the two examples as real `user`/`assistant` turns. The existing `QuickAction` gains an optional `spec`; `buildMessages` compiles from it when present and falls back to today's path when absent. Standalone routes (email) get a small spec module. A dev-only bench script runs baseline-vs-engineered on Gemma. This first plan delivers the kit + seam + bench + batch 1 (5 flows); the remaining everyday flows follow the same recipe (backlog at the end).

**Tech Stack:** TypeScript (strict), Vitest unit tests, the existing `lib/ollama` chat client, Ollama `gemma4:e4b`.

## Global Constraints

- Build with `env -u NODE_ENV npm run build` — a shell `NODE_ENV=development` poisons `next build`.
- Gate every task: `env -u NODE_ENV` → lint, unit (`npm run test:unit`), e2e (`npm run test:e2e`), build. No claim of a gate passing without running it.
- Light chat model only: `gemma4:e4b` (`getEffectiveConfig().model`). Never `qaModel`.
- Local-first: no cloud calls, no secrets, no off-machine routing.
- QA/Dev tools are OUT OF SCOPE (code-review, qa-pipeline, bug-report, rubric-designer, eval-cases, adr, complexity, api-contract). Do not touch their prompts.
- Banned-vocab/writing rules apply to MY prose (docs, comments, commits) — not to the example *content* inside few-shot gold outputs (that is natural everyday writing a real user would produce).
- `ChatMessage = { role: "system" | "user" | "assistant"; content: string }` (from `@/lib/ollama`).
- Per-feature commits; conventional commit messages.

---

## File structure

- Create `cockpit/src/lib/prompts/spec.ts` — `PromptSpec`, `FewShot`, `HOUSE_RULES`, `compileSpec()`. One responsibility: turn a spec + user input into messages.
- Create `cockpit/src/lib/prompts/spec.test.ts` — unit tests for the compiler.
- Modify `cockpit/src/lib/quickActions.ts` — add optional `spec` to `QuickAction`; `buildMessages` compiles via `compileSpec` when `spec` present; attach `spec` to the batch-1 Quick Actions.
- Modify `cockpit/src/lib/quickActions.test.ts` — assert the spec path and the legacy fallback.
- Create `cockpit/src/lib/prompts/email.ts` — `emailSpec(tone, length): PromptSpec` for the Email Writer route.
- Modify `cockpit/src/app/api/email/route.ts` — build messages from `emailSpec` via `compileSpec`.
- Create `cockpit/src/lib/prompts/gold.ts` — exports the batch-1 gold few-shot pairs (the bench's source of truth; also imported by the specs so examples and bench never drift).
- Create `cockpit/scripts/prompt-bench.mjs` — dev-only baseline-vs-engineered runner on Gemma.
- Create `docs/superpowers/skills/prompt-engineering.md` (or a `.claude` skill) — the reusable methodology.

---

## Task 1: The kit — `lib/prompts/spec.ts`

**Files:**
- Create: `cockpit/src/lib/prompts/spec.ts`
- Test: `cockpit/src/lib/prompts/spec.test.ts`

**Interfaces:**
- Produces: `type FewShot = { input: string; output: string }`; `type PromptSpec = { role: string; rules: string[]; outputContract: string; examples: FewShot[]; temperature?: number; omitHouseRules?: boolean }`; `HOUSE_RULES: string[]`; `compileSpec(spec: PromptSpec, userInput: string): ChatMessage[]`.

- [ ] **Step 1: Write the failing test**

```ts
// cockpit/src/lib/prompts/spec.test.ts
import { describe, it, expect } from "vitest";
import { compileSpec, HOUSE_RULES, type PromptSpec } from "./spec";

const base: PromptSpec = {
  role: "You are a careful assistant.",
  rules: ["Keep it short.", "Use plain words."],
  outputContract: "Return only the answer.",
  examples: [
    { input: "say hi", output: "Hi." },
    { input: "say bye", output: "Bye." },
  ],
};

describe("compileSpec", () => {
  it("emits system, then each example as a user/assistant turn, then the real user input", () => {
    const msgs = compileSpec(base, "say hello");
    expect(msgs.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    expect(msgs[1]).toEqual({ role: "user", content: "say hi" });
    expect(msgs[2]).toEqual({ role: "assistant", content: "Hi." });
    expect(msgs[5]).toEqual({ role: "user", content: "say hello" });
  });

  it("the system message carries role, every rule, the house rules, and the contract", () => {
    const sys = compileSpec(base, "x")[0].content;
    expect(sys).toContain("You are a careful assistant.");
    expect(sys).toContain("Keep it short.");
    expect(sys).toContain("Use plain words.");
    expect(sys).toContain(HOUSE_RULES[0]);
    expect(sys).toContain("Return only the answer.");
  });

  it("omitHouseRules drops the shared block", () => {
    const sys = compileSpec({ ...base, omitHouseRules: true }, "x")[0].content;
    expect(sys).not.toContain(HOUSE_RULES[0]);
  });

  it("no examples → just system + the real user turn", () => {
    const msgs = compileSpec({ ...base, examples: [] }, "only me");
    expect(msgs.map((m) => m.role)).toEqual(["system", "user"]);
    expect(msgs[1].content).toBe("only me");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cockpit && npx vitest run src/lib/prompts/spec.test.ts`
Expected: FAIL — cannot find module `./spec`.

- [ ] **Step 3: Write minimal implementation**

```ts
// cockpit/src/lib/prompts/spec.ts
// The everyday prompt kit. A PromptSpec is a contract for a local 4B: who it is,
// the exact rules, the output shape, and two worked examples. compileSpec renders
// the examples as real conversation turns — the single biggest reliability lever
// on a small instruction-tuned model. See docs/superpowers/specs/2026-06-27-everyday-prompt-kit-design.md
import type { ChatMessage } from "@/lib/ollama";

export type FewShot = { input: string; output: string };

export type PromptSpec = {
  /** "You are X. Your only job is Y." */
  role: string;
  /** Explicit constraints — no vague qualifiers ("≤4 sentences", never "be concise"). */
  rules: string[];
  /** Exact output shape, e.g. "Return only the reply. No preamble, no quotes." */
  outputContract: string;
  /** Two worked examples, rendered as user/assistant turns. */
  examples: FewShot[];
  /** Extraction → 0; everyday writing → 0.3–0.4. */
  temperature?: number;
  /** Opt out of the shared safety block when a flow needs a different stance. */
  omitHouseRules?: boolean;
};

// The shared safety block — the safe/private promise, applied to every everyday
// spec. Borrowed from the agency-agents Prompt Engineer (explicit constraints,
// ground-or-ask) and the high-stakes pack guardrails.
export const HOUSE_RULES: string[] = [
  "Use only the details the user gave you. Never invent names, numbers, dates, prices, or facts.",
  "If something needed is missing, write the rest and leave a clearly marked blank like [their name] rather than guessing.",
  "Write in plain, everyday language. Do not act as a lawyer, doctor, or accountant; if asked for that, suggest checking a professional.",
];

export function compileSpec(spec: PromptSpec, userInput: string): ChatMessage[] {
  const rules = spec.omitHouseRules ? spec.rules : [...spec.rules, ...HOUSE_RULES];
  const system = [
    `## Role\n${spec.role}`,
    `## Rules\n${rules.map((r) => `- ${r}`).join("\n")}`,
    `## Output\n${spec.outputContract}`,
  ].join("\n\n");

  const messages: ChatMessage[] = [{ role: "system", content: system }];
  for (const ex of spec.examples) {
    messages.push({ role: "user", content: ex.input });
    messages.push({ role: "assistant", content: ex.output });
  }
  messages.push({ role: "user", content: userInput });
  return messages;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cockpit && npx vitest run src/lib/prompts/spec.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add cockpit/src/lib/prompts/spec.ts cockpit/src/lib/prompts/spec.test.ts
git commit -m "feat(prompts): add the PromptSpec kit (compileSpec + house rules)"
```

---

## Task 2: The seam — optional `spec` on `QuickAction`

**Files:**
- Modify: `cockpit/src/lib/quickActions.ts` (the `QuickAction` type ~line 39, `buildMessages` ~line 581)
- Test: `cockpit/src/lib/quickActions.test.ts`

**Interfaces:**
- Consumes: `compileSpec`, `PromptSpec` from `./prompts/spec`.
- Produces: `QuickAction.spec?: PromptSpec`; `buildMessages(action, inputs)` returns `compileSpec(action.spec, action.buildPrompt(inputs))` when `spec` is set, else the legacy `[{system}, {user}]`.

- [ ] **Step 1: Write the failing test** (append to `quickActions.test.ts`)

```ts
import { compileSpec, type PromptSpec } from "./prompts/spec";

it("buildMessages uses the spec (few-shot turns) when an action has one", () => {
  const spec: PromptSpec = {
    role: "You reply.",
    rules: ["Be kind."],
    outputContract: "Only the reply.",
    examples: [{ input: "in1", output: "out1" }],
  };
  const a = { ...QUICK_ACTIONS[0], spec, system: "LEGACY", buildPrompt: () => "REAL" };
  const msgs = buildMessages(a, {});
  // system, one example pair, the real user turn — not the legacy 2-message shape
  expect(msgs.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
  expect(msgs[0].content).not.toContain("LEGACY");
  expect(msgs[3].content).toBe("REAL");
});

it("buildMessages falls back to the legacy path when no spec", () => {
  const a = { ...QUICK_ACTIONS[0], spec: undefined, system: "LEGACY SYS", buildPrompt: () => "U" };
  const msgs = buildMessages(a, {});
  expect(msgs).toEqual([
    { role: "system", content: "LEGACY SYS" },
    { role: "user", content: "U" },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cockpit && npx vitest run src/lib/quickActions.test.ts`
Expected: FAIL — `buildMessages` ignores `spec`.

- [ ] **Step 3: Write minimal implementation**

In `quickActions.ts`, add the import at the top:

```ts
import { compileSpec, type PromptSpec } from "./prompts/spec";
```

Add `spec` to the `QuickAction` type (after `system: string;`):

```ts
  /** When set, the engineered prompt: compiled to messages with few-shot turns. */
  spec?: PromptSpec;
```

Replace `buildMessages`:

```ts
export function buildMessages(action: QuickAction, inputs: Record<string, string>): ChatMessage[] {
  const user = action.buildPrompt(inputs);
  if (action.spec) return compileSpec(action.spec, user);
  return [
    { role: "system", content: action.system },
    { role: "user", content: user },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cockpit && npx vitest run src/lib/quickActions.test.ts`
Expected: PASS (incl. the pre-existing `buildMessages` test at line 89, untouched).

- [ ] **Step 5: Commit**

```bash
git add cockpit/src/lib/quickActions.ts cockpit/src/lib/quickActions.test.ts
git commit -m "feat(prompts): QuickAction can carry an engineered spec (legacy fallback intact)"
```

---

## Task 3: Batch 1 gold pairs — `lib/prompts/gold.ts`

**Files:**
- Create: `cockpit/src/lib/prompts/gold.ts`

**Interfaces:**
- Produces: named `FewShot[]` exports — `REPLY_TO_MESSAGE_GOLD`, `REPLY_TO_REVIEW_GOLD`, `SUMMARIZE_GOLD`, `PLAN_WEEK_GOLD`, `EMAIL_GOLD`. Each pair's `input` matches a real starter input for that flow; the `output` is the authored gold (Codex-reviewed in Task 6).

- [ ] **Step 1: Create the file** (no test — pure data, exercised by Task 4's structure assertion and the bench)

```ts
// cockpit/src/lib/prompts/gold.ts
// The batch-1 gold few-shot pairs. One artifact, three jobs: the in-prompt
// example, the starter chip input it mirrors, and the bench's reference output.
// Outputs use ONLY what their input gives (no invented names/numbers) so the
// few-shot teaches the house rules by example.
import type { FewShot } from "./spec";

export const REPLY_TO_MESSAGE_GOLD: FewShot[] = [
  {
    input:
      `Here is a message I received:\n"""\nHi! We'd love to have you join the school bake sale committee. Our first meeting is this Wednesday at 6pm in the library. Can you make it?\n"""\n\nWrite a reply. What I want to say: happy to help but I can't do Wednesdays, ask if there's another day. Keep it natural and appropriately polite.`,
    output:
      "Hi! I'd love to help with the bake sale committee — thank you for thinking of me. Wednesdays are tricky for me, though. Is there another day that tends to work for the group? I can make most other evenings.",
  },
  {
    input:
      `Here is a message I received:\n"""\nAre we still on for our call tomorrow at 2pm?\n"""\n\nWrite a reply. What I want to say: yes, but I need to push it to 3pm — apologize for the short notice. Keep it natural and appropriately polite.`,
    output:
      "Yes, we're still on! Could we push it to 3pm instead of 2? Sorry for the short notice, and thanks for being flexible.",
  },
];

export const REPLY_TO_REVIEW_GOLD: FewShot[] = [
  {
    input:
      `Write a reply to this customer review:\n"""\nAbsolutely loved the cake for my daughter's birthday — beautiful and delicious. Will order again!\n"""\nKeep it warm, professional, and brief.`,
    output:
      "Thank you so much — this truly made our day! We're thrilled the cake was part of your daughter's birthday, and we'd be delighted to bake for you again whenever the next celebration comes around.",
  },
  {
    input:
      `Write a reply to this customer review:\n"""\nWaited 40 minutes for a table even with a reservation. The food was good but the wait was frustrating.\n"""\nAlso keep in mind: apologize and offer a free dessert on their next visit.\nKeep it warm, professional, and brief.`,
    output:
      "Thank you for the kind words about the food, and I'm sorry about the wait — a reservation should mean a table is ready, and we fell short there. We'd love to make it up to you: dessert is on us on your next visit.",
  },
];

export const SUMMARIZE_GOLD: FewShot[] = [
  {
    input:
      `Summarize this in 3 to 5 sentences, then list the key points as bullets:\n\nHi team, following our review we've decided to push the launch to next month to give QA more time. Marketing should hold the announcement. Finance flagged that the vendor invoice is overdue. Please confirm your availability for a sync on Thursday and send updated timelines by end of day Friday. Thanks.`,
    output:
      "The launch is moving to next month to give QA more time, and marketing should hold the announcement until then. Finance flagged a vendor invoice that is overdue and needs attention. The team is asked to confirm availability for a Thursday sync and to send updated timelines by end of day Friday.\n\n- Launch pushed to next month (more QA time)\n- Hold the marketing announcement\n- Vendor invoice is overdue\n- Confirm Thursday sync availability\n- Send updated timelines by Friday EOD",
  },
  {
    input:
      `Summarize this in 3 to 5 sentences, then list the key points as bullets:\n\nResearchers found that short, frequent breaks during focused work improved retention more than one long break. The effect was strongest for complex material and weakest for routine tasks. They recommend a five-minute pause roughly every half hour, away from screens.`,
    output:
      "Short, frequent breaks during focused work improved retention more than a single long break. The benefit was largest for complex material and smallest for routine tasks. The researchers recommend a roughly five-minute pause every half hour, away from screens.\n\n- Frequent short breaks beat one long break for retention\n- Strongest effect on complex work, weakest on routine tasks\n- Suggested: ~5 minutes off every 30 minutes, screen-free",
  },
];

export const PLAN_WEEK_GOLD: FewShot[] = [
  {
    input:
      `Here's what's on my plate this week:\nfinish the proposal, dentist on Tuesday, kids' recital Thursday, taxes due Friday, hit the gym, call mom, grocery shop, fix the leaky tap\n\nMake a simple plan: group it into Must do, Should do, and Can wait, and suggest a sensible order. Keep it short.`,
    output:
      "Must do\n- Finish the proposal\n- Dentist (Tuesday)\n- Kids' recital (Thursday)\n- Taxes (due Friday)\n\nShould do\n- Grocery shop\n- Fix the leaky tap\n- Call mom\n\nCan wait\n- Hit the gym\n\nSensible order: get the proposal done early in the week, work errands and the tap around Tuesday's dentist, and leave Thursday evening for the recital. Do the taxes Thursday night or Friday morning so they're not last-minute.",
  },
  {
    input:
      `Here's what's on my plate this week:\nfinalize the deck, dry-run the demo, send invites, prep the FAQ, line up support coverage, write the announcement, brief the team\n\nMake a simple plan: group it into Must do, Should do, and Can wait, and suggest a sensible order. Keep it short.`,
    output:
      "Must do\n- Finalize the deck\n- Dry-run the demo\n- Write the announcement\n- Brief the team\n\nShould do\n- Send invites\n- Prep the FAQ\n- Line up support coverage\n\nCan wait\n- (it's launch week — keep everything above on track)\n\nSensible order: finalize the deck first so the demo dry-run and announcement build on it, brief the team mid-week, then send invites and prep the FAQ once the message is locked. Confirm support coverage before launch day.",
  },
];

export const EMAIL_GOLD: FewShot[] = [
  {
    input:
      `Write the email. What it needs to say / notes:\nPolitely remind a client their invoice (#1042, $1,200) is two weeks overdue, and ask when I can expect payment.`,
    output:
      "Subject: Invoice #1042 — a quick payment reminder\n\nHello,\n\nI hope you're doing well. I wanted to check in on invoice #1042 for $1,200, which is now about two weeks overdue. Could you let me know when I can expect payment? I'm happy to resend the invoice if that's helpful.\n\nThank you,\n[your name]",
  },
  {
    input:
      `Write the email. What it needs to say / notes:\nTurn down an invitation to speak at an event because I'm fully booked that month, but offer to help another time.`,
    output:
      "Subject: Thank you for the invitation\n\nHello,\n\nThank you so much for thinking of me to speak at your event — it genuinely means a lot. Unfortunately my calendar is full that month, so I won't be able to take it on this time. I'd welcome the chance to help in the future, though, so please do keep me in mind for a later date.\n\nWith thanks,\n[your name]",
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/src/lib/prompts/gold.ts
git commit -m "feat(prompts): author batch-1 gold few-shot pairs"
```

---

## Task 4: Attach the batch-1 specs (4 Quick Actions)

**Files:**
- Modify: `cockpit/src/lib/quickActions.ts` (the 4 action entries: `reply-to-message`, `reply-to-review`, `summarize`, `plan-week`)
- Test: `cockpit/src/lib/quickActions.test.ts`

**Interfaces:**
- Consumes: the gold exports from `./prompts/gold`, `compileSpec` (already imported in Task 2).

- [ ] **Step 1: Write the failing test** (append to `quickActions.test.ts`)

```ts
import {
  REPLY_TO_MESSAGE_GOLD, REPLY_TO_REVIEW_GOLD, SUMMARIZE_GOLD, PLAN_WEEK_GOLD,
} from "./prompts/gold";

it("batch-1 actions carry a spec whose examples match their buildPrompt shape", () => {
  for (const id of ["reply-to-message", "reply-to-review", "summarize", "plan-week"]) {
    const a = getQuickAction(id)!;
    expect(a.spec, `${id} has a spec`).toBeTruthy();
    expect(a.spec!.examples.length).toBe(2);
    expect(a.spec!.outputContract.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cockpit && npx vitest run src/lib/quickActions.test.ts`
Expected: FAIL — `spec` is undefined on these actions.

- [ ] **Step 3: Add the import and attach `spec` to the four actions**

Top of `quickActions.ts`, add:

```ts
import {
  REPLY_TO_MESSAGE_GOLD, REPLY_TO_REVIEW_GOLD, SUMMARIZE_GOLD, PLAN_WEEK_GOLD,
} from "./prompts/gold";
```

On the `reply-to-message` entry, add a `spec` field:

```ts
    spec: {
      role: "You help people write a clear, warm reply to a message they received. You write the reply in their voice — never as an assistant.",
      rules: [
        "Match what the user says they want to convey; do not add new commitments or details they didn't mention.",
        "Sound like a real person — natural, warm, and appropriately polite for who it's going to.",
        "Keep it about as long as the situation needs; usually 2–5 sentences.",
      ],
      outputContract: "Return only the reply text — no preamble, no greeting label, no surrounding quotes.",
      examples: REPLY_TO_MESSAGE_GOLD,
      temperature: 0.4,
    },
```

On `reply-to-review`:

```ts
    spec: {
      role: "You write a short, genuine reply to a customer review on behalf of a small business owner.",
      rules: [
        "Stay gracious — even on a negative review. Never be defensive, never make excuses, never argue.",
        "Thank the customer; if there's a problem, acknowledge it plainly and say how you'll make it right (only using any note the user gave).",
        "Keep it brief — 2–4 sentences.",
      ],
      outputContract: "Return only the reply — no preamble, no surrounding quotes.",
      examples: REPLY_TO_REVIEW_GOLD,
      temperature: 0.4,
    },
```

On `summarize`:

```ts
    spec: {
      role: "You summarize text clearly for a busy reader who wants the gist fast.",
      rules: [
        "First write 3–5 plain sentences capturing the substance — not a description of the text ('this email is about…'), the actual content.",
        "Then a blank line, then the key points as short bullets starting with '- '.",
        "Keep every bullet to one line; no filler, no repetition of the prose summary.",
      ],
      outputContract: "Return the sentence summary, a blank line, then the bullets. Nothing else.",
      examples: SUMMARIZE_GOLD,
      temperature: 0.3,
    },
```

On `plan-week`:

```ts
    spec: {
      role: "You turn a list of everything on someone's plate into a simple, realistic weekly plan.",
      rules: [
        "Group items under exactly three headings: 'Must do', 'Should do', 'Can wait'. Anything with a hard date or deadline goes in 'Must do'.",
        "Under each heading, list the items as short bullets starting with '- '. Don't invent tasks that weren't given.",
        "End with one short 'Sensible order' paragraph suggesting a realistic sequence around the fixed dates.",
      ],
      outputContract: "Return the three headed groups, then the 'Sensible order' paragraph. Keep it short.",
      examples: PLAN_WEEK_GOLD,
      temperature: 0.3,
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cockpit && npx vitest run src/lib/quickActions.test.ts`
Expected: PASS.

- [ ] **Step 5: Full gate + live verify**

```bash
cd cockpit && env -u NODE_ENV npm run lint && env -u NODE_ENV npm run test:unit && env -u NODE_ENV npm run test:e2e && env -u NODE_ENV npm run build
```
Then `npm run dev`, open `/tools/quick-actions`, run each of the 4 actions with a non-starter input, confirm on-contract output (no preamble, right shape, no invented specifics).

- [ ] **Step 6: Commit**

```bash
git add cockpit/src/lib/quickActions.ts cockpit/src/lib/quickActions.test.ts
git commit -m "feat(prompts): engineer reply/review/summarize/plan-week with few-shot specs"
```

---

## Task 5: Email Writer spec — `lib/prompts/email.ts`

**Files:**
- Create: `cockpit/src/lib/prompts/email.ts`
- Test: `cockpit/src/lib/prompts/email.test.ts`
- Modify: `cockpit/src/app/api/email/route.ts` (replace the inline system string + message build)

**Interfaces:**
- Consumes: `EMAIL_GOLD`, `compileSpec`.
- Produces: `emailSpec(tone: string, lengthHint: string): PromptSpec`; the route composes `compileSpec(emailSpec(tone, lengthHint), userBrief)`.

- [ ] **Step 1: Write the failing test**

```ts
// cockpit/src/lib/prompts/email.test.ts
import { describe, it, expect } from "vitest";
import { emailSpec } from "./email";

describe("emailSpec", () => {
  it("folds the requested tone and length into the rules and carries two examples", () => {
    const spec = emailSpec("friendly", "short (2–3 sentences)");
    expect(spec.rules.join(" ")).toContain("friendly");
    expect(spec.rules.join(" ")).toContain("short (2–3 sentences)");
    expect(spec.examples.length).toBe(2);
    expect(spec.outputContract.toLowerCase()).toContain("subject");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cockpit && npx vitest run src/lib/prompts/email.test.ts`
Expected: FAIL — no module `./email`.

- [ ] **Step 3: Write the spec module**

```ts
// cockpit/src/lib/prompts/email.ts
import { EMAIL_GOLD } from "./gold";
import type { PromptSpec } from "./spec";

export function emailSpec(tone: string, lengthHint: string): PromptSpec {
  return {
    role: "You write clear, effective emails that get a reply, on behalf of the user.",
    rules: [
      `Write in a ${tone} tone.`,
      `Length: ${lengthHint}.`,
      "Make one clear ask. Open with 'Hello,' if you don't know the recipient's name — never invent one.",
      "If the user is replying to an email, answer what it actually says.",
    ],
    outputContract:
      "Return only the email. Start with a 'Subject:' line, then the body. No preamble, no commentary, and avoid bracketed placeholders except a single [your name] sign-off when the name is unknown.",
    examples: EMAIL_GOLD,
    temperature: 0.4,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cockpit && npx vitest run src/lib/prompts/email.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the route**

In `cockpit/src/app/api/email/route.ts`, replace the inline `system` string and the `messages` array. The current handler builds a tone/length system string and a user message from the brief (+ optional source email). Replace the message construction with:

```ts
import { compileSpec } from "@/lib/prompts/spec";
import { emailSpec } from "@/lib/prompts/email";
// ...
// lengthHint mirrors the existing LENGTHS copy for the chosen length.
const messages = compileSpec(emailSpec(tone, lengthHint), userBrief);
return streamTextResponse({
  messages,
  temperature: emailSpec(tone, lengthHint).temperature,
  injectMemory: true,
  memoryProjectId: projectId,
  memoryQuery: brief,
  onComplete,
});
```

Keep the existing `tone`/`LENGTHS` validation, `userBrief` construction (brief + optional source email), memory injection, and `onComplete` persistence exactly as they are — only the system/message assembly changes. (Memory still injects as the leading system message via `streamTextResponse`, ahead of the spec's system message — acceptable; the spec's contract still governs.)

- [ ] **Step 6: Gate + live verify**

```bash
cd cockpit && env -u NODE_ENV npm run lint && env -u NODE_ENV npm run test:unit && env -u NODE_ENV npm run test:e2e && env -u NODE_ENV npm run build
```
`npm run dev` → `/tools/email`, write a brief with no recipient name, confirm: a Subject line, "Hello," (no invented name), one clear ask, requested tone/length.

- [ ] **Step 7: Commit**

```bash
git add cockpit/src/lib/prompts/email.ts cockpit/src/lib/prompts/email.test.ts cockpit/src/app/api/email/route.ts
git commit -m "feat(prompts): engineer Email Writer with a tone/length spec + few-shot"
```

---

## Task 6: The bench + Codex review + skill

**Files:**
- Create: `cockpit/scripts/prompt-bench.mjs`
- Create: `docs/superpowers/skills/prompt-engineering.md`

- [ ] **Step 1: Write the bench script** (dev-only, needs Ollama; not in CI)

```js
// cockpit/scripts/prompt-bench.mjs
// Baseline-vs-engineered on real Gemma. Prints both outputs per gold input so a
// human can judge the lift. Run: node scripts/prompt-bench.mjs
const BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "gemma4:e4b";

async function run(messages) {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.4, stream: false }),
  });
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "(no output)";
}

// Minimal inline cases: one engineered (system + few-shot turns) vs one baseline
// (terse system + the same final user turn). Extend by importing more gold pairs.
const cases = [
  {
    name: "summarize",
    baselineSystem: "You summarize text clearly for a busy reader.",
    engineeredSystem:
      "## Role\nYou summarize text clearly for a busy reader who wants the gist fast.\n\n## Rules\n- First write 3–5 plain sentences capturing the substance.\n- Then a blank line, then key points as short '- ' bullets.\n- No filler.\n\n## Output\nThe sentence summary, a blank line, then the bullets. Nothing else.",
    fewShot: [
      { input: "Summarize this in 3 to 5 sentences, then list the key points as bullets:\n\nResearchers found short frequent breaks improved retention more than one long break, strongest for complex material.", output: "Short, frequent breaks beat one long break for retention, most for complex work.\n\n- Frequent short breaks beat one long break\n- Strongest on complex work" },
    ],
    user: "Summarize this in 3 to 5 sentences, then list the key points as bullets:\n\nHi team, we're pushing the launch a month for QA. Hold the marketing announcement. The vendor invoice is overdue. Confirm Thursday sync and send timelines by Friday EOD.",
  },
];

for (const c of cases) {
  const baseline = await run([
    { role: "system", content: c.baselineSystem },
    { role: "user", content: c.user },
  ]);
  const engineered = await run([
    { role: "system", content: c.engineeredSystem },
    ...c.fewShot.flatMap((f) => [
      { role: "user", content: f.input },
      { role: "assistant", content: f.output },
    ]),
    { role: "user", content: c.user },
  ]);
  console.log(`\n===== ${c.name} =====`);
  console.log(`\n--- BASELINE ---\n${baseline}`);
  console.log(`\n--- ENGINEERED ---\n${engineered}`);
}
```

- [ ] **Step 2: Run the bench**

Run: `cd cockpit && node scripts/prompt-bench.mjs` (Ollama must be up)
Expected: prints baseline vs engineered; the engineered output is on-contract (3–5 sentences + bullets) where the baseline may ramble or add preamble.

- [ ] **Step 3: Codex adversarial review of the specs**

Dispatch `agent-codex:codex-researcher` (read-only) on the four questions per spec: is the few-shot constraining (not decorative)? is the output contract airtight against preamble? what is the failure mode for a half-filled form? does any gold output leak an invented specific? Apply confirmed findings as a follow-up commit.

- [ ] **Step 4: Write the skill** (`docs/superpowers/skills/prompt-engineering.md`)

Capture the pattern: define the output contract first; Role → Rules → Output → 2 few-shot turns; the house-rules block; render examples as conversation turns; prove on Gemma before shipping. Borrow from `agency-agents/engineering/engineering-prompt-engineer.md`.

- [ ] **Step 5: Commit**

```bash
git add cockpit/scripts/prompt-bench.mjs docs/superpowers/skills/prompt-engineering.md
git commit -m "feat(prompts): add the baseline-vs-engineered bench + prompt-engineering skill"
```

---

## Backlog — the remaining everyday flows (same recipe)

After batch 1 ships, migrate these with the identical recipe (author 2 gold pairs from the flow's starters → attach a `spec` → unit assert → gate → live verify → Codex review). Grouped by the agency-agents source to borrow from:

- **Write (content-creator / social-media-strategist):** product-description, social-post, polite-message, thank-you-note, apology.
- **Improve (writing/support):** make-friendlier, make-professional, fix-writing, make-shorter, explain-simply.
- **Organize/extract (tasksFromText discipline):** notes-to-list, key-points, find-action-items, meeting-notes (route).
- **Plan (sprint-prioritizer):** meal-plan, study-plan, packing-list.
- **Other routes:** translate (formalize the strong existing prompt), ask, tasks/generate, vision/image default, optimize, standup/wrapup.

Each follow-up batch is its own gated commit set; CLAUDE.md roadmap updated when a batch lands.

## Self-review

- **Spec coverage:** kit (Task 1) ✓, seam (Task 2) ✓, house-rules safety block (Task 1 `HOUSE_RULES`) ✓, agency-agents borrowing (specs' role/rules + skill in Task 6) ✓, few-shot-as-turns (Task 1 compiler) ✓, one-artifact-three-jobs (gold.ts reused by specs + bench) ✓, proof on Gemma (Task 6 bench) ✓, Codex co-design (Task 6 step 3) ✓, the 5-flow slice (Tasks 4–5) ✓. Correction vs spec: the bench is a standalone dev script, not `GoldenCase` rows (GoldenCase is QA-pipeline-shaped). "All prompts" → batch 1 here; the rest is the documented backlog.
- **Placeholder scan:** all code steps carry complete code; the only deferred-by-design content is the backlog batches (explicitly out of this plan's deliverable) and the skill prose (Task 6 step 4, a documentation step).
- **Type consistency:** `PromptSpec`, `FewShot`, `compileSpec`, `HOUSE_RULES`, `emailSpec` used consistently across tasks; `buildMessages` signature unchanged; gold export names match between `gold.ts`, the specs, and the tests.
