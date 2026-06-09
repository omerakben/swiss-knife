import { assertOllamaReady } from "@/lib/health";
import { getActiveProjectId } from "@/lib/project";
import { chatJson } from "@/lib/ollama";
import { getEffectiveConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Classify a free-text note into the right model and extract its fields. The
// schema forces a valid kind; a parse failure falls back to "task".
const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["task", "fact", "idea"] },
    title: { type: "string" },
    detail: { type: "string" },
  },
  required: ["kind", "title"],
};

const SYSTEM =
  "Classify this quick note into exactly one of: task (an action to do), fact (durable info worth remembering), idea (a thought to develop). " +
  "Give a short title and an optional one-line detail.";

export async function POST(req: Request) {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) return Response.json({ error: "Nothing to add." }, { status: 400 });

  const cfg = await getEffectiveConfig();
  const projectId = await getActiveProjectId();

  let parsed: { kind: string; title: string; detail?: string };
  try {
    parsed = await chatJson(
      [{ role: "system", content: SYSTEM }, { role: "user", content: text.trim() }],
      SCHEMA,
      { model: cfg.model, baseUrl: cfg.baseUrl, temperature: 0 }
    );
  } catch {
    parsed = { kind: "task", title: text.trim() };
  }

  const title = (parsed.title || text.trim()).slice(0, 200);
  const detail = parsed.detail?.trim() || null;
  await logActivity({ entity: parsed.kind, action: "quick-added", summary: title, projectId });

  if (parsed.kind === "fact") {
    const f = await prisma.memoryFact.create({
      data: { value: detail || title, source: "manual", status: "active", projectId },
    });
    return Response.json({ kind: "fact", id: f.id, title: f.value.slice(0, 60), href: "/tools/memory", deleteUrl: `/api/memory/${f.id}` });
  }

  if (parsed.kind === "idea") {
    const i = await prisma.idea.create({
      data: { topic: title, title, content: detail || title, projectId },
    });
    return Response.json({ kind: "idea", id: i.id, title, href: "/tools/brainstorm", deleteUrl: `/api/ideas/${i.id}` });
  }

  const max = await prisma.task.aggregate({ where: { status: "todo" }, _max: { order: true } });
  const t = await prisma.task.create({
    data: { title, notes: detail, status: "todo", order: (max._max.order ?? 0) + 1, projectId },
  });
  return Response.json({ kind: "task", id: t.id, title, href: "/tools/tasks", deleteUrl: `/api/tasks/${t.id}` });
}
