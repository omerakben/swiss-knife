"use client";

import { useState } from "react";
import { Brain } from "lucide-react";

type RankedFact = {
  id: string;
  key: string | null;
  value: string;
  category: string | null;
  pinned: boolean;
  score: number | null;
};

/**
 * Provenance panel: the memory facts that informed an AI output, ranked the same
 * way the tools inject them (active project + global). Lazy — fetches the active
 * project's ranked context for `query` only when expanded.
 */
export function ContextUsed({ query }: { query: string }) {
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState<RankedFact[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || facts || !query.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/memory/context?query=${encodeURIComponent(query)}&limit=8`);
      const data = await res.json();
      setFacts(data.facts ?? []);
    } catch {
      setFacts([]);
    } finally {
      setBusy(false);
    }
  }

  if (!query.trim()) return null;

  return (
    <div className="mt-2 text-xs">
      <button onClick={toggle} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <Brain className="h-3 w-3" /> Context used {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="mt-1 rounded-md border border-border p-2">
          {busy ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : !facts || facts.length === 0 ? (
            <p className="text-muted-foreground">No memory facts informed this output.</p>
          ) : (
            <ul className="space-y-0.5">
              {facts.map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  {f.score !== null && (
                    <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">
                      {Math.round(Math.max(0, f.score) * 100)}%
                    </span>
                  )}
                  <span className="flex-1">
                    {f.key ? `${f.key}: ` : ""}
                    {f.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
