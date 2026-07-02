"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlaceholder, refreshToolHints } from "@/hooks/useToolHints";

type EditHintButtonProps = {
  /** A PLACEHOLDER_DEFAULTS key (lib/toolHints.ts). */
  hintKey: string;
  /** Human label for the field this hint belongs to, used in the aria-label. */
  label: string;
};

/**
 * A small pencil next to a placeholder-bearing input, letting a user rewrite
 * the grey example text shown in the box before they type. Mirrors the
 * StarterChips edit affordance, applied to the box's own hint instead of a
 * fill-and-run preset. Save PUTs the new text; "Reset to default" PUTs empty
 * text, which the API treats as a delete-and-revert — one affordance, one
 * meaning, no separate "are you sure" for reset.
 */
export function EditHintButton({ hintKey, label }: EditHintButtonProps) {
  const current = usePlaceholder(hintKey);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(current);
  const [saving, setSaving] = useState(false);

  async function putHint(value: string): Promise<boolean> {
    try {
      const res = await fetch("/api/tool-hints", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: hintKey, text: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save the hint");
      refreshToolHints();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the hint");
      return false;
    }
  }

  async function save() {
    setSaving(true);
    const ok = await putHint(text);
    setSaving(false);
    if (ok) {
      toast.success("Hint updated");
      setOpen(false);
    }
  }

  async function reset() {
    setSaving(true);
    const ok = await putHint("");
    setSaving(false);
    if (ok) {
      toast.success("Hint reset");
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        aria-label={`Edit hint: ${label}`}
        onClick={() => {
          setText(current);
          setOpen(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!saving) setOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit hint</DialogTitle>
            <DialogDescription>
              This is the grey example text shown in the box before you type. Make it yours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`hint-text-${hintKey}`}>Hint text</Label>
            <Textarea
              id={`hint-text-${hintKey}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" disabled={saving} onClick={reset}>
              Reset to default
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
