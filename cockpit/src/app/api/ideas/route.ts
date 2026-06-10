import { prisma } from "@/lib/db";
import { getActiveProjectId } from "@/lib/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Persist an idea AFTER the user has seen the result (save-after-run): the
// only previous write paths were request-time save flags that re-ran the
// model, or capture/quick-add. [id] PATCH/DELETE already existed.
export async function POST(req: Request) {
  const { title, topic, content } = (await req.json().catch(() => ({}))) as {
    title?: string;
    topic?: string;
    content?: string;
  };
  if (!content || typeof content !== "string" || !content.trim()) {
    return Response.json({ error: "Missing 'content'." }, { status: 400 });
  }
  const projectId = await getActiveProjectId();
  const t = typeof title === "string" && title.trim() ? title.trim().slice(0, 120) : null;
  const idea = await prisma.idea.create({
    data: {
      title: t,
      topic: (typeof topic === "string" && topic.trim() ? topic.trim() : t ?? content.trim()).slice(0, 200),
      content: content.trim(),
      projectId,
    },
  });
  return Response.json({ idea });
}
