import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

/**
 * The active project id from the cookie, or null. Validates the project still
 * exists: a dangling cookie (after a DB reset, or an import whose project ids
 * differ) would otherwise FK-violate every create that stamps projectId. Read in
 * route/handler scope.
 */
export async function getActiveProjectId(): Promise<string | null> {
  try {
    const c = await cookies();
    const id = c.get("activeProjectId")?.value || null;
    if (!id) return null;
    const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    return exists ? id : null;
  } catch {
    return null;
  }
}
