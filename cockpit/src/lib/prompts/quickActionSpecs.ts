// The engineered prompts for Quick Actions, keyed by action id. Kept separate
// from quickActions.ts (which owns the UI: titles, inputs, starters) so every
// engineered prompt is reviewable in one place and adding a flow is a one-file
// edit. buildMessages (quickActions.ts) looks an action up here by id; the
// few-shot example inputs are derived from the action's own buildPrompt over the
// gold inputs (mirroring by construction). See docs/superpowers/skills/prompt-engineering.md
import type { GoldPair, PromptSpec } from "./spec";
import {
  REPLY_TO_MESSAGE_GOLD,
  REPLY_TO_REVIEW_GOLD,
  SUMMARIZE_GOLD,
  PLAN_WEEK_GOLD,
} from "./gold";

export type QuickActionSpec = { spec: Omit<PromptSpec, "examples">; gold: GoldPair[] };

export const QUICK_ACTION_SPECS: Record<string, QuickActionSpec> = {
  "reply-to-message": {
    spec: {
      role: "You help people write a clear, warm reply to a message they received. You write the reply in their voice — never as an assistant.",
      rules: [
        "Match what the user says they want to convey; do not add new commitments or details they didn't mention.",
        "Sound like a real person — natural, warm, and appropriately polite for who it's going to.",
        "Keep it about as long as the situation needs; usually 2–5 sentences.",
      ],
      outputContract: "Return only the reply text — no preamble, no greeting label, no surrounding quotes.",
      temperature: 0.4,
    },
    gold: REPLY_TO_MESSAGE_GOLD,
  },
  "reply-to-review": {
    spec: {
      role: "You write a short, genuine reply to a customer review on behalf of a small business owner.",
      rules: [
        "Stay gracious — even on a negative review. Never be defensive, never make excuses, never argue.",
        "Thank the customer; if there's a problem, acknowledge it plainly. Offer a specific remedy only if the user's note gives one — with no note, apologize sincerely and invite them back without inventing a fix.",
        "Keep it brief — 2–4 sentences.",
      ],
      outputContract: "Return only the reply — no preamble, no surrounding quotes.",
      temperature: 0.4,
    },
    gold: REPLY_TO_REVIEW_GOLD,
  },
  summarize: {
    spec: {
      role: "You summarize text clearly for a busy reader who wants the gist fast.",
      rules: [
        "First write 3–5 plain sentences capturing the substance — not a description of the text ('this email is about…'), the actual content.",
        "Then a blank line, then the key points as short bullets starting with '- '.",
        "Keep every bullet to one line; no filler, no repetition of the prose summary.",
      ],
      outputContract: "Return the sentence summary, a blank line, then the bullets. Nothing else.",
      temperature: 0.3,
    },
    gold: SUMMARIZE_GOLD,
  },
  "plan-week": {
    spec: {
      role: "You turn a list of everything on someone's plate into a simple, realistic weekly plan.",
      rules: [
        "Group items under exactly three headings: 'Must do', 'Should do', 'Can wait'. Anything with a hard date or deadline goes in 'Must do'.",
        "Under each heading, list the items as short bullets starting with '- '. Don't invent tasks that weren't given.",
        "End with one short 'Sensible order' paragraph suggesting a realistic sequence around the fixed dates.",
      ],
      outputContract: "Return the three headed groups, then the 'Sensible order' paragraph. Keep it short.",
      temperature: 0.3,
    },
    gold: PLAN_WEEK_GOLD,
  },
};
