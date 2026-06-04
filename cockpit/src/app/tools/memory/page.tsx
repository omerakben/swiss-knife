import { prisma } from "@/lib/db";
import { MemoryManager } from "@/components/memory/MemoryManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const rows = await prisma.memoryFact
    .findMany({
      where: { status: { not: "dismissed" } },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    })
    .catch(() => []);

  const facts = rows.map((f) => ({
    id: f.id,
    key: f.key,
    value: f.value,
    source: f.source,
    status: f.status,
    pinned: f.pinned,
  }));

  return <MemoryManager facts={facts} />;
}
