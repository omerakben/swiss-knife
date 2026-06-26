"use client";

import Link from "next/link";
import { Sparkles, Square } from "lucide-react";

import { useAiTool } from "@/hooks/useAiTool";
import { Button } from "@/components/ui/button";
import { AiOutput } from "@/components/tools/AiOutput";
import { ErrorAlert } from "@/components/ErrorAlert";
import { getFeaturedDemo } from "@/lib/quickActions";

/**
 * The "wow in seconds" on the home: one tap runs a real example inline, so a
 * brand-new user sees Haven Desk do something useful before typing anything. No
 * faked output — it streams a real result from the local model (and shows the
 * standard "start your engine" message if the engine is down).
 */
export function FeaturedDemo() {
  const demo = getFeaturedDemo();
  const { output, status, error, isRunning, elapsedMs, run, stop } = useAiTool({
    endpoint: "/api/quick-action",
    buildBody: (_input, extra) => extra,
  });

  if (!demo) return null;
  const { action, example } = demo;
  const secs = Math.round(elapsedMs / 1000);

  async function seeItWork() {
    await run("", { actionId: action.id, inputs: example.inputs });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="font-semibold">See Haven Desk work</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        One tap, no typing. This runs the {action.title} action on a real example, locally on your machine.
      </p>

      <div className="mt-3 space-y-1 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        {action.inputs.map((inp) =>
          example.inputs[inp.name] ? (
            <p key={inp.name}>
              <span className="font-medium text-foreground">{inp.label}:</span> {example.inputs[inp.name]}
            </p>
          ) : null,
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={seeItWork} disabled={isRunning}>
          {isRunning ? `Working… ${secs}s` : status === "done" ? "Run it again" : "See it work"}
        </Button>
        {isRunning && (
          <Button variant="ghost" onClick={stop}>
            <Square className="mr-1 h-4 w-4" /> Stop
          </Button>
        )}
        {status === "done" && (
          <Link
            href={`/tools/quick-actions?action=${action.id}`}
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            Make it yours →
          </Link>
        )}
      </div>

      {error && <ErrorAlert className="mt-3" title="Couldn't run the demo" message={error} />}
      <AiOutput output={output} status={status} label="Result" />
    </div>
  );
}
