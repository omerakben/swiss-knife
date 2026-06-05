import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    content?: string;
    tags?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim() || null;
  if (typeof body.content === "string") {
    if (!body.content.trim()) {
      return Response.json({ error: "Content can't be empty." }, { status: 400 });
    }
    data.content = body.content;
  }
  if (typeof body.tags === "string") data.tags = body.tags.trim() || null;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const idea = await prisma.idea.update({ where: { id }, data });
    return Response.json({ idea });
  } catch {
    return Response.json({ error: "Idea not found." }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.idea.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Idea not found." }, { status: 404 });
  }
}
