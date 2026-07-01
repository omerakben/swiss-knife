export type ManualEntry = { howTo: string; examples: string[] };

// Per-tool how-to + examples for the Haven Desk guide. Keyed by the nav href.
// The drift test (wizard.test.ts) enforces that every key is a real nav tool and
// that every everyday tool has an entry, so this can't silently fall behind nav.
// Holds only what nav's `desc`/`keywords` don't — it does not re-state the desc.
export const MANUAL: Record<string, ManualEntry> = {
  "/tools/quick-actions": {
    howTo: "Pick a one-click action, fill a tiny form, and get a usable result you can refine or save.",
    examples: ["Reply to a message", "Turn notes into a to-do list", "Plan my week"],
  },
  "/tools/tasks": {
    howTo: "Capture to-dos as a list or a Kanban board; AI can turn a goal into tasks or write a standup.",
    examples: ["Add 'send the quote' due Friday", "Generate tasks from a goal"],
  },
  "/tools/meeting-notes": {
    howTo: "Paste rough meeting notes; it pulls out the action items, you review and edit, then they become real tasks.",
    examples: ["Paste notes with 'Sam to send the quote by Friday' → reviewed tasks"],
  },
  "/tools/memory": {
    howTo: "Facts the app remembers and weaves into your other tools; you accept what it learns.",
    examples: ["Save your business's tone of voice", "Review suggested facts"],
  },
  "/tools/inbox": {
    howTo: "Drop a file or paste anything — a note, a list, a message — and it's auto-sorted into a task, fact, or idea.",
    examples: ["Paste a brain-dump", "Drop a .txt or .csv"],
  },
  "/tools/image": {
    howTo: "Paste or drop an image and ask about it; tap a question preset for OCR, receipts, or a description.",
    examples: ["Read the text in a screenshot", "Pull the details off a receipt"],
  },
  "/tools/prompt-optimizer": {
    howTo: "Paste a rough prompt and get a sharper version you can save to the library.",
    examples: ["Sharpen 'write me something about my product'"],
  },
  "/tools/templates": {
    howTo: "Browse ready-made templates grouped by category, fill the blanks, and run — like a proposal writer or SOP builder.",
    examples: ["Run the proposal writer", "Find an email template"],
  },
  "/tools/prompt-library": {
    howTo: "Your saved prompts, and where you create or edit your own templates.",
    examples: ["Save a prompt you reuse", "Create a template with {{variables}}"],
  },
  "/tools/email-writer": {
    howTo: "Describe what to say and pick a tone and length; get a draft to copy, save, or send.",
    examples: ["Ask a landlord to fix a leak", "Reply declining a meeting politely"],
  },
  "/tools/brainstorm": {
    howTo: "Pick a thinking technique (alternatives, pros & cons, premortem…) and run it on your topic; results save as ideas.",
    examples: ["Pros & cons of two options", "A premortem on a plan"],
  },
  "/tools/notes": {
    howTo: "Find everything you've saved — results, brainstorms, captures, quick notes — in one searchable place; edit or copy any of them.",
    examples: ["Search your saved notes", "Edit a note you kept"],
  },
  "/tools/refine": {
    howTo: "Share a rough idea and talk it through; pick a lens — Interview me, Align, Critique, or Sharpen — and it acts like a product manager to flesh the idea out. Save the result as a note or turn it into tasks.",
    examples: ["Interview me about a newsletter idea", "Critique my plan", "Sharpen this into a brief"],
  },
  "/tools/projects": {
    howTo: "Group your prompts, tasks, ideas, and memory by project; pick the active one in the sidebar so new work files there.",
    examples: ["Create a project for a client", "Switch the active project"],
  },
  "/tools/packs": {
    howTo: "Install a workflow pack to add ready-made templates, facts, and tasks for a job — like Small Business Ops.",
    examples: ["Install Small Business Ops"],
  },
  "/tools/activity": {
    howTo: "A timeline of what happened — creates, AI runs, deletes.",
    examples: ["See what you added today"],
  },
};
