import { prisma } from "@/lib/db";
import { getActiveProjectId } from "@/lib/project";
import { buildVariablesJson } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["prompt", "technique"];

// List non-archived templates of a kind (default "prompt"), for the library UI.
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") ?? "prompt";
  const templates = await prisma.template
    .findMany({
      where: { kind: KINDS.includes(kind) ? kind : "prompt", archived: false },
      orderBy: { name: "asc" },
    })
    .catch(() => []);
  return Response.json({ templates });
}

// Create a custom (non-builtin) template. Variables are derived from the body's
// {{placeholders}} unless an explicit JSON array is supplied.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    category?: string;
    body?: string;
    variables?: string;
    kind?: string;
  };

  const name = body.name?.trim();
  const tmplBody = body.body ?? "";
  if (!name) return Response.json({ error: "Template needs a name." }, { status: 400 });
  if (!tmplBody.trim()) return Response.json({ error: "Template needs a body." }, { status: 400 });

  const kind = KINDS.includes(body.kind ?? "") ? (body.kind as string) : "prompt";
  const projectId = await getActiveProjectId();

  const template = await prisma.template.create({
    data: {
      name,
      description: body.description?.trim() || null,
      category: body.category?.trim() || null,
      body: tmplBody,
      variables: buildVariablesJson(body.variables, tmplBody),
      kind,
      builtin: false,
      projectId,
    },
  });
  return Response.json({ template });
}
