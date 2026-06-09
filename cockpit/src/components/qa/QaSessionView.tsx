"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QaIterationCard } from "@/components/qa/QaIterationCard";
import type { Session } from "@/components/qa/types";

type Props = {
  session: Session;
  onBack: () => void;
  onRefine: (instruction: string) => Promise<void>;
  onEditDraft: (id: string, draftFeature: string) => Promise<void>;
  onRescore: (id: string) => Promise<void>;
  onDeleteIteration: (id: string) => Promise<void>;
  onRename: (title: string) => Promise<void>;
  onDeleteSession: () => Promise<void>;
};

export function QaSessionView({
  session,
  onBack,
  onRefine,
  onEditDraft,
  onRescore,
  onDeleteIteration,
  onRename,
  onDeleteSession,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(session.title);
  const [removing, setRemoving] = useState(false);

  async function refine() {
    if (!instruction.trim()) return;
    setRefining(true);
    try {
      await onRefine(instruction);
      setInstruction("");
    } finally {
      setRefining(false);
    }
  }

  // One-click "you only tested the happy path" fix: append the missing
  // unhappy-path scenarios through the same refine loop (re-linted on append).
  const NEGATIVE_PATHS =
    "Add the missing unhappy-path scenarios only: invalid inputs, security/permission failures, and boundary values. " +
    "Keep every scenario that already passes; add one new Scenario per gap, each with a single When and the standard intent/suite/type tags.";

  async function addNegativePaths() {
    setRefining(true);
    try {
      await onRefine(NEGATIVE_PATHS);
    } finally {
      setRefining(false);
    }
  }

  async function saveTitle() {
    const t = titleDraft.trim();
    if (!t || t === session.title) {
      setRenaming(false);
      return;
    }
    await onRename(t);
    setRenaming(false);
  }

  async function removeSession() {
    setRemoving(true);
    try {
      await onDeleteSession();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to history
      </button>

      <div className="mt-3 flex items-start justify-between gap-4">
        {renaming ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="max-w-md"
              autoFocus
            />
            <Button size="sm" onClick={saveTitle}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTitleDraft(session.title);
                setRenaming(false);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <h2
            className="cursor-pointer text-xl font-semibold hover:underline"
            title="Click to rename"
            onClick={() => {
              setTitleDraft(session.title);
              setRenaming(true);
            }}
          >
            {session.title}
          </h2>
        )}
        <Button size="sm" variant="ghost" onClick={removeSession} disabled={removing}>
          {removing ? "Deleting…" : "Delete session"}
        </Button>
      </div>

      <details className="mt-3 rounded-md border border-border bg-card p-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">Original story</summary>
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{session.story}</p>
      </details>

      <div className="mt-6 space-y-4">
        {session.iterations.map((it) => (
          <QaIterationCard
            key={it.id}
            iteration={it}
            onEditDraft={onEditDraft}
            onRescore={onRescore}
            onDelete={onDeleteIteration}
          />
        ))}
      </div>

      <div className="mt-6 rounded-md border border-dashed border-border p-4">
        <h3 className="text-sm font-medium">Refine with a follow-up</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Describe what the latest draft is missing. The model revises iteration {session.iterations.length}{" "}
          into a new one (keeps the standards and existing scenarios).
        </p>
        <Textarea
          rows={3}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. add a boundary case for a special order with a 50% deposit…"
          className="mt-2"
          disabled={refining}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={refine} disabled={refining || !instruction.trim()}>
            {refining ? "Refining…" : "Refine"}
          </Button>
          <Button
            variant="outline"
            onClick={addNegativePaths}
            disabled={refining}
            title="Append invalid / security / boundary scenarios via the same refine loop"
          >
            + Negative paths
          </Button>
        </div>
      </div>
    </div>
  );
}
