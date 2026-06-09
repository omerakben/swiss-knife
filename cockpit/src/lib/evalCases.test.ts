import { describe, expect, it } from "vitest";

import { isEvalCase, lintCases, markDuplicates, type EvalCase } from "./evalCases";

const mk = (dimension: EvalCase["dimension"], verdict: "PASS" | "BLOCK", n = 1): EvalCase => ({
  dimension,
  title: `${dimension} case ${n}`,
  artifact: `artifact for ${dimension} ${n}`,
  expectedVerdict: verdict,
  rationale: "because",
});

const FULL: EvalCase[] = [
  mk("happy", "PASS"),
  mk("boundary", "PASS"),
  mk("adversarial", "BLOCK"),
  mk("ambiguous", "BLOCK"),
  mk("out-of-scope", "BLOCK"),
];

describe("lintCases", () => {
  it("passes a full-coverage set", () => {
    const r = lintCases(FULL);
    expect(r.ok).toBe(true);
    expect(r.summary.errors).toBe(0);
    expect(r.summary.byDimension.happy).toBe(1);
  });

  it("errors on each missing dimension", () => {
    const r = lintCases(FULL.filter((c) => c.dimension !== "adversarial" && c.dimension !== "ambiguous"));
    expect(r.ok).toBe(false);
    expect(r.issues.filter((i) => i.severity === "ERROR").length).toBe(2);
    expect(r.issues.some((i) => /No adversarial case/.test(i.message))).toBe(true);
  });

  it("errors on an empty artifact", () => {
    const broken = [...FULL];
    broken[0] = { ...broken[0], artifact: "  " };
    const r = lintCases(broken);
    expect(r.issues.some((i) => i.severity === "ERROR" && /empty artifact/.test(i.message))).toBe(true);
  });

  it("warns on verdict/dimension mismatches", () => {
    const odd = [...FULL];
    odd[0] = { ...odd[0], expectedVerdict: "BLOCK" }; // happy that blocks
    odd[2] = { ...odd[2], expectedVerdict: "PASS" }; // adversarial that passes
    const r = lintCases(odd);
    expect(r.ok).toBe(true); // advisory, not a gate
    expect(r.issues.filter((i) => i.severity === "WARN").length).toBe(2);
  });
});

describe("markDuplicates", () => {
  it("flags a near-duplicate against the EARLIEST prior case", () => {
    const a = [1, 0, 0];
    const b = [0.99, 0.05, 0]; // ~a
    const c = [0, 1, 0]; // distinct
    const d = [0.98, 0.08, 0]; // ~a (and ~b) — must point at index 0
    expect(markDuplicates([a, b, c, d], 0.9)).toEqual([null, 0, null, 0]);
  });

  it("returns all nulls when everything is distinct", () => {
    expect(markDuplicates([[1, 0], [0, 1]], 0.72)).toEqual([null, null]);
  });
});

describe("isEvalCase", () => {
  it("accepts a valid case and rejects malformed ones", () => {
    expect(isEvalCase(FULL[0])).toBe(true);
    expect(isEvalCase({})).toBe(false);
    expect(isEvalCase({ ...FULL[0], expectedVerdict: "MAYBE" })).toBe(false);
    expect(isEvalCase({ ...FULL[0], dimension: "weird" })).toBe(false);
    expect(isEvalCase({ ...FULL[0], artifact: "" })).toBe(false);
  });
});
