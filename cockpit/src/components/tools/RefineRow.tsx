"use client";

import { REFINE_OPTIONS } from "@/lib/quickActions";

/**
 * The universal one-tap refine row ("Make it: Shorter / Friendlier / …"). Drop
 * it under any AI draft and wire `onRefine` to useAiTool's `refine`. It operates
 * on the current draft (no regenerate) and is iterative.
 */
export function RefineRow({
  onRefine,
  busy = false,
}: {
  onRefine: (instruction: string) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Make it:</span>
      {REFINE_OPTIONS.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onRefine(r.instruction)}
          disabled={busy}
          className="rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
