// Eval Case Generator primitives. A spec is expanded into labeled eval cases
// across five coverage dimensions; the deterministic gate enforces full
// dimensional coverage and verdict sanity, and near-duplicate artifacts are
// flagged via embeddinggemma cosine (same 0.72 cutoff the memory loop
// calibrated on real vectors). Accepted cases land in the existing GoldenCase
// model, one human accept at a time — they feed the eval bench unchanged.

import { cosine } from "@/lib/embeddings";

export const CASE_DIMENSIONS = [
  "happy",
  "boundary",
  "adversarial",
  "ambiguous",
  "out-of-scope",
] as const;
export type CaseDimension = (typeof CASE_DIMENSIONS)[number];

export type EvalCase = {
  dimension: CaseDimension;
  title: string;
  artifact: string;
  expectedVerdict: "PASS" | "BLOCK";
  rationale: string;
};

export type EvalCaseIssue = { severity: "ERROR" | "WARN"; message: string };
export type EvalCaseLint = {
  issues: EvalCaseIssue[];
  summary: {
    errors: number;
    warnings: number;
    total: number;
    byDimension: Record<CaseDimension, number>;
  };
  ok: boolean;
};

/** Memory-loop-calibrated cosine cutoff for "these two are the same case". */
export const DEDUPE_CUTOFF = 0.72;

export function lintCases(cases: EvalCase[]): EvalCaseLint {
  const issues: EvalCaseIssue[] = [];
  const byDimension = Object.fromEntries(CASE_DIMENSIONS.map((d) => [d, 0])) as Record<
    CaseDimension,
    number
  >;

  cases.forEach((c, i) => {
    if (byDimension[c.dimension] !== undefined) byDimension[c.dimension] += 1;
    if (!c.artifact?.trim()) {
      issues.push({ severity: "ERROR", message: `Case ${i + 1} ("${c.title}") has an empty artifact — nothing to evaluate.` });
    }
    if (!c.title?.trim()) {
      issues.push({ severity: "ERROR", message: `Case ${i + 1} has no title.` });
    }
    // Verdict sanity: a happy case that BLOCKs (or an out-of-scope/adversarial
    // case that PASSes) usually means the model mislabeled the dimension.
    if (c.dimension === "happy" && c.expectedVerdict !== "PASS") {
      issues.push({ severity: "WARN", message: `Happy case "${c.title}" expects ${c.expectedVerdict} — happy paths should PASS.` });
    }
    if ((c.dimension === "adversarial" || c.dimension === "out-of-scope") && c.expectedVerdict !== "BLOCK") {
      issues.push({ severity: "WARN", message: `${c.dimension} case "${c.title}" expects PASS — these usually BLOCK.` });
    }
  });

  for (const d of CASE_DIMENSIONS) {
    if (byDimension[d] === 0) {
      issues.push({ severity: "ERROR", message: `No ${d} case — every dimension needs at least one.` });
    }
  }

  const errors = issues.filter((i) => i.severity === "ERROR").length;
  const warnings = issues.filter((i) => i.severity === "WARN").length;
  return {
    issues,
    summary: { errors, warnings, total: cases.length, byDimension },
    ok: errors === 0,
  };
}

/**
 * Mark near-duplicate cases: for each case, the index of the EARLIEST prior
 * case whose artifact embedding is within the cutoff, else null. Pure — the
 * vectors are computed by the caller, so this is unit-testable without Ollama.
 */
export function markDuplicates(
  vectors: number[][],
  cutoff: number = DEDUPE_CUTOFF
): (number | null)[] {
  return vectors.map((v, i) => {
    for (let j = 0; j < i; j++) {
      if (cosine(v, vectors[j]) >= cutoff) return j;
    }
    return null;
  });
}

/** Structural guard for the accept path (client-supplied case → GoldenCase row). */
export function isEvalCase(c: unknown): c is EvalCase {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    o.title.trim().length > 0 &&
    o.title.length <= 300 &&
    typeof o.artifact === "string" &&
    o.artifact.trim().length > 0 &&
    o.artifact.length <= 20_000 &&
    (o.expectedVerdict === "PASS" || o.expectedVerdict === "BLOCK") &&
    typeof o.dimension === "string" &&
    (CASE_DIMENSIONS as readonly string[]).includes(o.dimension)
  );
}
