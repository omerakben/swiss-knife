import { assertOllamaReady } from "@/lib/health";
import { streamTextResponse } from "@/lib/ai/streamRoute";
import { buildRefineMessages } from "@/lib/quickActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Matches the quick-action refine branch so the same draft refines from any tool.
const MAX_TEXT = 80000;

// Shared one-tap refine over any AI draft: revise the given text per a plain
// instruction and return only the revised text. Tool-agnostic (no memory, no
// action context) so Email Writer, Brainstorming, Templates, and the prompt
// optimizer all reuse it. Mirrors the quick-action route's refine branch.
export async function POST(req: Request) {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { text, instruction } = (await req.json().catch(() => ({}))) as {
    text?: string;
    instruction?: string;
  };
  const t = typeof text === "string" ? text.trim() : "";
  const instr = typeof instruction === "string" ? instruction.trim() : "";
  if (!t || !instr) return Response.json({ error: "Nothing to refine." }, { status: 400 });
  if (t.length > MAX_TEXT) {
    return Response.json({ error: "That draft is too long to refine." }, { status: 413 });
  }

  return streamTextResponse({ messages: buildRefineMessages(t, instr.slice(0, 500)) });
}
