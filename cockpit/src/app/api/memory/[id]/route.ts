import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = ["active", "pending", "dismissed"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    pinned?: boolean;
    value?: string;
    key?: string;
  };

  const data: Record<string, unknown> = {};
  if (STATUS.includes(body.status ?? "")) data.status = body.status;
  if (typeof body.pinned === "boolean") data.pinned = body.pinned;
  if (typeof body.value === "string") data.value = body.value.trim();
  if (typeof body.key === "string") data.key = body.key.trim() || null;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const fact = await prisma.memoryFact.update({ where: { id }, data });
    return Response.json({ fact });
  } catch {
    return Response.json({ error: "Fact not found." }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.memoryFact.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Fact not found." }, { status: 404 });
  }
}
