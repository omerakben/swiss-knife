"use client";

import { useState } from "react";

export default function PromptOptimizer() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function run(save: boolean) {
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, save }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setOutput(data.optimized);
      if (save) setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">✨ Prompt Optimizer</h1>
      <p className="mt-1 text-neutral-500">
        Rewrite a rough prompt into a sharp one using local Gemma.
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste a rough prompt here..."
        rows={6}
        className="mt-6 w-full rounded-lg border border-neutral-300 bg-white p-3 text-sm"
      />

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => run(false)}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {loading ? "Optimizing…" : "Optimize"}
        </button>
        <button
          onClick={() => run(true)}
          disabled={loading || !input.trim()}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40"
        >
          Optimize & save to library
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">⚠ {error}</p>}
      {saved && <p className="mt-4 text-sm text-green-600">✓ Saved to library</p>}

      {output && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-neutral-500">Optimized prompt</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-4 text-sm">
{output}
          </pre>
        </div>
      )}
    </div>
  );
}
