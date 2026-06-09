import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    owuiUrl?: string;
    archived?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.owuiUrl === "string") data.owuiUrl = body.owuiUrl.trim() || null;
  if (typeof body.archived === "boolean") data.archived = body.archived;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const project = await prisma.project.update({ where: { id }, data });
    return Response.json({ project });
  } catch {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Content links use onDelete: SetNull, so items are unlinked, not deleted.
    await prisma.project.delete({ where: { id } });
    // Clear the active-project cookie if it pointed at the deleted project —
    // otherwise a dangling id breaks every save-with-project (FK violation)
    // until the user re-picks a project.
    const c = await cookies();
    if (c.get("activeProjectId")?.value === id) c.delete("activeProjectId");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }
}
