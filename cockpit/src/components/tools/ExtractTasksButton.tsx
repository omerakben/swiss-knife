"use client";

import { useRef, useState } from "react";
import { ListPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DraftTaskReview, type ReviewRow } from "@/components/tasks/DraftTaskReview";
import type { DraftTask } from "@/lib/meetingNotes";

/**
 * Reusable "turn text into tasks": extract via /api/result-tasks → review dialog
 * (DraftTaskReview) → create. The single home for this orchestration, shared by
 * Quick-Action results and saved notes. The text is snapshotted at click time.
 */
export function ExtractTasksButton({
  text,
  label = "Turn into tasks",
  busyLabel = "Reading…",
  size = "sm",
  variant = "outline",
  className = "h-7 px-2 text-xs",
}: {
  text: string;
  label?: string;
  busyLabel?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  className?: string;
}) {
  const [extracting, setExtracting] = useState(false);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  // A synchronous lock: state flags update async, so a fast double-click can pass
  // a state-based guard twice and double-write. One in-flight op at a time.
  const busyRef = useRef(false);

  async function extractTasks() {
    const snapshot = text;
    if (!snapshot.trim() || busyRef.current) return;
    busyRef.current = true;
    setExtracting(true);
    try {
      const res = await fetch("/api/result-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: snapshot }),
      });
      const data = (await res.json().catch(() => ({}))) as { tasks?: DraftTask[]; dropped?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't read that");
      const tasks = data.tasks ?? [];
      if (tasks.length === 0) {
        toast.message("No clear to-dos found", { description: "There wasn't anything actionable to pull out." });
        return;
      }
      if ((data.dropped ?? 0) > 0) {
        toast.message(`Showing the first ${tasks.length} tasks`, { description: `${data.dropped} more didn’t fit.` });
      }
      setRows(tasks.map((t) => ({ ...t, keep: true })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that");
    } finally {
      busyRef.current = false;
      setExtracting(false);
    }
  }

  async function addTasks() {
    const keep = (rows ?? []).filter((r) => r.keep && r.title.trim());
    if (keep.length === 0 || busyRef.current) return;
    busyRef.current = true;
    setAdding(true);
    try {
      const res = await fetch("/api/result-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ create: keep }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't add the tasks");
      const n = data.created ?? keep.length;
      setRows(null);
      toast.success(`Added ${n} tasks`, {
        action: { label: "Open Tasks", onClick: () => { window.location.href = "/tools/tasks"; } },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the tasks");
    } finally {
      busyRef.current = false;
      setAdding(false);
    }
  }

  function update(i: number, patch: Partial<ReviewRow>) {
    setRows((rs) => (rs ? rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : rs));
  }

  const keepCount = (rows ?? []).filter((r) => r.keep && r.title.trim()).length;

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={extractTasks} disabled={!text || extracting}>
        <ListPlus className="mr-1 h-3.5 w-3.5" />
        {extracting ? busyLabel : label}
      </Button>

      <Dialog open={rows !== null} onOpenChange={(o) => !o && setRows(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review tasks</DialogTitle>
            <DialogDescription>Untick anything you don’t want. Nothing is added until you confirm.</DialogDescription>
          </DialogHeader>
          {rows && <DraftTaskReview rows={rows} onUpdate={update} />}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRows(null)}>
              Cancel
            </Button>
            <Button onClick={addTasks} disabled={adding || keepCount === 0}>
              {adding ? "Adding…" : `Add ${keepCount} tasks`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
