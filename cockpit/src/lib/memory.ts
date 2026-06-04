import { prisma } from "@/lib/db";

/**
 * Active facts formatted as a context block to prepend to tool prompts. Includes
 * global facts (projectId null) plus the given project's facts when provided.
 * Returns "" when there are none (so callers can skip the system message).
 */
export async function getMemoryContext(opts?: { projectId?: string | null }): Promise<string> {
  let facts: { key: string | null; value: string }[] = [];
  try {
    facts = await prisma.memoryFact.findMany({
      where: {
        status: "active",
        OR: [{ projectId: null }, ...(opts?.projectId ? [{ projectId: opts.projectId }] : [])],
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "asc" }],
      select: { key: true, value: true },
      take: 50,
    });
  } catch {
    return "";
  }
  if (facts.length === 0) return "";
  const lines = facts.map((f) => `- ${f.key ? `${f.key}: ` : ""}${f.value}`).join("\n");
  return `Relevant context about the user and their work (use where helpful; do not repeat it verbatim):\n${lines}`;
}
