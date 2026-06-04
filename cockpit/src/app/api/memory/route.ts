import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const facts = await prisma.memoryFact
    .findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] })
    .catch(() => []);
  return Response.json({ facts });
}

export async function POST(req: Request) {
  const { key, value } = (await req.json().catch(() => ({}))) as { key?: string; value?: string };
  if (!value || typeof value !== "string" || !value.trim()) {
    return Response.json({ error: "A fact needs a value." }, { status: 400 });
  }
  const fact = await prisma.memoryFact.create({
    data: {
      key: typeof key === "string" && key.trim() ? key.trim() : null,
      value: value.trim(),
      source: "manual",
      status: "active",
    },
  });
  return Response.json({ fact });
}
