import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["todo", "doing", "done"] as const;

/**
 * Persist a full board layout after a drag. Body: { columns: { todo: id[], doing: id[], done: id[] } }.
 * Each task gets its column's status and its index as the order; completedAt is
 * set when in done and cleared otherwise.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { columns?: Record<string, string[]> };
  const columns = body.columns;
  if (!columns || typeof columns !== "object") {
    return Response.json({ error: "Expected { columns }." }, { status: 400 });
  }

  const updates: Promise<unknown>[] = [];
  for (const status of STATUSES) {
    const ids = Array.isArray(columns[status]) ? columns[status] : [];
    ids.forEach((id, index) => {
      updates.push(
        prisma.task
          .update({
            where: { id },
            data: { status, order: index, completedAt: status === "done" ? new Date() : null },
          })
          .catch(() => null)
      );
    });
  }
  await Promise.all(updates);

  return Response.json({ ok: true });
}
