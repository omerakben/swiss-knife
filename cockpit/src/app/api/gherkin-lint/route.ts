import { lintGherkin } from "@/lib/gherkinLint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deterministic, model-independent BDD lint. No Ollama needed.
export async function POST(req: Request) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Paste a .feature to lint." }, { status: 400 });
  }
  return Response.json(lintGherkin(text));
}
