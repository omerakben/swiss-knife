import { prisma } from "@/lib/db";
import { ProjectsList } from "@/components/projects/ProjectsList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const rows = await prisma.project
    .findMany({
      where: { archived: false },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { prompts: true, tasks: true, ideas: true, emails: true, facts: true } },
      },
    })
    .catch(() => []);

  const projects = rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    counts: {
      prompts: p._count.prompts,
      tasks: p._count.tasks,
      ideas: p._count.ideas,
      emails: p._count.emails,
      facts: p._count.facts,
    },
  }));

  return <ProjectsList projects={projects} />;
}
