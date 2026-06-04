import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { projectId } = (await req.json().catch(() => ({}))) as { projectId?: string | null };
  const c = await cookies();
  if (projectId) {
    c.set("activeProjectId", projectId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    c.delete("activeProjectId");
  }
  return Response.json({ ok: true });
}
