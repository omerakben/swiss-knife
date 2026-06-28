import { prisma } from "@/lib/db";
import { assertOllamaReady } from "@/lib/health";
import { chatJson } from "@/lib/ollama";
import { getEffectiveConfig } from "@/lib/config";
import { getActiveProjectId } from "@/lib/project";
import { logActivity } from "@/lib/activity";
import {
  isRubricSpec,
  lintRubric,
  normalizeRubric,
  projectRubricSlug,
  renderRubricBody,
  type RubricSpec,
} from "@/lib/rubric";
import { scoreFeature, selectQaPackTemplates, type QaContext } from "@/lib/qaPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DESIGN_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    artifactType: { type: "string" },
    criteria: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          weight: { type: "integer", minimum: 1, maximum: 100 },
          guidance: { type: "string" },
        },
        required: ["name", "weight", "guidance"],
      },
    },
    bands: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          min: { type: "integer", minimum: 0, maximum: 100 },
          max: { type: "integer", minimum: 0, maximum: 100 },
          verdict: { type: "string", enum: ["PASS", "BLOCK"] },
        },
        required: ["label", "min", "max", "verdict"],
      },
    },
    passSample: { type: "string" },
    blockSample: { type: "string" },
  },
  required: ["title", "artifactType", "criteria", "bands", "passSample", "blockSample"],
};

const SYSTEM = `You design evaluation rubrics for AI/QA work. From the user's description of "the bar",
produce a weighted rubric as JSON.

Hard requirements:
- criteria: 3-6 concrete, independently checkable criteria. Weights are positive integers that sum to EXACTLY 100.
- guidance: one sentence per criterion saying what earns the points (checkable, not vague).
- bands: tile the 0-100 score range contiguously (each band's min = previous band's max + 1, first min 0, last max 100). Low bands have verdict BLOCK, high bands PASS — never flip back to BLOCK above a PASS band.
- passSample: a short, realistic example artifact (under 15 lines) that clearly MEETS the bar.
- blockSample: a short, realistic example artifact that clearly FAILS the bar.
Use the user's domain vocabulary. Do not invent requirements they didn't imply.`;

// The active project's consumable rubric, as the QA pipeline would resolve it.
export async function GET() {
  const projectId = await getActiveProjectId();
  const [designed, packTemplates] = await Promise.all([
    prisma.template.findFirst({
      where: { slug: projectRubricSlug(projectId), projectId },
      select: { id: true, name: true, updatedAt: true },
    }),
    prisma.template.findMany({
      where: { projectId, kind: "prompt", archived: false },
      select: { id: true, slug: true, name: true, category: true, body: true, updatedAt: true },
    }),
  ]);
  const packRubric = selectQaPackTemplates(packTemplates).rubricTemplate;
  const pack = packRubric ? packTemplates.find((template) => template.id === packRubric.id) ?? null : null;
  const current = designed ?? pack;
  return Response.json({
    current: current
      ? { name: current.name, source: designed ? "designed" : "pack", updatedAt: current.updatedAt.toISOString() }
      : null,
  });
}

type PostBody = { bar?: string; spec?: RubricSpec; save?: boolean };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as PostBody;

  // ── Save path: deterministic only (the human just reviewed the design). ──
  if (body.save && body.spec) {
    // lintRubric assumes arrays/strings; malformed client JSON must 400, not 500.
    if (!isRubricSpec(body.spec)) {
      return Response.json({ error: "Malformed rubric spec." }, { status: 400 });
    }
    const lint = lintRubric(body.spec);
    if (!lint.ok) {
      return Response.json({ error: "This rubric doesn't pass the gate — fix the errors first.", lint }, { status: 400 });
    }
    const projectId = await getActiveProjectId();
    const slug = projectRubricSlug(projectId);
    const rendered = renderRubricBody(body.spec);
    const data = {
      name: body.spec.title.slice(0, 80),
      description: `Eval rubric for ${body.spec.artifactType} (Rubric Designer)`,
      kind: "prompt",
      category: "rubric",
      body: rendered,
      variables: JSON.stringify([{ name: "artifact" }]),
      builtin: false,
      slug,
      projectId,
    };
    const saved = await prisma.template.upsert({ where: { slug }, update: data, create: data });
    await logActivity({ entity: "rubric", action: "saved", summary: body.spec.title, projectId });
    return Response.json({ savedId: saved.id, slug, name: saved.name });
  }

  // ── Design path: model drafts → deterministic gate → live separation check. ──
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  if (!body.bar || typeof body.bar !== "string" || !body.bar.trim()) {
    return Response.json({ error: "Describe the bar this rubric should enforce." }, { status: 400 });
  }

  const cfg = await getEffectiveConfig();
  const projectId = await getActiveProjectId();

  let raw: RubricSpec;
  try {
    // chatJson = structured extraction: NO memory injection (perf rule).
    raw = await chatJson<RubricSpec>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: body.bar.trim() },
      ],
      DESIGN_SCHEMA,
      { model: cfg.model, baseUrl: cfg.baseUrl, temperature: 0.3 }
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't design the rubric." }, { status: 500 });
  }

  const { spec, notes } = normalizeRubric(raw);
  const lint = lintRubric(spec);
  const rendered = renderRubricBody(spec);

  // Separation check: the rendered rubric must actually put the PASS sample and
  // the BLOCK sample on opposite sides — run it through the SAME scoring path
  // the QA pipeline and bench use (scoreFeature → extractVerdict), with an
  // in-memory template ctx. Skipped while structural errors remain.
  let separation: {
    pass: { verdict: string; score: number | null };
    block: { verdict: string; score: number | null };
    ok: boolean;
  } | null = null;

  if (lint.ok) {
    const ctx: QaContext = {
      hasPack: true,
      gherkinTemplate: null,
      rubricTemplate: { id: "draft", body: rendered },
      hasGlossary: false,
    };
    try {
      const passRes = await scoreFeature(spec.passSample, projectId, ctx);
      const blockRes = await scoreFeature(spec.blockSample, projectId, ctx);
      separation = {
        pass: { verdict: passRes.verdict, score: passRes.score ?? null },
        block: { verdict: blockRes.verdict, score: blockRes.score ?? null },
        ok: passRes.verdict === "PASS" && blockRes.verdict === "BLOCK",
      };
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Separation check failed." },
        { status: 500 }
      );
    }
  }

  return Response.json({
    spec,
    notes,
    lint,
    separation,
    body: rendered,
    ok: lint.ok && separation?.ok === true,
  });
}
