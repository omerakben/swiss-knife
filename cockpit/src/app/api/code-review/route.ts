import { assertOllamaReady } from "@/lib/health";
import { getActiveProjectId } from "@/lib/project";
import { streamTextResponse } from "@/lib/ai/streamRoute";
import { scanCode } from "@/lib/codeSmells";
import type { ChatMessage } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 80_000;

// The model EXPLAINS what the deterministic scan found — it doesn't get to
// invent the findings. 12B-appropriate: grounded explanation, not discovery.
const SYSTEM = `You are a senior code reviewer. You receive a TS/JS snippet (or a unified diff)
plus a list of mechanically-detected issues (severity, line, rule, message).

For each detected issue: explain in 1-3 sentences why it matters IN THIS code, then give a
minimal, concrete fix (a short code sketch where useful). Group issues that share a root cause.
Order by severity (ERRORs first). Use the exact line numbers given — never invent new ones.
After covering the detected issues you may add at most two brief items under "Other
observations" if something important is clearly visible in the code. If the issue list is
empty, say the scan is clean and give one short paragraph of overall impressions.
Be direct and specific. No generic lectures, no praise padding.`;

export async function POST(req: Request) {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || typeof code !== "string" || !code.trim()) {
    return Response.json({ error: "Paste code or a unified diff to review." }, { status: 400 });
  }
  if (code.length > MAX_CHARS) {
    return Response.json({ error: "That's too much code — paste a focused snippet or diff." }, { status: 413 });
  }

  // Re-scan server-side (deterministic + free) rather than trusting the client.
  const scan = scanCode(code);
  const findings =
    scan.issues.map((i) => `- [${i.severity}] L${i.line} (${i.rule}): ${i.message}`).join("\n") ||
    "(none — the scan is clean)";

  const projectId = await getActiveProjectId();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `${scan.summary.mode === "diff" ? "Unified diff" : "Code"}:\n\`\`\`\n${code}\n\`\`\`\n\nMechanically-detected issues:\n${findings}`,
    },
  ];

  return streamTextResponse({
    messages,
    injectMemory: true,
    memoryProjectId: projectId,
    memoryQuery: code.slice(0, 800),
  });
}
