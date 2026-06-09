import { prisma } from "@/lib/db";

/**
 * Append a row to the activity timeline. Best-effort and non-blocking: a logging
 * failure must never break the action it records.
 */
export async function logActivity(entry: {
  entity: string;
  action: string;
  summary: string;
  projectId?: string | null;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        entity: entry.entity,
        action: entry.action,
        summary: entry.summary.slice(0, 300),
        projectId: entry.projectId ?? null,
      },
    });
  } catch {
    // Telemetry only; swallow.
  }
}
