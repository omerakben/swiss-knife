import { prisma } from "@/lib/db";
import { BUILTIN_STARTERS } from "@/lib/quickActions";
import { buildStarterSeedPlan } from "@/lib/starters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Restore a target's shipped standards: delete its seeded rows (reverting edits
// and recreating deleted ones), then re-apply the plan. User-created rows
// (sourceKey: null, builtin: false) are left untouched.
export async function POST(req: Request) {
  const { target } = (await req.json().catch(() => ({}))) as { target?: string };
  const t = typeof target === "string" ? target : "";
  if (!t) return Response.json({ error: "Missing target." }, { status: 400 });

  const plan = buildStarterSeedPlan(BUILTIN_STARTERS).filter((r) => r.target === t);
  await prisma.starter.deleteMany({ where: { target: t, builtin: true } });
  for (const row of plan) {
    await prisma.starter.create({ data: row });
  }
  return Response.json({ ok: true, count: plan.length });
}
