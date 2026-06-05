"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Issue = { severity: "ERROR" | "WARN"; line: number; message: string };
type Lint = {
  issues: Issue[];
  summary: { errors: number; warnings: number; scenarios: number };
  ok: boolean;
};
type Rubric = { raw: string; verdict: "PASS" | "BLOCK" | "UNKNOWN" };
type RunResult = {
  projectId: string | null;
  draftFeature: string;
  lint: Lint;
  rubric: Rubric;
  savedRunId: string;
};

const EXAMPLE = `As a cashier, I want to make a walk-in cash sale of in-stock items tax-exempt at the point of sale, so a tax-exempt customer is charged correctly.
The sale must record the tax-exemption reason, and an over-tender must return the right change.`;

export function QaPipeline() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [needsPack, setNeedsPack] = useState(false);

  async function run() {
    if (!input.trim()) return;
    setBusy(true);
    setResult(null);
    setNeedsPack(false);
    try {
      const res = await fetch("/api/qa-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      if (data.needsPack) {
        setNeedsPack(true);
        return;
      }
      setResult(data as RunResult);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  const lint = result?.lint;
  const rubric = result?.rubric;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">🧪 QA Pipeline</h1>
      <p className="mt-1 text-muted-foreground">
        Paste a user story or requirement. The active project supplies the QA context (Gherkin
        standards, eval rubric, and glossary), then this drafts a <code>.feature</code>, runs the
        deterministic BDD lint, and scores it against the rubric — all locally.
      </p>

      <div className="mt-6">
        <Textarea
          rows={6}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a user story / requirement…"
          disabled={busy}
        />
        <div className="mt-2 flex gap-2">
          <Button onClick={run} disabled={busy || !input.trim()}>
            {busy ? "Running…" : "Run"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setInput(EXAMPLE);
              setResult(null);
              setNeedsPack(false);
            }}
            disabled={busy}
          >
            Load example
          </Button>
        </div>
      </div>

      {needsPack && (
        <Card className="mt-6 border-dashed">
          <CardHeader>
            <CardTitle className="text-base">This project has no QA pack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              The active project is missing its Gherkin-authoring and eval-rubric templates (and
              glossary facts). Seed a pack, then switch to that project and run again:
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs text-foreground">
              npm run seed:lbmh
            </pre>
          </CardContent>
        </Card>
      )}

      {result && lint && rubric && (
        <div className="mt-6 space-y-4">
          {/* A) Draft */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Drafted .feature</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-muted p-3 font-mono text-xs text-foreground">
                {result.draftFeature}
              </pre>
            </CardContent>
          </Card>

          {/* B) Lint */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Lint</CardTitle>
              <Badge variant={lint.ok ? "secondary" : "destructive"}>
                {lint.ok ? "PASS" : "BLOCK"}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {lint.summary.errors} error{lint.summary.errors === 1 ? "" : "s"},{" "}
                {lint.summary.warnings} warning{lint.summary.warnings === 1 ? "" : "s"} ·{" "}
                {lint.summary.scenarios} scenario{lint.summary.scenarios === 1 ? "" : "s"}
              </p>
              {lint.issues.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Clean — no issues found.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {lint.issues.map((it, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-md border border-border p-2">
                      <Badge
                        variant={it.severity === "ERROR" ? "destructive" : "outline"}
                        className="mt-0.5 text-[10px]"
                      >
                        {it.severity}
                      </Badge>
                      <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        L{it.line}
                      </span>
                      <span className="flex-1 text-sm">{it.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* C) Rubric */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Rubric score</CardTitle>
              <Badge
                variant={
                  rubric.verdict === "PASS"
                    ? "secondary"
                    : rubric.verdict === "BLOCK"
                      ? "destructive"
                      : "outline"
                }
              >
                {rubric.verdict}
              </Badge>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-foreground">
                {rubric.raw}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
