# Everyday prompt kit — engineered prompts for a local 4B

Date: 2026-06-27

## Goal

Make Haven Desk's **everyday flows** reliable on the local Gemma 4B for people who do not know how to prompt — a grocery-store owner, a salon owner, a small restaurant, a household, a truck operator. The lever is the prompt itself: a non-technical user cannot rescue a weak prompt by rephrasing, so the prompt must carry 100% of the reliability. We move every everyday flow from a terse one-line system string to an engineered spec — role priming, an explicit output contract, a shared safety block, and **two worked few-shot examples** — borrowing real material from the `agency-agents` library, and we prove the lift on real Gemma with the existing golden/bench rig.

Scope is the everyday surface only. **All QA/Dev tools are explicitly out of scope** — that audience can already prompt, and those tools already carry engineered prompts.

## Why this works (the one idea)

A skilled user smooths over a vague instruction; a 4B does not. On a small instruction-tuned model, the single biggest reliability lever is **few-shot rendered as real conversation turns** plus an explicit output contract. "Here is exactly how I respond" (alternating user/assistant turns) beats "here are some examples" (prose), and "Return only the reply, ≤4 sentences, no preamble" beats "be concise." This is the whole thesis of the repo's own Prompt Engineer agent: *a prompt is a spec; if the model didn't do what you wanted, the spec was ambiguous.*

## Decisions reached (brainstorm + agency-agents study)

- **Target is the non-technical everyday user.** Out of scope: every QA/Dev tool (code-review, qa-pipeline, bug-report, rubric-designer, eval-cases, adr, complexity, api-contract). In scope: the 26 Quick Actions, Email Writer, Summarize, Meeting Notes, Translate, Image questions, Smart Inbox.
- **Few-shot as alternating turns, not inline prose.** The compiler emits `system → user(ex1) → assistant(gold1) → user(ex2) → assistant(gold2) → user(real)`.
- **One artifact, three jobs.** The example *inputs* already ship as starter chips (`BUILTIN_STARTERS`). We author the ideal *output* for ~2 per flow. That pair is simultaneously the few-shot example, the starter chip, and a `GoldenCase` for the bench. DRY by construction.
- **A shared house-rules safety block** on every everyday spec — serves the safe/private promise: never invent specifics the user didn't give; ask for the missing piece instead of fabricating; plain language; do not pose as a lawyer/doctor/accountant (consistent with the high-stakes pack guardrails).
- **Non-breaking migration.** Extend the existing `QuickAction` seam; the old `system`/`buildPrompt` path keeps working for un-migrated flows.
- **Evidence, not claims.** Baseline (today's one-liner) vs engineered (spec) scored through the existing rubric/bench on `gemma4:e4b`; keep a rewrite only when it wins.
- **Co-designed with Codex.** Opus drafts each spec; Codex (GPT-5.5) adversarially reviews it before it ships (builder/verifier). Two frontier models design the prompts the local model runs.

## Design

### The kit — `lib/prompts/spec.ts` (pure, unit-tested)

```ts
export type FewShot = { input: string; output: string };

export type PromptSpec = {
  /** "You are X. Your only job is Y." — role priming, one or two sentences. */
  role: string;
  /** Explicit constraints. No vague qualifiers: "≤4 sentences", never "be concise". */
  rules: string[];
  /** Exact output shape: "Return only the reply. No preamble, no surrounding quotes." */
  outputContract: string;
  /** Two worked examples, rendered as real conversation turns. */
  examples: FewShot[];
  /** Per-spec temperature (extraction → 0; everyday writing → 0.3–0.4). */
  temperature?: number;
  /** Opt out of the shared house-rules block when a flow needs a different stance. */
  omitHouseRules?: boolean;
};
```

`compileSpec(spec, userInput): ChatMessage[]`:

1. System message = `## Role` + `## Rules` (bulleted) + house-rules block (unless `omitHouseRules`) + `## Output` (the contract). Sections joined with blank lines.
2. Then **two example turns**: for each `FewShot`, push `{ role: "user", content: input }` and `{ role: "assistant", content: output }`.
3. Then `{ role: "user", content: userInput }`.

`HOUSE_RULES: string[]` — the shared, borrowed-from-`agency-agents` guardrail block, injected as part of `## Rules` so it reads as one rule list to the model.

### Integration with the existing seam — `lib/quickActions.ts`

- `QuickAction` gains an optional `spec?: PromptSpec`. When present, `buildMessages(action, inputs)` returns `compileSpec(action.spec, action.buildPrompt(inputs))`. When absent, it returns the current `[{system}, {user: buildPrompt(inputs)}]` — so un-migrated actions are untouched.
- `buildPrompt(inputs)` is unchanged: it still templates the user's form inputs into the final user message. The few-shot `examples` live on the spec and use the same input shape as the starter chips.
- Email Writer, Summarize, Meeting Notes, Translate are migrated the same way — each gets a `PromptSpec` in its own small catalog module (`lib/prompts/catalog/*`) that the route imports, replacing the inline system string.

### Few-shot authoring — reuse the starters, author the gold

The example inputs already exist as `BUILTIN_STARTERS` (e.g. `reply-to-review:unhappy` → a real unhappy-review string + note). For each migrated flow we pick the two most representative starter inputs and author the **ideal output** — short, on-contract, in the borrowed voice. These gold pairs are exported so they seed `GoldenCase` rows for the bench.

### Borrowing from agency-agents (the mapping)

| Flow(s) | Borrow from | What we take |
|---|---|---|
| reply-to-review, product-description, social-post | `marketing-content-creator`, `marketing-social-media-strategist` | benefit-first framing, "no defensiveness on negative reviews", punchy length |
| email | `marketing-email-strategist` | subject-line discipline, one ask per message |
| polite-message, apology, thank-you-note | support/writing agents | take-responsibility-don't-over-explain, warmth without filler |
| plan-week, study-plan, packing-list | `product-sprint-prioritizer` | Must/Should/Can-wait ordering (RICE-lite), realistic scoping |
| summarize, key-points, explain-simply | academic summarization patterns | tight bullets, no filler, plain language |
| notes-to-list, find-action-items, meeting-notes | existing `tasksFromText` discipline | "only real to-dos, never invent owners/dates" |
| translate | the existing careful-translator prompt (already strong) | preserve, formalize into a spec |

Methodology (Role → Constraints → Examples, ≥2 test cases, version it) comes from `engineering-prompt-engineer.md`.

### Proof on real Gemma — `lib/prompts/bench`

A small harness (script or a Vitest-style live runner, run manually, not in CI since it needs Ollama) that, for each migrated flow, runs both the baseline messages and the engineered messages on `gemma4:e4b` and records the outputs side by side. Scoring reuses the app's rubric/`scoreFeature`/`extractVerdict` path where a rubric fits, and a short human-readable diff where it doesn't. The gold pairs become `GoldenCase` rows so the win is reproducible in `/bench`. We keep a rewrite only when it scores at least as well as baseline on the contract (format compliance, no invented specifics, length) and better on quality.

### Codex co-design loop (the "agencies of prompting")

For each flow: Opus drafts the `PromptSpec` (role, rules, contract, the two gold outputs). Codex (`agent-codex:codex-researcher`, read-only refute mode) reviews against four questions — does the few-shot actually constrain a 4B, or is it decorative? is the output contract airtight (could the model still add preamble)? what is the failure mode for a *confused* user who half-fills the form? does the gold output leak any invented specific? We fix confirmed findings, then ship. The methodology is captured as a reusable **`prompt-engineering` skill / doc** so future everyday flows follow the same Role→Constraints→Contract→2-examples pattern without re-deriving it.

## This session's slice (provable in one sitting)

Five everyday flows, end-to-end through the kit, spanning the small-business + household personas:

1. **reply-to-message** (respond) — household + small business
2. **reply-to-review** (write, customer-facing) — small business
3. **email** (write, the blank-box tool) — both
4. **summarize** (organize) — both
5. **plan-week** (plan) — both

Each: a `PromptSpec`, two authored gold few-shot pairs, measured baseline-vs-engineered lift on `gemma4:e4b`, Codex review. If the pattern holds, scale to the remaining flows in a follow-up batch.

## Out of scope (YAGNI)

- All QA/Dev tools and their prompts.
- A prompt-versioning UI / changelog surface (the spec lives in code under git; that is version control enough for v1).
- Auto-selecting few-shot examples by similarity at runtime (the two examples are curated per flow; dynamic selection is a later token/quality lever).
- Per-user editable specs (the starters are already user-CRUD-able for *inputs*; editing the engineered prompt itself is not a v1 need).
- A model-graded auto-bench in CI (the live bench needs Ollama; it stays a manual, human-reviewed step).

## Testing

- **Unit (pure):** `compileSpec` emits the exact message order (system, then 2 user/assistant example pairs, then the real user turn); the system text contains Role + every rule + the house-rules block + the contract; `omitHouseRules` drops the block; an empty `examples` array yields just `[system, user]`. `buildMessages` falls back to the legacy path when `spec` is absent and uses the compiler when present. A drift test: every migrated `QuickAction.spec.examples[i].input` is a real starter input shape for that action.
- **Route-mocked e2e:** the existing Quick Action / Email / Summarize specs still pass (the route contract is unchanged — same endpoint, same streamed text); a migrated action runs and streams a result.
- **Live verify** on `gemma4:e4b`: for each of the 5 flows, the engineered prompt returns on-contract output (no preamble, right length, borrowed voice, no invented specifics) where the baseline was looser; the baseline-vs-engineered bench shows the win.

## Implementation checklist

1. `lib/prompts/spec.ts`: `PromptSpec`, `FewShot`, `HOUSE_RULES`, `compileSpec`; unit tests.
2. `lib/quickActions.ts`: optional `spec` on `QuickAction`; `buildMessages` compiles from it when present (legacy fallback intact); unit tests for both paths.
3. `lib/prompts/catalog/*`: the 5 specs (reply-to-message, reply-to-review, email, summarize, plan-week) with two authored gold pairs each; wire Email/Summarize routes to their specs.
4. Export gold pairs as `GoldenCase` seeds; the bench harness for baseline-vs-engineered.
5. Codex adversarial review of each spec; fix confirmed findings.
6. `prompt-engineering` skill/doc capturing the pattern.
7. Gate each step (`env -u NODE_ENV`: lint, unit, e2e, build) + live verify on Gemma + CLAUDE.md roadmap note.

## Risks and mitigations

1. **A bigger prompt slows the cold 4B** (two example turns add tokens) → keep examples short (the gold outputs are ≤4–6 lines), only two of them, light model only; the existing elapsed-seconds indicator already covers cold-load latency.
2. **The few-shot is decorative, not constraining** (the top failure mode) → the Codex refute pass explicitly tests this; the bench keeps a rewrite only on a measured win, so a spec that doesn't beat baseline does not ship.
3. **Gold outputs leak an invented specific** and teach the model to hallucinate → author gold outputs that only use what their example input provides; the house-rules block reinforces it; Codex checks each gold pair for leaks.
4. **Migration breaks an un-touched action** → the `spec`-optional design means actions without a spec use the exact current code path; unit tests pin both paths.
5. **Scope creep into QA/Dev** → the spec names the in-scope surface explicitly; QA/Dev prompts are not touched.
