import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { planHintImport } from "@/lib/importHints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown> & { id: string };
type Upsertable = {
  upsert: (a: { where: { id: string }; update: Record<string, unknown>; create: Record<string, unknown> }) => Promise<unknown>;
};
type UpsertOutcome = { ok: number; failed: number };

async function upsertAll(model: Upsertable, rows: unknown): Promise<UpsertOutcome> {
  let ok = 0;
  let failed = 0;
  // A present-but-non-array collection field is a corrupted backup section, not
  // an absent one — surface it as a skipped failure (an absent/empty field is a
  // legitimate {ok:0,failed:0}).
  if (rows != null && !Array.isArray(rows)) return { ok: 0, failed: 1 };
  // Tolerate a malformed export where a field isn't an array (would otherwise
  // throw a 500 on the for…of); count non-object/no-id rows as failures.
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== "object" || typeof (r as Row).id !== "string") {
      failed += 1;
      continue;
    }
    const { id, ...rest } = r as Row;
    try {
      await model.upsert({ where: { id }, update: rest, create: r as Row });
      ok += 1;
    } catch {
      // Skip rows that don't fit (e.g. a dangling foreign key); import is best-effort,
      // but the count of skipped rows is surfaced to the user (not reported as success).
      failed += 1;
    }
  }
  return { ok, failed };
}

// Restore a prior export. Idempotent: upserts by id, so re-importing your own
// export is a no-op. Projects go first so content foreign keys resolve.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { data?: Record<string, Row[]> } | null;
  const data = body?.data;
  if (!data) return Response.json({ error: "Not a valid export file." }, { status: 400 });

  const m = prisma as unknown as Record<string, Upsertable>;
  const imported: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const record = (key: string, res: UpsertOutcome) => {
    imported[key] = res.ok;
    if (res.failed > 0) skipped[key] = res.failed;
  };

  record("projects", await upsertAll(m.project, data.projects));
  record("templates", await upsertAll(m.template, data.templates));
  record("prompts", await upsertAll(m.prompt, data.prompts));
  record("emails", await upsertAll(m.emailDraft, data.emails));
  record("ideas", await upsertAll(m.idea, data.ideas));
  record("tasks", await upsertAll(m.task, data.tasks));
  record("facts", await upsertAll(m.memoryFact, data.facts));
  record("bugs", await upsertAll(m.bugReport, data.bugs));
  record("goldens", await upsertAll(m.goldenCase, data.goldens));
  record("adrs", await upsertAll(m.adr, data.adrs));

  // Starters need a key-aware restore: built-ins carry a stable @unique
  // sourceKey but a fresh id per machine, and they auto-seed — so a merge into
  // an already-seeded DB must upsert built-ins BY sourceKey (id-by-id would miss
  // the locally-seeded twin and silently drop the user's edit). User starters
  // (null sourceKey) go by id like everything else.
  const starterModel = m.starter as unknown as {
    upsert: (a: { where: Record<string, unknown>; update: Record<string, unknown>; create: Record<string, unknown> }) => Promise<unknown>;
  };
  let stOk = 0;
  let stFailed = 0;
  for (const s of Array.isArray(data.starters) ? data.starters : []) {
    if (!s || typeof s !== "object" || typeof (s as Row).id !== "string") {
      stFailed += 1;
      continue;
    }
    const { id, ...rest } = s as Row;
    const sk = (s as Row).sourceKey;
    try {
      const where = typeof sk === "string" && sk ? { sourceKey: sk } : { id };
      await starterModel.upsert({ where, update: rest, create: s as Row });
      stOk += 1;
    } catch {
      stFailed += 1;
    }
  }
  imported.starters = stOk;
  if (stFailed > 0) skipped.starters = stFailed;

  // ToolHint edits are matched by `key` (the stable business identity — see
  // PLACEHOLDER_DEFAULTS in lib/toolHints.ts), not `id`, so a cross-machine
  // import merges into an existing edit of the same hint instead of racing
  // the unique `key @unique` constraint if the same key already exists
  // locally under a different id. Row shape/registry-gate decisions live in
  // lib/importHints.ts (planHintImport) so they're unit-testable; this loop
  // only performs the upsert and folds any upsert-time failures into the
  // count planHintImport already started.
  const toolHintModel = m.toolHint as unknown as {
    upsert: (a: { where: Record<string, unknown>; update: Record<string, unknown>; create: Record<string, unknown> }) => Promise<unknown>;
  };
  const hintPlan = planHintImport(data.toolHints);
  let thOk = 0;
  let thFailed = hintPlan.failed;
  for (const { key, row } of hintPlan.valid) {
    const { id: _id, ...rest } = row;
    try {
      await toolHintModel.upsert({ where: { key }, update: rest, create: row });
      thOk += 1;
    } catch {
      thFailed += 1;
    }
  }
  imported.toolHints = thOk;
  if (thFailed > 0) skipped.toolHints = thFailed;

  let qa = 0;
  let qaFailed = 0;
  let iters = 0;
  let itersFailed = 0;
  for (const s of Array.isArray(data.qaSessions) ? data.qaSessions : []) {
    if (!s || typeof s !== "object" || typeof (s as Row).id !== "string") {
      qaFailed += 1;
      continue;
    }
    const { iterations, id, ...session } = s as Row & { iterations?: unknown };
    try {
      await m.qaSession.upsert({ where: { id }, update: session, create: { id, ...session } });
      qa += 1;
    } catch {
      qaFailed += 1;
      continue;
    }
    const res = await upsertAll(m.qaIteration, iterations);
    iters += res.ok;
    itersFailed += res.failed;
  }
  imported.qaSessions = qa;
  imported.iterations = iters;
  if (qaFailed > 0) skipped.qaSessions = qaFailed;
  if (itersFailed > 0) skipped.iterations = itersFailed;

  const totalOk = Object.values(imported).reduce((a, b) => a + b, 0);
  const totalSkipped = Object.values(skipped).reduce((a, b) => a + b, 0);
  await logActivity({
    entity: "backup",
    action: "imported",
    summary: `Restored ${totalOk} records${totalSkipped ? ` (${totalSkipped} skipped)` : ""}`,
  });
  return Response.json({ ok: true, imported, skipped });
}
