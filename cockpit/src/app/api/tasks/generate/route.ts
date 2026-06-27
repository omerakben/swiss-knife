import { assertOllamaReady } from "@/lib/health";
import { chat } from "@/lib/ollama";
import { getEffectiveConfig } from "@/lib/config";
import { getMemoryContext } from "@/lib/memory";
import { getActiveProjectId } from "@/lib/project";
import { prisma } from "@/lib/db";
import { compileSpec } from "@/lib/prompts/spec";
import { TASKS_GENERATE_SPEC } from "@/lib/prompts/tasksGenerate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { goal } = (await req.json().catch(() => ({}))) as { goal?: string };
  if (!goal || typeof goal !== "string" || !goal.trim()) {
    return Response.json({ error: "Describe a goal to break down." }, { status: 400 });
  }

  const cfg = await getEffectiveConfig();
  const projectId = await getActiveProjectId();
  const memory = await getMemoryContext({ projectId, query: goal.trim() });

  // Engineered spec (role + rules + output contract + 2 few-shot turns); memory,
  // if any, leads as its own system message (like email).
  const specMsgs = compileSpec(TASKS_GENERATE_SPEC, goal.trim());
  const messages = memory ? [{ role: "system" as const, content: memory }, ...specMsgs] : specMsgs;

  let text: string;
  try {
    text = await chat(messages, {
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      temperature: TASKS_GENERATE_SPEC.temperature,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't generate tasks." }, { status: 500 });
  }

  const titles = text
    .split("\n")
    .map((l) => l.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 12);

  if (titles.length === 0) {
    return Response.json({ error: "No tasks were generated. Try rephrasing the goal." }, { status: 422 });
  }

  const max = await prisma.task.aggregate({ where: { status: "todo" }, _max: { order: true } });
  let order = (max._max.order ?? 0) + 1;
  const created = [];
  for (const title of titles) {
    created.push(
      await prisma.task.create({
        data: { title: title.slice(0, 200), status: "todo", order: order++, projectId },
      })
    );
  }

  return Response.json({ tasks: created });
}
