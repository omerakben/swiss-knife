import { assertOllamaReady } from "@/lib/health";
import { chat } from "@/lib/ollama";
import { getEffectiveConfig } from "@/lib/config";
import { getActiveProjectId } from "@/lib/project";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Paste some text to extract facts from." }, { status: 400 });
  }

  const cfg = await getEffectiveConfig();
  const out = await chat(
    [
      {
        role: "system",
        content:
          "Extract durable, reusable facts about the user, their projects, preferences, or constraints from the text. Return ONLY a plain list, one concise fact per line, no numbering, no commentary. Skip anything transient or trivial. Max 8 facts.",
      },
      { role: "user", content: text.trim() },
    ],
    { model: cfg.model, baseUrl: cfg.baseUrl, temperature: 0.3 }
  );

  const values = out
    .split("\n")
    .map((l) => l.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter((l) => l.length > 2)
    .slice(0, 8);

  if (values.length === 0) {
    return Response.json({ error: "No facts found in that text." }, { status: 422 });
  }

  const projectId = await getActiveProjectId();
  const created = [];
  for (const value of values) {
    created.push(
      await prisma.memoryFact.create({
        data: { value: value.slice(0, 300), source: "ai", status: "pending", projectId },
      })
    );
  }

  return Response.json({ facts: created });
}
