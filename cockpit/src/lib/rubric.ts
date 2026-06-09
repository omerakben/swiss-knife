// Eval Rubric Designer primitives. A rubric is designed as structured JSON
// (criteria with weights, score bands, a PASS and a BLOCK sample), gated
// deterministically (weights sum to 100, bands tile 0–100 monotonically), then
// RENDERED into a Template body that the existing QA pipeline + eval bench
// consume unchanged — same {{artifact}} contract, same extractVerdict read.
// Pure functions; no model calls here.

export type RubricCriterion = { name: string; weight: number; guidance: string };
export type RubricBand = { label: string; min: number; max: number; verdict: "PASS" | "BLOCK" };
export type RubricSpec = {
  title: string;
  artifactType: string;
  criteria: RubricCriterion[];
  bands: RubricBand[];
  passSample: string;
  blockSample: string;
};

export type RubricIssue = { severity: "ERROR" | "WARN"; message: string };
export type RubricLint = {
  issues: RubricIssue[];
  summary: { errors: number; warnings: number; weightTotal: number; criteria: number; bands: number };
  ok: boolean;
};

/** The per-project Template slug the QA pipeline resolves BEFORE the seeded pack slug. */
export function projectRubricSlug(projectId: string | null): string {
  return `qa-eval-rubric:${projectId ?? "global"}`;
}

/**
 * Deterministic repair of near-miss model output (12B-appropriate: fix the
 * mechanical part, surface what changed). Sorts bands; closes off-by-one band
 * seams (next.min === prev.max); rescales weights to exactly 100 when the sum
 * is within ±20 (largest-remainder, so the result is integral and exact).
 * Anything further off is left for the lint to reject.
 */
export function normalizeRubric(spec: RubricSpec): { spec: RubricSpec; notes: string[] } {
  const notes: string[] = [];
  const bands = [...spec.bands].sort((a, b) => a.min - b.min).map((b) => ({ ...b }));
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].min === bands[i - 1].max && bands[i].min < bands[i].max) {
      bands[i] = { ...bands[i], min: bands[i].min + 1 };
      notes.push(`Band "${bands[i].label}" start bumped to ${bands[i].min} (seam overlap).`);
    }
  }

  let criteria = spec.criteria.map((c) => ({ ...c }));
  const total = criteria.reduce((s, c) => s + c.weight, 0);
  if (total !== 100 && total >= 80 && total <= 120 && criteria.length > 0) {
    const exact = criteria.map((c) => (c.weight / total) * 100);
    const floored = exact.map(Math.floor);
    let remainder = 100 - floored.reduce((s, w) => s + w, 0);
    const order = exact
      .map((w, i) => ({ frac: w - floored[i], i }))
      .sort((a, b) => b.frac - a.frac);
    for (const { i } of order) {
      if (remainder <= 0) break;
      floored[i] += 1;
      remainder -= 1;
    }
    criteria = criteria.map((c, i) => ({ ...c, weight: floored[i] }));
    notes.push(`Weights rescaled from a sum of ${total} to exactly 100.`);
  }

  return { spec: { ...spec, criteria, bands }, notes };
}

const DOMINANT_WEIGHT = 50;
const MAX_CRITERIA = 8;

export function lintRubric(spec: RubricSpec): RubricLint {
  const issues: RubricIssue[] = [];
  const { criteria, bands } = spec;

  if (!spec.title?.trim()) issues.push({ severity: "WARN", message: "Rubric has no title." });

  // Criteria + weights.
  if (criteria.length < 2) {
    issues.push({ severity: "ERROR", message: `Only ${criteria.length} criterion — a rubric needs at least 2.` });
  } else if (criteria.length > MAX_CRITERIA) {
    issues.push({ severity: "WARN", message: `${criteria.length} criteria — an evaluator drifts past ${MAX_CRITERIA}; consolidate.` });
  }
  const weightTotal = criteria.reduce((s, c) => s + c.weight, 0);
  if (criteria.some((c) => !Number.isInteger(c.weight) || c.weight <= 0)) {
    issues.push({ severity: "ERROR", message: "Every criterion weight must be a positive integer." });
  } else if (weightTotal !== 100) {
    issues.push({ severity: "ERROR", message: `Criterion weights sum to ${weightTotal}, not 100.` });
  }
  for (const c of criteria) {
    if (c.weight > DOMINANT_WEIGHT) {
      issues.push({ severity: "WARN", message: `"${c.name}" carries ${c.weight} points — one criterion dominates the verdict.` });
    }
    if (!c.guidance?.trim()) {
      issues.push({ severity: "WARN", message: `"${c.name}" has no guidance — scorers will improvise.` });
    }
  }

  // Bands: must tile 0–100 contiguously, in order, with a monotonic verdict.
  if (bands.length < 2) {
    issues.push({ severity: "ERROR", message: "Need at least 2 score bands (a PASS and a BLOCK region)." });
  } else {
    const sorted = [...bands].sort((a, b) => a.min - b.min);
    if (sorted[0].min !== 0) issues.push({ severity: "ERROR", message: `Bands must start at 0 (first starts at ${sorted[0].min}).` });
    if (sorted[sorted.length - 1].max !== 100) {
      issues.push({ severity: "ERROR", message: `Bands must end at 100 (last ends at ${sorted[sorted.length - 1].max}).` });
    }
    for (const b of sorted) {
      if (b.min > b.max) issues.push({ severity: "ERROR", message: `Band "${b.label}" is inverted (${b.min}–${b.max}).` });
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].min !== sorted[i - 1].max + 1) {
        issues.push({
          severity: "ERROR",
          message: `Bands "${sorted[i - 1].label}" (…${sorted[i - 1].max}) and "${sorted[i].label}" (${sorted[i].min}…) don't tile contiguously.`,
        });
      }
    }
    let seenPass = false;
    for (const b of sorted) {
      if (b.verdict === "PASS") seenPass = true;
      else if (seenPass) {
        issues.push({ severity: "ERROR", message: `Band "${b.label}" flips back to BLOCK above a PASS band — verdict must be monotonic in score.` });
        break;
      }
    }
    if (!bands.some((b) => b.verdict === "PASS")) issues.push({ severity: "ERROR", message: "No PASS band — nothing can ever pass." });
    if (!bands.some((b) => b.verdict === "BLOCK")) issues.push({ severity: "ERROR", message: "No BLOCK band — a rubric that can't fail anything gates nothing." });
  }

  // Samples power the separation check.
  if (!spec.passSample?.trim()) issues.push({ severity: "ERROR", message: "Missing the should-PASS sample (needed to prove the rubric separates)." });
  if (!spec.blockSample?.trim()) issues.push({ severity: "ERROR", message: "Missing the should-BLOCK sample (needed to prove the rubric separates)." });

  const errors = issues.filter((i) => i.severity === "ERROR").length;
  const warnings = issues.filter((i) => i.severity === "WARN").length;
  return {
    issues,
    summary: { errors, warnings, weightTotal, criteria: criteria.length, bands: bands.length },
    ok: errors === 0,
  };
}

/**
 * Render the spec into a Template body the QA pipeline can consume: it must
 * contain the literal {{artifact}} placeholder and instruct the evaluator to
 * end with `Score:` and `Verdict:` lines (the extractVerdict contract, with the
 * regex fallback still able to find a literal `Verdict: PASS|BLOCK`).
 */
export function renderRubricBody(spec: RubricSpec): string {
  const sorted = [...spec.bands].sort((a, b) => a.min - b.min);
  const criteria = spec.criteria
    .map((c, i) => `${i + 1}. **${c.name}** (${c.weight} pts) — ${c.guidance}`)
    .join("\n");
  const bands = sorted.map((b) => `- ${b.min}–${b.max}: ${b.label} → ${b.verdict}`).join("\n");

  return `You are a strict evaluator. Score the artifact below against this rubric. Judge only what is in the artifact; do not give credit for intentions.

# ${spec.title}
Artifact type: ${spec.artifactType}

## Criteria (weights sum to 100)
${criteria}

## Scoring
Score each criterion from 0 up to its weight and justify it in one sentence. The total score is the sum (0–100). Then apply the bands:
${bands}

## Artifact to evaluate
{{artifact}}

## Output format
One line per criterion: <name> — <points>/<weight> — <one-sentence justification>.
Then exactly these two final lines:
Score: <total>/100
Verdict: <PASS or BLOCK>`;
}
