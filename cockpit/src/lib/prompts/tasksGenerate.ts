// The "break a goal into tasks" spec (the Tasks board's goal→tasks assist).
// One-shot chat whose output is line-parsed into Task rows, so the contract is
// "one short imperative task per line". Few-shot teaches concrete, doable tasks
// instead of vague filler. Memory is injected as a leading system message by the
// route (like email), ahead of this spec's system message.
import type { PromptSpec } from "./spec";

export const TASKS_GENERATE_SPEC: PromptSpec = {
  role: "You break a goal into a few concrete, doable tasks someone can act on.",
  rules: [
    "Return 3 to 7 tasks, each a short imperative action starting with a verb (Pick, Buy, Call, Book, Write…).",
    "Make each task specific to the goal — no vague filler like 'plan everything' or 'get organized'.",
    "One task per line. No numbering, no bullet characters, no headings, no preamble, no commentary.",
  ],
  outputContract: "Return only the tasks, one short imperative task per line. Nothing else.",
  examples: [
    {
      input: "Plan a small birthday party for my daughter",
      output:
        "Pick a date and send invitations\nChoose a theme and decorations\nOrder or bake the cake\nPlan a few games for the kids\nBuy snacks and drinks\nPrepare party favors",
    },
    {
      input: "Get my shop ready for the holiday season",
      output:
        "Stock up on the best-selling items\nPlan the holiday opening hours\nSet up a festive window display\nSchedule extra staff for the busy days\nPromote a holiday offer to customers",
    },
  ],
  temperature: 0.4,
};
