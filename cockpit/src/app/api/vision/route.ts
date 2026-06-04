import { assertOllamaReady } from "@/lib/health";
import { streamTextResponse } from "@/lib/ai/streamRoute";

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

  const text = typeof prompt === "string" && prompt.trim() ? prompt.trim() : "Describe this image in detail.";

  return streamTextResponse({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
  });
}
