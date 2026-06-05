import { assertOllamaReady } from "@/lib/health";
import { streamTextResponse } from "@/lib/ai/streamRoute";
import { visionMessages } from "@/lib/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { prompt, image } = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    image?: string;
  };

  if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
    return Response.json({ error: "Attach an image first." }, { status: 400 });
  }

  return streamTextResponse({ messages: visionMessages(image, prompt) });
}
