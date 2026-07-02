import { prisma } from "@/lib/db";
import { PLACEHOLDER_DEFAULTS, validateHint } from "@/lib/toolHints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET returns every saved override, keyed by hint key (unknown/stale keys —
// e.g. left behind by a registry change — are filtered out, so a consumer
// only ever sees keys it can actually resolve a default for).
export async function GET() {
  const rows = await prisma.toolHint.findMany();
  // Object.create(null) has no prototype chain, so even a stray "__proto__" key
  // (already filtered by Object.hasOwn below, belt-and-suspenders) can't reach
  // the prototype setter when assigned onto this accumulator.
  const hints: Record<string, string> = Object.create(null);
  for (const r of rows) {
    if (Object.hasOwn(PLACEHOLDER_DEFAULTS, r.key)) hints[r.key] = r.text;
  }
  return Response.json({ hints });
}

// PUT { key, text }. Empty/whitespace text means "reset to default": delete
// the override row (there's nothing to save — the default already IS the
// text) and hand back the default so the caller can update in place without a
// second round trip. A real save goes through the same validateHint() gate
// the unit tests pin, so a key typo or an oversize hint can't reach the DB.
export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { key?: unknown; text?: unknown };
  const key = typeof body.key === "string" ? body.key : "";

  if (!Object.hasOwn(PLACEHOLDER_DEFAULTS, key)) return Response.json({ error: "Unknown hint." }, { status: 400 });

  if (typeof body.text === "string" && !body.text.trim()) {
    await prisma.toolHint.deleteMany({ where: { key } });
    return Response.json({ key, text: PLACEHOLDER_DEFAULTS[key], reset: true });
  }

  const v = validateHint(key, body.text as string);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

  const text = body.text as string;
  await prisma.toolHint.upsert({ where: { key }, update: { text }, create: { key, text } });
  return Response.json({ key, text });
}
