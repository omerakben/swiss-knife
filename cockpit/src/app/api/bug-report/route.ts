import { assertOllamaReady } from "@/lib/health";
import { chatJson } from "@/lib/ollama";
import { getEffectiveConfig } from "@/lib/config";
import { getActiveProjectId } from "@/lib/project";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    repro: { type: "array", items: { type: "string" } },
    expected: { type: "string" },
    actual: { type: "string" },
    severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
    environment: { type: "string" },
  },
  required: ["title", "repro", "expected", "actual", "severity"],
};

const SYSTEM =
  "Turn a rough defect note into a structured bug report. Extract a short title, numbered reproduction steps, " +
  "the expected behaviour, the actual behaviour, a severity (low/medium/high/critical), and the environment if mentioned. " +
  "Use the domain vocabulary; do not invent details that aren't implied.";

export async function POST(req: Request) {
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const { note, save } = (await req.json().catch(() => ({}))) as { note?: string; save?: boolean };
  if (!note || !note.trim()) return Response.json({ error: "Describe the bug." }, { status: 400 });

  const cfg = await getEffectiveConfig();
  const projectId = await getActiveProjectId();

  let report: { title: string; repro: string[]; expected: string; actual: string; severity: string; environment?: string };
  try {
    report = await chatJson(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: note.trim() },
      ],
      SCHEMA,
      { model: cfg.model, baseUrl: cfg.baseUrl, temperature: 0.2 }
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't draft the report." }, { status: 500 });
  }

  // Deterministic completeness gate (mirrors the lint pattern, not one big prompt).
  const repro = (report.repro ?? []).map((s) => s.trim()).filter(Boolean);
  const missing: string[] = [];
  if (!report.title?.trim()) missing.push("title");
  if (repro.length === 0) missing.push("reproduction steps");
  if (!report.expected?.trim()) missing.push("expected");
  if (!report.actual?.trim()) missing.push("actual");

  const result = {
    title: report.title?.trim() ?? "",
    repro,
    expected: report.expected?.trim() ?? "",
    actual: report.actual?.trim() ?? "",
    severity: ["low", "medium", "high", "critical"].includes(report.severity) ? report.severity : "medium",
    environment: report.environment?.trim() || null,
    missing,
  };

  if (save && missing.length === 0) {
    const row = await prisma.bugReport.create({
      data: {
        title: result.title,
        repro: result.repro.join("\n"),
        expected: result.expected,
        actual: result.actual,
        severity: result.severity,
        environment: result.environment,
        note: note.trim(),
        projectId,
      },
    });
    await logActivity({ entity: "bug", action: "reported", summary: result.title, projectId });
    return Response.json({ ...result, savedId: row.id });
  }

  return Response.json(result);
}
