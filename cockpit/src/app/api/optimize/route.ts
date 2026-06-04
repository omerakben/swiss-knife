import { assertOllamaReady } from "@/lib/health";
import { streamTextResponse } from "@/lib/ai/streamRoute";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You are a prompt engineering assistant. Rewrite the user's prompt to be
clearer, more specific, and more effective for an LLM. Preserve intent. Add structure
(role, task, constraints, output format) where helpful. Return ONLY the improved prompt,
no preamble or explanation.`;

export async function POST(req: Request) {
  // Health gate: clear 503 with guidance if Ollama is down or the model is missing.
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { prompt, save, title } = await req.json().catch(() => ({}));
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "Missing 'prompt'." }, { status: 400 });
  }

  return streamTextResponse({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    // Save happens after the full text is assembled server-side, so the stored
    // value is identical to the non-streaming behavior.
    onComplete: save
      ? async (optimized) => {
          await prisma.prompt.create({
            data: {
              title: (title || prompt.slice(0, 60)).trim(),
              original: prompt,
              optimized,
            },
          });
        }
      : undefined,
  });
}
