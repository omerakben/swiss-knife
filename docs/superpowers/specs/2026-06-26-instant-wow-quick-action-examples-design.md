# Instant wow: Quick Action examples + featured home demo

Date: 2026-06-26

## Goal

Remove the last bit of friction in Quick Actions: the blank form. A user should feel the value in seconds, without thinking up something to type. Tap an example and watch it run for real. This is the marketable "wow in seconds" moment, aligned with the product vision (simple, one-click, valuable for people who don't know how to prompt).

Decisions reached in brainstorming:
- Locus: both. Examples on every action, plus a featured demo on the home.
- Behavior: tapping an example fills the inputs and runs immediately (one tap to a live result), then the user edits to make it their own.
- Real runs only. No canned/faked output; when the engine is down, the demo run shows the same "start your AI engine" message as everywhere else.
- Approach: examples in the data; chips on the runner form; a dedicated inline component on the home.

## Design

### A. Data (`cockpit/src/lib/quickActions.ts`, no backend change)

- Extend `QuickAction` with `examples?: { label: string; inputs: Record<string, string> }[]`.
- Author one realistic, relatable example per action (a couple for the hero actions) whose inputs produce a strong result.
- Add `FEATURED_DEMO: { actionId: string; exampleIndex: number }` (one curated pick, e.g. `reply-to-message` example 0) for the home demo. Add a resolver `getFeaturedDemo()` returning `{ action, example } | null`.
- Examples reuse the existing `buildMessages`; no new prompt logic.

### B. Per-action example chips (`cockpit/src/components/QuickActions.tsx`)

- When `active.examples?.length`, render a "Try an example" row of chips (one per example, labelled) above the form.
- Tapping a chip calls `runWith(inputs)`: `setValues(inputs)` to fill the visible form, then `run("", { actionId, inputs })` with the inputs passed directly (not read from state, to avoid a stale-state race). The user sees the filled form and the streamed result, then can edit and re-run.

### C. Featured home demo (`cockpit/src/components/FeaturedDemo.tsx`, new client component)

- Rendered at the top of the dashboard for new users (empty DB / `firstRun`), above the persona picker, so the first thing a brand-new person sees is "See Haven Desk work."
- Shows the featured action's title and its example in plain terms, plus a "See it work" button. Tapping runs the example inline via `useAiTool` + `AiOutput`, streaming the result right there. After it runs: a "Make it yours" link to that action's runner (`/tools/quick-actions?action=<id>`). The quick-actions hero sits just below.
- Calls the existing `POST /api/quick-action`. No new endpoint, no DB write.

### D. Wiring (`cockpit/src/app/page.tsx`)

- Render `<FeaturedDemo />` when `firstRun` (above `<PersonaPicker />`). It disappears once the user has any content (`firstRun` false); returning users keep the regular quick-actions hero.

### E. Tests

- `quickActions.test.ts`: every example's inputs satisfy `missingInputs(action, example.inputs) === []` (a typo can't ship a broken example); `getFeaturedDemo()` resolves to a real action + example index.
- No e2e (verified live in a browser).

## Out of scope (YAGNI)

- Demo rotation/randomization beyond the single curated featured pick.
- Saving demo output.
- A canned-result fallback for the engine-down case (the standard health error is used).

## Implementation checklist

1. `quickActions.ts`: add `examples` to the type; author an example for each action; add `FEATURED_DEMO` + `getFeaturedDemo()`. (TDD: the example-validity test first.)
2. `QuickActions.tsx`: chip row + `runWith`.
3. `FeaturedDemo.tsx`: the inline home demo.
4. `page.tsx`: render it for `firstRun`.
5. Gate (lint, unit, build, e2e) + live verify (a chip run and the home "See it work" on the real model). Codex review, then merge.

## Verification

Live on `gemma4:e4b`: tapping an example chip fills the form and produces a live result; the home "See it work" streams a result inline. Plus the data test and the standard gates.
