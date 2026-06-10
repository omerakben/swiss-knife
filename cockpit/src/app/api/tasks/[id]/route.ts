import { prisma } from "@/lib/db";
import { parseDueDateInput } from "@/lib/dates";
import { logActivity } from "@/lib/activity";

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
    module?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.module === "string") data.module = body.module.trim() || null;
  if (PRIORITIES.includes(body.priority ?? "")) data.priority = body.priority;
  if (STATUSES.includes(body.status ?? "")) {
    data.status = body.status;
    data.completedAt = body.status === "done" ? new Date() : null;
  }
  if (body.dueDate === null) data.dueDate = null;
  else if (typeof body.dueDate === "string") {
    const d = parseDueDateInput(body.dueDate);
    if (!d) {
      return Response.json({ error: "Invalid due date." }, { status: 400 });
    }
    data.dueDate = d;
  }
  if (typeof body.order === "number") data.order = body.order;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const task = await prisma.task.update({ where: { id }, data });
    // "What did I do today" (Activity + wrapup) cares about completions.
    if (data.status === "done") {
      await logActivity({ entity: "task", action: "completed", summary: task.title, projectId: task.projectId });
    }
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
