import { streamChat, type ChatMessage } from "@/lib/ollama";
import { getEffectiveConfig } from "@/lib/config";
import { ERROR_SENTINEL } from "@/lib/ai/sentinel";

export { ERROR_SENTINEL };

type StreamTextArgs = {
  messages: ChatMessage[];
  /** Per-call override; defaults to the effective settings temperature. */
  temperature?: number;
  /** Called once with the full assembled text after the stream completes (e.g. to save). */
  onComplete?: (fullText: string) => Promise<void> | void;
};

/**
 * The shared streaming-route helper. Every AI tool route returns this:
 * it streams tokens to the client as plain text and runs onComplete (save)
 * after the full response is assembled server-side.
 */
export function streamTextResponse({ messages, temperature, onComplete }: StreamTextArgs): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        const cfg = await getEffectiveConfig();
        for await (const token of streamChat(messages, {
          temperature: temperature ?? cfg.temperature,
          model: cfg.model,
          baseUrl: cfg.baseUrl,
        })) {
          full += token;
          controller.enqueue(encoder.encode(token));
        }
        if (onComplete) await onComplete(full);
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream failed";
        controller.enqueue(encoder.encode(`\n${ERROR_SENTINEL} ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}
