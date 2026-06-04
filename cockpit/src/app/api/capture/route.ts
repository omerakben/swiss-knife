import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getToken(): Promise<string | null> {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" } }).catch(() => null);
  return s?.captureToken || null;
}

/**
 * Quick-capture endpoint for a macOS Shortcut / hotkey. Token-authed via the
 * x-capture-token header (or ?token=). Files the text into the chosen table.
 */
export async function POST(req: Request) {
  const token = await getToken();
  if (!token) {
    return Response.json(
      { error: "Quick capture isn't set up. Generate a token in Settings." },
      { status: 403 }
    );
  }
  const provided =
    req.headers.get("x-capture-token") || new URL(req.url).searchParams.get("token");
  if (provided !== token) {
    return Response.json({ error: "Invalid capture token." }, { status: 401 });
  }

  const { target, text, title, projectId } = (await req.json().catch(() => ({}))) as {
    target?: string;
    text?: string;
    title?: string;
    projectId?: string;
  };
  if (!text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Nothing to capture." }, { status: 400 });
  }

  const t = text.trim();
  const pid = typeof projectId === "string" && projectId ? projectId : null;
  const tgt = ["task", "fact", "prompt", "idea"].includes(target ?? "") ? target : "task";

  let id: string;
  if (tgt === "fact") {
    const f = await prisma.memoryFact.create({
      data: { value: t.slice(0, 300), source: "manual", status: "active", projectId: pid },
    });
    id = f.id;
  } else if (tgt === "prompt") {
    const p = await prisma.prompt.create({
      data: { title: (title || t.slice(0, 60)).trim(), original: t, source: "import", projectId: pid },
    });
    id = p.id;
  } else if (tgt === "idea") {
    const i = await prisma.idea.create({
      data: { title: (title || t.slice(0, 60)).trim(), topic: t.slice(0, 200), content: t, projectId: pid },
    });
    id = i.id;
  } else {
    const max = await prisma.task.aggregate({ where: { status: "todo" }, _max: { order: true } });
    const task = await prisma.task.create({
      data: { title: t.slice(0, 200), status: "todo", order: (max._max.order ?? 0) + 1, projectId: pid },
    });
    id = task.id;
  }

  return Response.json({ ok: true, target: tgt, id });
}
