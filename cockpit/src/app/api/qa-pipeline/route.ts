import { prisma } from "@/lib/db";
import { assertOllamaReady } from "@/lib/health";
import { getActiveProjectId } from "@/lib/project";
import { loadProjectQaContext, runQaPipeline } from "@/lib/qaPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Story → Gherkin → lint → rubric, scoped to the active project. One-shot JSON
// (no SSE) for v1. The active project supplies the QA templates + glossary; a
// project without them returns { needsPack: true } (a 200, not a degraded run).
export async function POST(req: Request) {
  const { input } = (await req.json().catch(() => ({}))) as { input?: string };
  if (!input || typeof input !== "string" || !input.trim()) {
    return Response.json({ error: "Paste a user story to run." }, { status: 400 });
  }

  // cookies()/params are async in Next 15; resolve in handler scope.
  const projectId = await getActiveProjectId();

  // Pack check is DB-only (no model) — do it before the health gate so a no-pack
  // project gets the empty state even when Ollama is down, rather than a 503.
  const ctx = await loadProjectQaContext(projectId);
  if (!ctx.hasPack) {
    return Response.json({ projectId, needsPack: true });
  }

  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { draftFeature, lint, rubric } = await runQaPipeline(input, projectId, ctx);

  const run = await prisma.qaRun.create({
    data: {
      input,
      draftFeature,
      lintOk: lint.ok,
      errors: lint.summary.errors,
      warnings: lint.summary.warnings,
      score: rubric,
      projectId,
    },
    select: { id: true },
  });

  return Response.json({ projectId, draftFeature, lint, rubric, savedRunId: run.id });
}
