import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { buildPromptPatch } from "@/lib/promptPatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // undefined (not {}) on parse failure so malformed JSON and primitive bodies
  // both reach buildPromptPatch's "Invalid request body." path, not a misleading
  // "Nothing to update.".
  const body = await req.json().catch(() => undefined);

  const result = buildPromptPatch(body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const { data } = result;

  // Verify a reassigned project exists, so a stale/bad id reads as a clear 400
  // here instead of surfacing as a generic 500 "Update failed." from the FK
  // violation caught below (which maps only a missing prompt row / P2025 to 404).
  if (typeof data.projectId === "string") {
    const exists = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { id: true },
    });
    if (!exists) {
      return Response.json({ error: "Project not found." }, { status: 400 });
    }
  }

  try {
    const prompt = await prisma.prompt.update({ where: { id }, data });
    return Response.json({ ok: true, prompt });
  } catch (e) {
    // Only a missing row is a 404; other failures (e.g. an FK target deleted in
    // the check-then-act window) are real errors, not "not found".
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return Response.json({ error: "Prompt not found." }, { status: 404 });
    }
    return Response.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.prompt.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Prompt not found." }, { status: 404 });
  }
}
