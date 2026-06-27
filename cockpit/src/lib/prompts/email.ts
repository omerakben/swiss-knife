// The Email Writer spec. Tone and length vary per request, so this is a builder
// that folds them into the rules; the few-shot examples demonstrate the format
// (Subject line, no invented names) regardless of tone.
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
