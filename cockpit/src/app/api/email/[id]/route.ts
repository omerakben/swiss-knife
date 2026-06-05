import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { title?: string; body?: string };

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim() || null;
  if (typeof body.body === "string") {
    if (!body.body.trim()) {
      return Response.json({ error: "Body can't be empty." }, { status: 400 });
    }
    data.body = body.body;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const draft = await prisma.emailDraft.update({ where: { id }, data });
    return Response.json({ draft });
  } catch {
    return Response.json({ error: "Draft not found." }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.emailDraft.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Draft not found." }, { status: 404 });
  }
}
