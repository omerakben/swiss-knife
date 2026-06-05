// Shared Gemma-vision helpers. Used by api/vision (streamed, interactive) and
// api/capture (one-shot, to describe a captured screenshot/image into an Idea).
import { chat, type ChatMessage } from "@/lib/ollama";
import { getEffectiveConfig } from "@/lib/config";

export const DEFAULT_VISION_PROMPT =
  "Describe this image in detail. If it contains text, transcribe it.";

/** Build the multimodal message for a vision request (text prompt + image). */
export function visionMessages(dataUrl: string, prompt?: string): ChatMessage[] {
  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt?.trim() || DEFAULT_VISION_PROMPT },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ];
}

/** One-shot description of an image (data URL), honoring the effective config. */
export async function describeImage(dataUrl: string, prompt?: string): Promise<string> {
  const { model, baseUrl, temperature } = await getEffectiveConfig();
  return chat(visionMessages(dataUrl, prompt), { model, baseUrl, temperature });
}
