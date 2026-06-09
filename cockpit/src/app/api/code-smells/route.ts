import { scanCode } from "@/lib/codeSmells";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 80_000;

// Deterministic, model-independent code-smell scan. No Ollama needed.
export async function POST(req: Request) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || typeof code !== "string" || !code.trim()) {
    return Response.json({ error: "Paste code or a unified diff to review." }, { status: 400 });
  }
  if (code.length > MAX_CHARS) {
    return Response.json({ error: "That's too much code — paste a focused snippet or diff." }, { status: 413 });
  }
  return Response.json(scanCode(code));
}
