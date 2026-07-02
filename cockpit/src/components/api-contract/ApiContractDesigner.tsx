"use client";

import { useRef, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VoiceTextarea } from "@/components/tools/VoiceTextarea";
import { ErrorAlert } from "@/components/ErrorAlert";
import { downloadText } from "@/lib/download";
import { usePlaceholder } from "@/hooks/useToolHints";
import { EditHintButton } from "@/components/EditHintButton";
import type { OpenapiLintResult } from "@/lib/openapiLint";

type Result = {
  mode: "designed" | "linted";
  yamlText: string;
  lint: OpenapiLintResult;
  ok: boolean;
};

export function ApiContractDesigner() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputPlaceholder = usePlaceholder("api-contract");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function run() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setSecs(0);
    const startedAt = Date.now();
    timer.current = setInterval(() => setSecs(Math.round((Date.now() - startedAt) / 1000)), 500);
    try {
      const res = await fetch("/api/api-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Couldn't process the contract.");
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't process the contract.");
    } finally {
      setBusy(false);
      if (timer.current) clearInterval(timer.current);
    }
  }

  const s = result?.lint.summary;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">API Contract Designer</h1>
      <p className="mt-1 text-muted-foreground">
        Describe an endpoint in prose and the local model drafts an OpenAPI 3.1 contract — or paste
        an existing OpenAPI document and it&apos;s linted directly (no model). Either way the gate is
        real validation against the official 3.1 schema plus design rules: documented failure
        shapes (4xx/5xx), pagination on lists, operation ids.
      </p>

      <div className="mt-6">
        <div className="flex justify-end">
          <EditHintButton hintKey="api-contract" label="Endpoint description" />
        </div>
        <VoiceTextarea
          className="mt-1"
          rows={10}
          value={input}
          placeholder={inputPlaceholder}
          onValueChange={setInput}
          textareaClassName="font-mono text-sm"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && input.trim() && !busy) {
              e.preventDefault();
              run();
            }
          }}
          disabled={busy}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={run} disabled={busy || !input.trim()}>
          {busy ? `Working… ${secs}s` : "Design / lint contract"}
        </Button>
      </div>

      {error && <ErrorAlert className="mt-4" title="Contract run failed" message={error} />}

      {result && s && (
        <div className="mt-6 space-y-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant={result.ok ? "secondary" : "destructive"} className="shrink-0">
              {result.ok ? "GATE PASS" : "GATE BLOCK"}
            </Badge>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {result.mode}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {s.errors} error{s.errors === 1 ? "" : "s"}, {s.warnings} warning
              {s.warnings === 1 ? "" : "s"} · {s.operations} operation{s.operations === 1 ? "" : "s"}
              {s.version ? ` · OpenAPI ${s.version}` : ""}
            </span>
          </div>

          {result.lint.issues.length > 0 && (
            <div className="space-y-2">
              {result.lint.issues.map((it, i) => (
                <Card key={i}>
                  <CardContent className="flex items-start gap-3 py-3">
                    <Badge
                      variant={it.severity === "ERROR" ? "destructive" : "outline"}
                      className="mt-0.5 shrink-0 text-[10px]"
                    >
                      {it.severity}
                    </Badge>
                    <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
                      {it.path}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">{it.message}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">contract (YAML)</p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(result.yamlText);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="mr-1 h-4 w-4" /> Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadText("openapi.yaml", result.yamlText, "application/yaml")}
                    title="Download as .yaml"
                  >
                    <Download className="mr-1 h-4 w-4" /> Export .yaml
                  </Button>
                </div>
              </div>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-mono text-xs">
                {result.yamlText}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
