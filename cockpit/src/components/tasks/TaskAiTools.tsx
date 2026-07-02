"use client";

import { useState } from "react";
import { Sparkles, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { useAiTool } from "@/hooks/useAiTool";
import { usePlaceholder } from "@/hooks/useToolHints";
import { AiOutput } from "@/components/tools/AiOutput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EditHintButton } from "@/components/EditHintButton";
import { ErrorAlert } from "@/components/ErrorAlert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Task } from "./TasksView";

export function TaskAiTools({ onTasksCreated }: { onTasksCreated: (tasks: Task[]) => void }) {
  const [genOpen, setGenOpen] = useState(false);
  const [standupOpen, setStandupOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [generating, setGenerating] = useState(false);
  const goalPlaceholder = usePlaceholder("tasks-goal");

  const standup = useAiTool({ endpoint: "/api/tasks/standup", buildBody: () => ({}) });

  async function generate() {
    if (!goal.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/tasks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      onTasksCreated(data.tasks as Task[]);
      toast.success(`Added ${data.tasks.length} task(s)`);
      setGoal("");
      setGenOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setGenOpen(true)}>
          <Sparkles className="mr-1 h-4 w-4" /> Generate from goal
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStandupOpen(true)}>
          <ListChecks className="mr-1 h-4 w-4" /> Daily summary
        </Button>
      </div>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate tasks from a goal</DialogTitle>
            <DialogDescription>
              Gemma breaks it into actionable tasks, added to To do.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <EditHintButton hintKey="tasks-goal" label="Goal" />
          </div>
          <Textarea
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={goalPlaceholder}
            disabled={generating}
          />
          <DialogFooter>
            <Button onClick={generate} disabled={generating || !goal.trim()}>
              {generating ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={standupOpen}
        onOpenChange={(o) => {
          setStandupOpen(o);
          if (!o) standup.reset();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Daily summary</DialogTitle>
            <DialogDescription>A standup generated from your current board.</DialogDescription>
          </DialogHeader>
          <Button onClick={() => standup.run("")} disabled={standup.isRunning}>
            {standup.isRunning ? "Writing…" : "Generate summary"}
          </Button>
          {standup.error && <ErrorAlert className="mt-2" title="Run failed" message={standup.error} />}
          <AiOutput output={standup.output} status={standup.status} label="Standup" />
        </DialogContent>
      </Dialog>
    </>
  );
}
