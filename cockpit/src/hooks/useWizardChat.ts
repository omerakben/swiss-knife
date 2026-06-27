"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ERROR_SENTINEL } from "@/lib/ai/sentinel";

export type WizardMessage = { role: "user" | "assistant"; content: string };

// Only the recent tail is ever used (the route keeps the last 8 valid turns);
// posting the whole on-screen conversation would grow the body unbounded over a
// long session. A small buffer above the server cap keeps context intact.
const SEND_TAIL = 12;

// Replace the content of the last assistant message (the one currently
// streaming) without mutating the array in place.
function withLastAssistant(list: WizardMessage[], content: string): WizardMessage[] {
  const copy = [...list];
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i].role === "assistant") {
      copy[i] = { ...copy[i], content };
      break;
    }
  }
  return copy;
}

// Multi-turn streaming consumer for /api/wizard. A dedicated hook rather than
// bending useAiTool (which is single-shot — output is replaced each run). Aborts
// the in-flight fetch on unmount so leaving the page stops the local engine.
export function useWizardChat() {
  const [messages, setMessages] = useState<WizardMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || streaming) return;
      setError(null);
      const history: WizardMessage[] = [...messages, { role: "user", content: q }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);
      setElapsedMs(0);
      const startedAt = Date.now();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/wizard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.slice(-SEND_TAIL) }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          let msg = `Request failed (${res.status})`;
          try {
            const d = await res.json();
            if (d?.error) msg = d.error;
          } catch {
            /* keep default */
          }
          throw new Error(msg);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          if (acc.includes(ERROR_SENTINEL)) {
            const [textPart, err] = acc.split(ERROR_SENTINEL);
            setMessages((m) => withLastAssistant(m, textPart));
            throw new Error(err?.trim() || "Stream error");
          }
          setMessages((m) => withLastAssistant(m, acc));
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    },
    [messages, streaming],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, streaming, error, elapsedMs, send, stop, reset };
}
