import { assertOllamaReady } from "@/lib/health";
import { streamTextResponse } from "@/lib/ai/streamRoute";
import { buildRefineSystem } from "@/lib/refine";
import type { ChatMessage } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TURNS = 10;

// The Refine coach: a streaming, multi-turn idea-discussion on the light model.
// Same shape as /api/wizard (history POSTed each turn, capped here), but the
// system prompt is the chosen AHA lens (interview/align/critique/sharpen) rather
// than the app manual. No memory injection — Refine reasons about the idea the
// person is typing, not their stored facts, and a fact block slows the 4B (the
// documented perf lesson); the streaming drafting still stays snappy.
export async function POST(req: Request) {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { messages, mode } = (await req.json().catch(() => ({}))) as {
    messages?: { role?: string; content?: string }[];
    mode?: string;
  };
  const raw = Array.isArray(messages) ? messages : [];
  if (raw.length > 200) {
    return Response.json({ error: "This discussion is very long — start a fresh one." }, { status: 400 });
  }
  const history: ChatMessage[] = raw
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content!.trim().slice(0, 6000) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "Share an idea to refine." }, { status: 400 });
  }

  return streamTextResponse({
    messages: [{ role: "system", content: buildRefineSystem(mode) }, ...history],
    temperature: 0.4,
    injectMemory: false,
  });
}
