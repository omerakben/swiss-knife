import { lintAdr } from "@/lib/adrLint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deterministic, model-independent MADR lint. No Ollama needed.
export async function POST(req: Request) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Paste an ADR to lint." }, { status: 400 });
  }
  if (text.length > 80_000) {
    return Response.json({ error: "That's too long — paste one ADR." }, { status: 413 });
  }
  return Response.json(lintAdr(text));
}
