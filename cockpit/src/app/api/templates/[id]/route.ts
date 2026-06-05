import { prisma } from "@/lib/db";
import { buildVariablesJson } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Edit a custom template. Built-ins are immutable (duplicate to customize).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.template.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return Response.json({ error: "Template not found." }, { status: 404 });
  if (existing.builtin) {
    return Response.json(
      { error: "Built-in templates can't be edited — duplicate it to customize." },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    category?: string;
    body?: string;
    variables?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) return Response.json({ error: "Name can't be empty." }, { status: 400 });
    data.name = body.name.trim();
  }
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.category === "string") data.category = body.category.trim() || null;
  if (typeof body.body === "string") {
    if (!body.body.trim()) return Response.json({ error: "Body can't be empty." }, { status: 400 });
    data.body = body.body;
    data.variables = buildVariablesJson(body.variables, body.body); // re-derive on body change
  } else if (typeof body.variables === "string") {
    data.variables = buildVariablesJson(body.variables, existing.body);
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  const template = await prisma.template.update({ where: { id }, data });
  return Response.json({ template });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.template.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return Response.json({ error: "Template not found." }, { status: 404 });
  if (existing.builtin) {
    return Response.json({ error: "Built-in templates can't be deleted." }, { status: 400 });
  }
  await prisma.template.delete({ where: { id } });
  return Response.json({ ok: true });
}
