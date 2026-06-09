import { prisma } from "@/lib/db";
import { getActiveProjectId } from "@/lib/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["todo", "doing", "done"];
const PRIORITIES = ["low", "medium", "high"];

export async function GET() {
  const tasks = await prisma.task
    .findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] })
    .catch(() => []);
  return Response.json({ tasks });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
    notes?: string;
  };

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return Response.json({ error: "Task needs a title." }, { status: 400 });
  }

  const status = STATUSES.includes(body.status ?? "") ? (body.status as string) : "todo";

  // Validate the due date up front: an invalid string -> Invalid Date, which
  // Prisma rejects with an unhandled throw (a 500) here. Catch it as a 400.
  let dueDate: Date | null = null;
  if (body.dueDate) {
    const d = new Date(body.dueDate);
    if (Number.isNaN(d.getTime())) {
      return Response.json({ error: "Invalid due date." }, { status: 400 });
    }
    dueDate = d;
  }

  const projectId = await getActiveProjectId();
  const max = await prisma.task.aggregate({ where: { status }, _max: { order: true } });

  const task = await prisma.task.create({
    data: {
      title: body.title.trim(),
      status,
      priority: PRIORITIES.includes(body.priority ?? "") ? (body.priority as string) : "medium",
      dueDate,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      order: (max._max.order ?? 0) + 1,
      completedAt: status === "done" ? new Date() : null,
      projectId,
    },
  });

  return Response.json({ task });
}
