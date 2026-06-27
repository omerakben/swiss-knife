import { assertOllamaReady } from "@/lib/health";
import { getEffectiveConfig } from "@/lib/config";
import { getActiveProjectId } from "@/lib/project";
import { extractTasksFromText, createDraftTasks } from "@/lib/tasksFromText";
import type { DraftTask } from "@/lib/meetingNotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Turn any text (a Quick Action result) into reviewed Task records. Neutral
// provenance (not the meeting-notes route, which logs "from meeting notes").
export async function POST(req: Request) {
  const { text, create } = (await req.json().catch(() => ({}))) as { text?: string; create?: DraftTask[] };
  const projectId = await getActiveProjectId();

  if (Array.isArray(create)) {
    const created = await createDraftTasks(create, projectId, "a quick action");
    if (created === 0) return Response.json({ error: "No tasks selected to add." }, { status: 400 });
    return Response.json({ created });
  }

  const t = typeof text === "string" ? text.trim() : "";
  if (!t) return Response.json({ error: "Nothing to turn into tasks." }, { status: 400 });
  if (t.length > 80_000) return Response.json({ error: "That result is too long." }, { status: 413 });

  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const cfg = await getEffectiveConfig();
  try {
    return Response.json(await extractTasksFromText(t, { model: cfg.model, baseUrl: cfg.baseUrl }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't read the result." }, { status: 500 });
  }
}
