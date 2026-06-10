import { assertOllamaReady } from "@/lib/health";
import { streamTextResponse } from "@/lib/ai/streamRoute";
import { getActiveProjectId } from "@/lib/project";
import { buildStandupBoard, STANDUP_SYSTEM } from "@/lib/routines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  // One shared, scoped, bounded board builder with the headless routine —
  // one prompt to tune, one bug surface (lib/routines.ts).
  const projectId = await getActiveProjectId();
  const board = await buildStandupBoard(projectId);
  if (!board) {
    return Response.json({ error: "No tasks to summarize yet." }, { status: 400 });
  }

  return streamTextResponse({
    messages: [
      { role: "system", content: STANDUP_SYSTEM },
      { role: "user", content: board },
    ],
    temperature: 0.3,
  });
}
