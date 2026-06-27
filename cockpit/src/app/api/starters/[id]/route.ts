import { prisma } from "@/lib/db";
import { parseInputs, validateStarter } from "@/lib/starters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { label?: string; inputs?: Record<string, string> };

  const existing = await prisma.starter.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Starter not found." }, { status: 404 });

  const label = typeof body.label === "string" ? body.label.trim() : existing.label;
  const inputs =
    body.inputs && typeof body.inputs === "object" && !Array.isArray(body.inputs)
      ? (body.inputs as Record<string, string>)
      : null;

  // Always run the full gate against the effective inputs (new or existing), so a
  // label-only edit can't bypass the label/size caps the create path enforces.
  const effectiveInputs = inputs ?? parseInputs(existing.inputs) ?? {};
  const v = validateStarter(existing.target, label, effectiveInputs);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

  const data: Record<string, unknown> = { label };
  if (inputs) data.inputs = JSON.stringify(inputs);
  const starter = await prisma.starter.update({ where: { id }, data });
  return Response.json({ ok: true, starter });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.starter.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Starter not found." }, { status: 404 });
  }
}
