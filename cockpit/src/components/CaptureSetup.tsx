"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CaptureSetup() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/capture/token")
      .then((r) => r.json())
      .then((d) => {
        if (active) setToken(d.token ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function regen() {
    const r = await fetch("/api/capture/token", { method: "POST" });
    const d = await r.json();
    setToken(d.token ?? null);
    toast.success("New token generated");
  }

  const curl = token
    ? `curl -X POST http://localhost:3000/api/capture \\\n  -H "x-capture-token: ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"target":"task","text":"Buy milk"}'`
    : "Loading…";

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Quick capture</h2>
      <p className="text-sm text-muted-foreground">
        POST text to the capture endpoint to file it as a task, fact, prompt, or idea. Wire this
        token into a macOS Shortcut, Raycast, or a hotkey to capture from anywhere.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="capture-token">Token</Label>
        <div className="flex gap-2">
          <Input id="capture-token" readOnly value={token ?? "…"} className="font-mono text-xs" />
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(token ?? "");
              toast.success("Copied");
            }}
          >
            Copy
          </Button>
          <Button variant="ghost" onClick={regen}>
            Regenerate
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Test command</Label>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted p-2 text-xs">
          {curl}
        </pre>
      </div>

      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer">macOS Shortcut setup</summary>
        <ol className="ml-4 mt-2 list-decimal space-y-1">
          <li>Open Shortcuts and create a new shortcut (or Quick Action that receives text).</li>
          <li>
            Add a “Get Contents of URL” action. URL: http://localhost:3000/api/capture. Method:
            POST.
          </li>
          <li>Add a header: x-capture-token = your token above.</li>
          <li>
            Request Body: JSON with target set to task (or fact/prompt/idea) and text set to the
            Shortcut Input (the selected text).
          </li>
          <li>Assign a keyboard shortcut so you can capture selected text from any app.</li>
        </ol>
      </details>
    </div>
  );
}
