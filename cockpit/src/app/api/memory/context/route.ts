import { rankFacts } from "@/lib/memory";
import { getActiveProjectId } from "@/lib/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Relevance inspector: the facts that WOULD be injected for a given task, with
 * their cosine scores. Deterministic and read-only (no usage bump), so it
 * doubles as the "why did the model see this?" surface in the Memory UI. Falls
 * back to recency (ranked=false) when embeddings aren't available.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  // No projectId param → match real tool injection (active project + global).
  // An explicit (even empty) param is honored as-is.
  const rawProject = url.searchParams.get("projectId");
  const projectId =
    rawProject === null
      ? await getActiveProjectId()
      : rawProject && rawProject !== "__none__" && rawProject !== "__all__"
        ? rawProject
        : null;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 12, 1), 50);

  const result = await rankFacts({ projectId, query, limit });
  return Response.json(result);
}
