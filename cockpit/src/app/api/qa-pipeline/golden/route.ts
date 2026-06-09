import { prisma } from "@/lib/db";
import { getActiveProjectId } from "@/lib/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Promote a QA draft to a labeled golden case (story + expected verdict).
export async function POST(req: Request) {
  const { story, draftFeature, expectedVerdict } = (await req.json().catch(() => ({}))) as {
    story?: string;
    draftFeature?: string;
    expectedVerdict?: string;
  };
  if (!story?.trim() || !draftFeature?.trim() || !["PASS", "BLOCK"].includes(expectedVerdict ?? "")) {
    return Response.json({ error: "Need story, draftFeature, and expectedVerdict (PASS|BLOCK)." }, { status: 400 });
  }
  const projectId = await getActiveProjectId();
  const c = await prisma.goldenCase.create({
    data: { story: story.trim(), draftFeature, expectedVerdict: expectedVerdict as string, projectId },
  });
  return Response.json({ id: c.id });
}

export async function GET() {
  const projectId = await getActiveProjectId();
  const cases = await prisma.goldenCase
    .findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, select: { id: true, story: true, expectedVerdict: true } })
    .catch(() => []);
  return Response.json({ cases });
}
