"use client";

import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExtractTasksButton } from "@/components/tools/ExtractTasksButton";
import { EMAIL_BRIEF_KEY } from "@/components/email/EmailWriter";

/**
 * Make a saved note actionable: turn it into tasks (shared extract→review→add),
 * or hand it to the Email Writer as a brief. Closes the loop — a note was a
 * dead-end (copy/edit/delete) before this.
 */
export function NoteActions({ text }: { text: string }) {
  const router = useRouter();

  function draftEmail() {
    if (!text.trim()) return;
    // One-time handoff via sessionStorage (not the URL — notes can be long and
    // private); the Email Writer consumes it on mount.
    try {
      sessionStorage.setItem(EMAIL_BRIEF_KEY, text);
    } catch {
      /* private mode / storage disabled — fall through to an empty composer */
    }
    router.push("/tools/email-writer");
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Use it:</span>
      <ExtractTasksButton text={text} label="Turn into tasks" />
      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={draftEmail} disabled={!text}>
        <Mail className="mr-1 h-3.5 w-3.5" /> Draft an email
      </Button>
    </div>
  );
}
