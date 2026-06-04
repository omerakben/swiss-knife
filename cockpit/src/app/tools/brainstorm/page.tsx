import { prisma } from "@/lib/db";
import { Brainstorm } from "@/components/brainstorm/Brainstorm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BrainstormPage() {
  const techniqueRows = await prisma.template
    .findMany({ where: { kind: "technique", archived: false }, orderBy: { name: "asc" } })
    .catch(() => []);

  const techniques = techniqueRows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    variables: t.variables,
  }));

  return <Brainstorm techniques={techniques} />;
}
