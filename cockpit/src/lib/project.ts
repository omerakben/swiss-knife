import { cookies } from "next/headers";

/** The active project id from the cookie, or null. Read in route/handler scope. */
export async function getActiveProjectId(): Promise<string | null> {
  try {
    const c = await cookies();
    return c.get("activeProjectId")?.value || null;
  } catch {
    return null;
  }
}
