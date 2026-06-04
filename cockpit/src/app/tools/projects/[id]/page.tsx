import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { ProjectHubEditor } from "@/components/projects/ProjectHubEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {items.slice(0, 8).map((t, i) => (
              <li key={i} className="line-clamp-1">
                • {t}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function ProjectHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project
    .findUnique({
      where: { id },
      include: {
        prompts: { orderBy: { createdAt: "desc" }, take: 20 },
        tasks: { orderBy: { order: "asc" } },
        ideas: { orderBy: { createdAt: "desc" }, take: 20 },
        emails: { orderBy: { createdAt: "desc" }, take: 20 },
        facts: { where: { status: { not: "dismissed" } }, orderBy: { createdAt: "desc" } },
      },
    })
    .catch(() => null);

  if (!project) notFound();

  return (
    <div className="max-w-4xl">
      <ProjectHubEditor
        project={{
          id: project.id,
          name: project.name,
          description: project.description,
          owuiUrl: project.owuiUrl,
        }}
      />

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Section title={`Prompts (${project.prompts.length})`} items={project.prompts.map((p) => p.title)} />
        <Section
          title={`Tasks (${project.tasks.length})`}
          items={project.tasks.map((t) => `${t.title} · ${t.status}`)}
        />
        <Section title={`Ideas (${project.ideas.length})`} items={project.ideas.map((i) => i.title || i.topic)} />
        <Section
          title={`Drafts (${project.emails.length})`}
          items={project.emails.map((e) => e.title || "Untitled draft")}
        />
        <Section title={`Memory (${project.facts.length})`} items={project.facts.map((f) => f.value)} />
      </div>
    </div>
  );
}
