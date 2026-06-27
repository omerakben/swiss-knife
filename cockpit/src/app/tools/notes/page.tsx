import { StickyNote } from "lucide-react";

import { prisma } from "@/lib/db";
import { getActiveProjectId } from "@/lib/project";
import { RecentItems } from "@/components/RecentItems";
import { EmptyState } from "@/components/EmptyState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The home for saved text. Ideas are the catch-all store five tools write to —
// Save-as-note on a result, Brainstorming, Image captures, quick-capture — but
// they only surfaced under Brainstorming → Recent ideas. This is their surface.
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ ideaId?: string }>;
}) {
  const { ideaId } = await searchParams;
  const projectId = await getActiveProjectId();
  const scope = projectId ? { OR: [{ projectId: null }, { projectId }] } : {};

  const rows = await prisma.idea
    .findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { project: { select: { name: true } } },
    })
    .catch(() => []);

  // A ⌘K deep link may point past the recent slice (or to another project) —
  // fetch it explicitly so the highlight never lands on a list without it.
  let list = rows;
  if (ideaId && !rows.some((r) => r.id === ideaId)) {
    const extra = await prisma.idea
      .findUnique({ where: { id: ideaId }, include: { project: { select: { name: true } } } })
      .catch(() => null);
    if (extra) list = [extra, ...list];
  }

  const notes = list.map((i) => ({
    id: i.id,
    title: i.title || i.topic || "Note",
    badges: i.techniqueKind ? [i.techniqueKind] : [],
    body: i.content,
    project: i.project?.name ?? null,
    editValues: { title: i.title ?? "", content: i.content, tags: i.tags ?? "" },
  }));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
      <p className="mt-1 text-muted-foreground">
        Everything you&apos;ve saved in one place — saved results, brainstorms, image captures, and
        quick notes. Search, edit, or copy any of them.
      </p>

      {notes.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={StickyNote}
          title="No notes yet"
          hint="Save a Quick Action result as a note, run a brainstorm, or capture an image — they all land here."
        />
      ) : (
        <RecentItems
          heading="All notes"
          items={notes}
          deleteBase="/api/ideas"
          editBase="/api/ideas"
          searchable
          highlightId={ideaId ?? null}
          editFields={[
            { key: "title", label: "Title" },
            { key: "content", label: "Content", multiline: true },
            { key: "tags", label: "Tags (comma-separated)" },
          ]}
        />
      )}
    </div>
  );
}
