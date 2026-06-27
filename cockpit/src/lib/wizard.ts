import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { MANUAL, type ManualEntry } from "@/lib/manual";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The Haven Desk manual rendered as a system prompt: a closed tool list derived
 * from the nav registry (so the model can never name a tool that doesn't exist)
 * plus per-tool how-to/examples. Pure — unit-tested and reused per request.
 */
export function buildWizardSystemPrompt(
  items: NavItem[] = NAV_ITEMS,
  manual: Record<string, ManualEntry> = MANUAL,
): string {
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

/**
 * Tools named in an assistant message, for one-click "Open" chips. Matches nav
 * labels (word-boundary, longest-first so "Email Writer" beats a shorter
 * overlap), dedups, puts everyday tools before advanced ones, caps at `max`.
 * The candidate set IS the registry, so a returned tool always exists — this is
 * the deterministic backstop against a hallucinated tool name in the prose.
 */
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
