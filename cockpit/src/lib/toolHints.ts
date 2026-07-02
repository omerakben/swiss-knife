// ToolHint: makes the grey placeholder example text in tool inputs user-editable
// (the "make it yours" idea already shipped for Starters, applied to the box's
// own hint text instead of a fill-and-run preset). This registry is the
// deterministic gate: PLACEHOLDER_DEFAULTS is the single source of truth for
// which keys exist, so an unknown key 400s at the API and every default
// renders synchronously on first paint (no DB round trip needed to know what
// the box should say) — the many getByPlaceholder e2e selectors stay
// deterministic even against an empty/fresh DB. See
// docs/superpowers/specs/2026-07-01-placeholder-crud-design.md.

import { QUICK_ACTIONS } from "./quickActions";

export const MAX_HINT = 300;
export const quickActionHintKey = (actionId: string, field: string) => `quick-action:${actionId}:${field}`;

// The 10 hand-authored (non-Quick-Action) placeholder strings, moved verbatim
// from their components — a byte-for-byte copy, not a rewrite, so this move
// never silently changes shipped copy. The strings themselves stay owned here;
// a later task swaps each component's literal for `usePlaceholder(key)`.
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

// Every Quick Action input that ships a code placeholder gets an auto-derived
// key, so Quick Action boxes don't need hand-maintained entries here — this
// generator is itself the coverage test's other half.
const generated: Record<string, string> = {};
for (const a of QUICK_ACTIONS) for (const inp of a.inputs) {
  if (inp.placeholder) generated[quickActionHintKey(a.id, inp.name)] = inp.placeholder;
}
export const PLACEHOLDER_DEFAULTS: Record<string, string> = { ...generated, ...STATIC_DEFAULTS };

export type HintValidation = { ok: boolean; error?: string };

/**
 * Gate a ToolHint write: the key must be a real registry entry (unknown keys
 * 400 — this is what keeps a stray/typo'd key from silently living in the DB
 * forever) and the text must be a non-empty string within the cap. Reset
 * (empty/whitespace text) is handled by the route, not here — this only
 * validates a real save.
 */
export function validateHint(key: string, text: string): HintValidation {
  if (!Object.hasOwn(PLACEHOLDER_DEFAULTS, key)) return { ok: false, error: "Unknown hint." };
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "The hint needs some text." };
  if (text.length > MAX_HINT) return { ok: false, error: "That hint is too long." };
  return { ok: true };
}
