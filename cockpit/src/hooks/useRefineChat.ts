"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ERROR_SENTINEL } from "@/lib/ai/sentinel";
import type { RefineModeId } from "@/lib/refine";

export type RefineMessage = { role: "user" | "assistant"; content: string };

// Only the recent tail is sent (the route keeps the last 10 valid turns);
// posting the whole on-screen discussion would grow the body unbounded.
const SEND_TAIL = 14;

function withLastAssistant(list: RefineMessage[], content: string): RefineMessage[] {
  const copy = [...list];
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i].role === "assistant") {
      copy[i] = { ...copy[i], content };
      break;
    }
  }
  return copy;
}

// Multi-turn streaming consumer for /api/refine/chat. Like useWizardChat, but
// each send carries the active lens (interview/align/critique/sharpen) so the
// person can switch how they're being helped mid-discussion. Aborts the in-flight
// fetch on unmount so leaving the page stops the local engine.
export function useRefineChat() {
  const [messages, setMessages] = useState<RefineMessage[]>([]);
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
    async (text: string, mode: RefineModeId) => {
      const q = text.trim();
      if (!q || streaming) return;
      setError(null);
      const history: RefineMessage[] = [...messages, { role: "user", content: q }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);
      setElapsedMs(0);
      const startedAt = Date.now();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/refine/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.slice(-SEND_TAIL), mode }),
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
