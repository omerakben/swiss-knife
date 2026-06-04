import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await prisma.project
    .findMany({ where: { archived: false }, orderBy: { createdAt: "asc" } })
    .catch(() => []);
  return Response.json({ projects });
}

export async function POST(req: Request) {
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Project needs a name." }, { status: 400 });
  }
  const project = await prisma.project.create({ data: { name: name.trim() } });
  return Response.json({ project });
}
