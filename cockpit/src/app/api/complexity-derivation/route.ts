import { assertOllamaReady } from "@/lib/health";
import { streamTextResponse } from "@/lib/ai/streamRoute";
import { scanComplexity } from "@/lib/complexity";
import type { ChatMessage } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 40_000;

const SYSTEM = `You explain complexity derivations step by step. Given a TS/JS snippet, the claimed
bounds, and the static scan facts, walk through HOW the bound arises: which loop contributes which
factor, what the recursion tree looks like, what dominates and why the rest doesn't. Short paragraphs
or a tight numbered list; reference real line numbers; no generic Big-O tutorials. If the scan facts
contradict the claimed bound, say so plainly and derive the bound the code actually supports.`;

export async function POST(req: Request) {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { code, timeBigO, spaceBigO } = (await req.json().catch(() => ({}))) as {
    code?: string;
    timeBigO?: string;
    spaceBigO?: string;
  };
  if (!code || typeof code !== "string" || !code.trim()) {
    return Response.json({ error: "Paste a snippet to analyze." }, { status: 400 });
  }
  if (code.length > MAX_CHARS) {
    return Response.json({ error: "That's too much code — paste a focused snippet." }, { status: 413 });
  }

  // The claimed bounds are short O(...) strings — cap them like every other
  // prompt input (a multi-MB "timeBigO" must not bypass the code cap above).
  const bigO = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : "?");

  // Recompute the scan server-side (deterministic, cheap) to ground the derivation.
  const scan = scanComplexity(code);
  const facts = `Static scan: max loop depth ${scan.maxLoopDepth}, recursion ${scan.hasRecursion ? "present" : "absent"}, sort calls ${scan.hasSort ? "present" : "absent"}, ${scan.functions.length} function(s).`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Snippet:\n\`\`\`\n${code}\n\`\`\`\n\nClaimed: time ${bigO(timeBigO)}, space ${bigO(spaceBigO)}.\n${facts}\n\nDerive the bounds.`,
    },
  ];

  // No memory injection: third-party code + structured facts, nothing personal helps.
  return streamTextResponse({ messages });
}
