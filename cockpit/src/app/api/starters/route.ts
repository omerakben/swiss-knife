import { prisma } from "@/lib/db";
import { BUILTIN_STARTERS } from "@/lib/quickActions";
import { buildStarterSeedPlan, parseInputs, validateStarter } from "@/lib/starters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Seed the standards once, create-only, when the table is empty. Create-only so
 * a later call never overwrites an edit; gated on an empty table so a deleted
 * standard does not silently reappear on the next read.
 */
async function ensureBuiltinStarters() {
  const count = await prisma.starter.count();
  if (count > 0) return;
  for (const row of buildStarterSeedPlan(BUILTIN_STARTERS)) {
    try {
      await prisma.starter.upsert({ where: { sourceKey: row.sourceKey }, create: row, update: {} });
    } catch {
      // A concurrent first read (e.g. runner + inbox in two tabs) may have just
      // created this row — ignore the unique-sourceKey conflict.
    }
  }
}

export async function GET(req: Request) {
  await ensureBuiltinStarters();
  const target = new URL(req.url).searchParams.get("target") ?? "";
  const rows = await prisma.starter.findMany({
    where: { target },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const starters = rows.map((r) => ({
    id: r.id,
    target: r.target,
    label: r.label,
    inputs: parseInputs(r.inputs) ?? {},
    builtin: r.builtin,
    order: r.order,
  }));
  return Response.json({ starters });
}

export async function POST(req: Request) {
  const { target, label, inputs } = (await req.json().catch(() => ({}))) as {
    target?: string;
    label?: string;
    inputs?: Record<string, string>;
  };
  const t = typeof target === "string" ? target : "";
  const l = typeof label === "string" ? label.trim() : "";
  const i = inputs && typeof inputs === "object" && !Array.isArray(inputs) ? (inputs as Record<string, string>) : {};

  const v = validateStarter(t, l, i);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

  const max = await prisma.starter.aggregate({ where: { target: t }, _max: { order: true } });
  const starter = await prisma.starter.create({
    data: { target: t, label: l, inputs: JSON.stringify(i), builtin: false, order: (max._max.order ?? 0) + 1 },
  });
  return Response.json({ starter: { ...starter, inputs: i } });
}
