import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["todo", "doing", "done"];
const PRIORITIES = ["low", "medium", "high"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    notes?: string;
    priority?: string;
    status?: string;
    dueDate?: string | null;
    order?: number;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (PRIORITIES.includes(body.priority ?? "")) data.priority = body.priority;
  if (STATUSES.includes(body.status ?? "")) {
    data.status = body.status;
    data.completedAt = body.status === "done" ? new Date() : null;
  }
  if (body.dueDate === null) data.dueDate = null;
  else if (typeof body.dueDate === "string") data.dueDate = new Date(body.dueDate);
  if (typeof body.order === "number") data.order = body.order;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const task = await prisma.task.update({ where: { id }, data });
    return Response.json({ task });
  } catch {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.task.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }
}
