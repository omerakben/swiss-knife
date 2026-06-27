"use client";

import { useRef, useState } from "react";
import { StickyNote, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ExtractTasksButton } from "@/components/tools/ExtractTasksButton";
import { deriveNoteTitle } from "@/lib/resultTitle";
import type { QuickAction } from "@/lib/quickActions";

/**
 * Save a Quick Action result: as a note (every result, verbatim — no model
 * re-run) or, on list/plan actions, as real Tasks (extract → review → add, via
 * the shared ExtractTasksButton). The result text is snapshotted at click time,
 * since a refine may still stream.
 */
export function ResultSaveActions({ text, action }: { text: string; action: QuickAction }) {
  const [savedNote, setSavedNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  // A synchronous lock: the state flags update async, so a fast double-click can
  // pass a state-based guard twice and double-write. One in-flight op at a time.
  const busyRef = useRef(false);

  async function saveNote() {
    const snapshot = text;
    if (!snapshot.trim() || savedNote || busyRef.current) return;
    busyRef.current = true;
    setSavingNote(true);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: deriveNoteTitle(snapshot, action.title), content: snapshot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      setSavedNote(true);
      toast.success("Saved as a note", {
        action: { label: "Open", onClick: () => { window.location.href = "/tools/notes"; } },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      busyRef.current = false;
      setSavingNote(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Save it:</span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={saveNote}
        disabled={!text || savingNote || savedNote}
      >
        {savedNote ? <Check className="mr-1 h-3.5 w-3.5" /> : <StickyNote className="mr-1 h-3.5 w-3.5" />}
        {savedNote ? "Saved" : "Save as note"}
      </Button>
      {action.canSaveTasks && <ExtractTasksButton text={text} label="Save as tasks" />}
    </div>
  );
}
