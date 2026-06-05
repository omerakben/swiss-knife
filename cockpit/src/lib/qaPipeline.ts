// Project-scoped QA pipeline: a user story → drafted .feature → deterministic
// lint → rubric score. This orchestrates EXISTING primitives — it does not
// reimplement them. The Gherkin-authoring and eval-rubric instructions come from
// the active project's seeded templates (resolved by slug), so all LBMH/Spruce
// specifics stay in the gitignored project pack (prisma/seed-lbmh.mjs), never
// hardcoded here. Glossary/vocabulary is injected via the project's memory facts.

import { prisma } from "@/lib/db";
import { chat, type ChatMessage } from "@/lib/ollama";
import { getEffectiveConfig } from "@/lib/config";
import { getMemoryContext } from "@/lib/memory";
import { renderTemplate } from "@/lib/templates";
import { lintGherkin, type GherkinLintResult } from "@/lib/gherkinLint";

// Stable slugs the project pack seeds these templates under (see
// prisma/seed-lbmh.mjs → projects/<name>/pack/content.mjs). Resolved per project,
// so a project without the pack simply has no match → needsPack.
const GHERKIN_SLUG = "lbmh-gherkin-authoring";
const RUBRIC_SLUG = "lbmh-qa-eval-rubric";

type QaTemplate = { id: string; body: string };

export type QaContext = {
  /** True only when both templates AND project glossary facts are present. */
  hasPack: boolean;
  gherkinTemplate: QaTemplate | null;
  rubricTemplate: QaTemplate | null;
  hasGlossary: boolean;
};

export type RubricScore = { raw: string; verdict: "PASS" | "BLOCK" | "UNKNOWN" };

export type QaPipelineResult = {
  draftFeature: string;
  lint: GherkinLintResult;
  rubric: RubricScore;
};

/**
 * Resolve a project's QA pack: the Gherkin-authoring + eval-rubric templates (by
 * slug, scoped to the project) and whether the project has glossary memory facts.
 * A project "has the pack" only when both templates and at least one fact exist.
 */
export async function loadProjectQaContext(projectId: string | null): Promise<QaContext> {
  const [gherkinTemplate, rubricTemplate, factCount] = await Promise.all([
    prisma.template.findFirst({
      where: { slug: GHERKIN_SLUG, projectId },
      select: { id: true, body: true },
    }),
    prisma.template.findFirst({
      where: { slug: RUBRIC_SLUG, projectId },
      select: { id: true, body: true },
    }),
    projectId
      ? prisma.memoryFact.count({ where: { projectId, status: "active" } })
      : Promise.resolve(0),
  ]);

  const hasGlossary = factCount > 0;
  return {
    hasPack: Boolean(gherkinTemplate && rubricTemplate && hasGlossary),
    gherkinTemplate,
    rubricTemplate,
    hasGlossary,
  };
}

// Gemma tends to wrap output in ```gherkin fences; the linter wants raw text.
function stripFences(s: string): string {
  return s.replace(/^\s*```[\w-]*\s*$/gm, "").trim();
}

function parseVerdict(raw: string): RubricScore["verdict"] {
  if (/verdict:\s*pass/i.test(raw)) return "PASS";
  if (/verdict:\s*block/i.test(raw)) return "BLOCK";
  return "UNKNOWN";
}

/**
 * Run the full pipeline against a pre-loaded context (caller checks ctx.hasPack
 * and health-gates first). Draft and score both go through the one-shot chat()
 * with the project's memory injected as a leading system message.
 */
export async function runQaPipeline(
  input: string,
  projectId: string | null,
  ctx: QaContext
): Promise<QaPipelineResult> {
  if (!ctx.gherkinTemplate || !ctx.rubricTemplate) {
    throw new Error("QA pack not loaded for this project.");
  }

  const cfg = await getEffectiveConfig();
  const memory = await getMemoryContext({ projectId });
  const chatOpts = { model: cfg.model, baseUrl: cfg.baseUrl, temperature: cfg.temperature };

  const withMemory = (instruction: string): ChatMessage[] =>
    memory
      ? [{ role: "system", content: memory }, { role: "user", content: instruction }]
      : [{ role: "user", content: instruction }];

  // A) Draft — the story drives the template's `behavior`; module/examples are
  // left empty (renderTemplate maps missing vars to ""). The project's glossary
  // rides in via the injected memory so Spruce vocabulary shows up in the draft.
  const draftInstruction = renderTemplate(ctx.gherkinTemplate.body, {
    behavior: input,
  });
  const draftRaw = await chat(withMemory(draftInstruction), chatOpts);
  const draftFeature = stripFences(draftRaw);

  // B) Lint — deterministic, model-independent (reuse, never reimplement).
  const lint = lintGherkin(draftFeature);

  // C) Rubric — score the drafted feature against the project's eval rubric.
  const rubricInstruction = renderTemplate(ctx.rubricTemplate.body, {
    artifact: draftFeature,
  });
  const rubricRaw = await chat(withMemory(rubricInstruction), chatOpts);
  const rubric: RubricScore = { raw: rubricRaw.trim(), verdict: parseVerdict(rubricRaw) };

  return { draftFeature, lint, rubric };
}
