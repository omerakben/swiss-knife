import { assertOllamaReady } from "@/lib/health";
import { streamTextResponse } from "@/lib/ai/streamRoute";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const tasks = await prisma.task.findMany({ orderBy: [{ order: "asc" }] });
  if (tasks.length === 0) {
    return Response.json({ error: "No tasks to summarize yet." }, { status: 400 });
  }

  const section = (status: string) =>
    tasks
      .filter((t) => t.status === status)
      .map((t) => `- ${t.title}`)
      .join("\n") || "- (none)";

  const board = `Doing:\n${section("doing")}\n\nTo do:\n${section("todo")}\n\nDone:\n${section("done")}`;

  return streamTextResponse({
    messages: [
      {
        role: "system",
        content:
          "You write a brief daily standup from a task board. Output three short sections: 'In progress', 'Up next' (top 3), and 'Recently done'. Be concise, no preamble.",
      },
      { role: "user", content: board },
    ],
    temperature: 0.3,
  });
}
