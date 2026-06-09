"use client";

import { useRef, useState } from "react";

import { useAiTool } from "@/hooks/useAiTool";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VoiceTextarea } from "@/components/tools/VoiceTextarea";
import { AiOutput } from "@/components/tools/AiOutput";
import { ErrorAlert } from "@/components/ErrorAlert";
import { Square } from "lucide-react";
import type { ClaimIssue, ComplexityScan } from "@/lib/complexity";

type Verdict = { timeBigO: string; spaceBigO: string; hotspots: { line: number; note: string }[] };
type Result = { verdict: Verdict; scan: ComplexityScan; warnings: ClaimIssue[]; ok: boolean };

export function ComplexityAnalyzer() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const derivation = useAiTool({
    endpoint: "/api/complexity-derivation",
    buildBody: (input, extra) => ({
      code: input,
      timeBigO: extra?.timeBigO,
      spaceBigO: extra?.spaceBigO,
    }),
  });

  async function analyze() {
    if (!code.trim() || busy || derivation.isRunning) return;
    setBusy(true);
    setError(null);
    setResult(null);
    derivation.reset();
    setSecs(0);
    const startedAt = Date.now();
    timer.current = setInterval(() => setSecs(Math.round((Date.now() - startedAt) / 1000)), 500);
    let data: Result;
    try {
      const res = await fetch("/api/complexity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Couldn't analyze the snippet.");
      data = json as Result;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't analyze the snippet.");
      return;
    } finally {
      setBusy(false);
      if (timer.current) clearInterval(timer.current);
    }
    // Stream the step-by-step derivation, grounded on the verdict just shown.
    await derivation.run(code, {
      timeBigO: data.verdict.timeBigO,
      spaceBigO: data.verdict.spaceBigO,
    });
  }

  const scan = result?.scan;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Complexity Analyzer</h1>
      <p className="mt-1 text-muted-foreground">
        Paste a TS/JS snippet. The local model estimates time/space Big-O and the hotspots; a
        deterministic scan of loops, recursion, and sorting audits the claim — a super-linear bound
        over code with no growth mechanism gets flagged, not trusted.
      </p>

      <VoiceTextarea
        className="mt-6"
        rows={12}
        value={code}
        placeholder="Paste a function or snippet…"
        onValueChange={setCode}
        textareaClassName="font-mono text-sm"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && code.trim() && !busy) {
            e.preventDefault();
            analyze();
          }
        }}
        disabled={busy || derivation.isRunning}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={analyze} disabled={busy || derivation.isRunning || !code.trim()}>
          {busy ? `Analyzing… ${secs}s` : "Analyze"}
        </Button>
        {derivation.isRunning && (
          <Button variant="ghost" onClick={derivation.stop}>
            <Square className="mr-1 h-4 w-4" /> Stop
          </Button>
        )}
      </div>

      {error && <ErrorAlert className="mt-4" title="Analysis failed" message={error} />}

      {result && scan && (
        <div className="mt-6 space-y-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="secondary" className="shrink-0 font-mono">
              time {result.verdict.timeBigO}
            </Badge>
            <Badge variant="secondary" className="shrink-0 font-mono">
              space {result.verdict.spaceBigO}
            </Badge>
            <Badge variant={result.ok ? "outline" : "destructive"} className="shrink-0">
              {result.ok ? "scan-consistent" : "questionable claim"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              loop depth {scan.maxLoopDepth} · recursion {scan.hasRecursion ? "yes" : "no"} · sort{" "}
              {scan.hasSort ? "yes" : "no"}
            </span>
          </div>

          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <Card key={i}>
                  <CardContent className="flex items-start gap-3 py-3">
                    <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">
                      WARN
                    </Badge>
                    <span className="min-w-0 flex-1 text-sm">{w.message}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {result.verdict.hotspots.length > 0 && (
            <Card>
              <CardContent className="py-3">
                <p className="text-xs font-medium text-muted-foreground">Hotspots</p>
                <div className="mt-2 space-y-1.5">
                  {result.verdict.hotspots.map((h, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
                        L{h.line}
                      </span>
                      <span className="min-w-0 flex-1 text-sm">{h.note}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AiOutput output={derivation.output} status={derivation.status} label="Derivation" />
      {derivation.error && (
        <ErrorAlert className="mt-4" title="Derivation failed" message={derivation.error} />
      )}
    </div>
  );
}
