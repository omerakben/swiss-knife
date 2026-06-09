import { describe, expect, it } from "vitest";

import {
  lintRubric,
  normalizeRubric,
  projectRubricSlug,
  renderRubricBody,
  type RubricSpec,
} from "./rubric";

const GOOD: RubricSpec = {
  title: "API error-response quality",
  artifactType: "REST error response (JSON)",
  criteria: [
    { name: "Actionable message", weight: 40, guidance: "States what failed and what to do next." },
    { name: "Correct status code", weight: 30, guidance: "HTTP status matches the failure class." },
    { name: "No internals leaked", weight: 30, guidance: "No stack traces, SQL, or file paths." },
  ],
  bands: [
    { label: "Reject", min: 0, max: 59, verdict: "BLOCK" },
    { label: "Ship", min: 60, max: 100, verdict: "PASS" },
  ],
  passSample: '{"error":"Due date must be ISO-8601 (got 31/12)."}',
  blockSample: '{"error":"java.lang.NullPointerException at line 412"}',
};

describe("lintRubric", () => {
  it("passes a well-formed rubric", () => {
    const r = lintRubric(GOOD);
    expect(r.ok).toBe(true);
    expect(r.summary.errors).toBe(0);
    expect(r.summary.weightTotal).toBe(100);
  });

  it("errors when weights don't sum to 100", () => {
    const r = lintRubric({
      ...GOOD,
      criteria: [GOOD.criteria[0], { ...GOOD.criteria[1], weight: 20 }, GOOD.criteria[2]],
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.severity === "ERROR" && /sum to 90, not 100/.test(i.message))).toBe(true);
  });

  it("errors on non-contiguous bands", () => {
    const r = lintRubric({
      ...GOOD,
      bands: [
        { label: "Reject", min: 0, max: 50, verdict: "BLOCK" },
        { label: "Ship", min: 60, max: 100, verdict: "PASS" },
      ],
    });
    expect(r.issues.some((i) => i.severity === "ERROR" && /don't tile contiguously/.test(i.message))).toBe(true);
  });

  it("errors when the verdict flips back to BLOCK above a PASS band", () => {
    const r = lintRubric({
      ...GOOD,
      bands: [
        { label: "Low", min: 0, max: 40, verdict: "BLOCK" },
        { label: "Mid", min: 41, max: 70, verdict: "PASS" },
        { label: "Sus", min: 71, max: 100, verdict: "BLOCK" },
      ],
    });
    expect(r.issues.some((i) => i.severity === "ERROR" && /monotonic/.test(i.message))).toBe(true);
  });

  it("errors when no band can BLOCK (or none can PASS)", () => {
    const allPass = lintRubric({
      ...GOOD,
      bands: [
        { label: "A", min: 0, max: 50, verdict: "PASS" },
        { label: "B", min: 51, max: 100, verdict: "PASS" },
      ],
    });
    expect(allPass.issues.some((i) => /can't fail anything/.test(i.message))).toBe(true);
  });

  it("errors on fewer than 2 criteria and on missing samples", () => {
    const r = lintRubric({ ...GOOD, criteria: [GOOD.criteria[0]], passSample: "", blockSample: " " });
    expect(r.issues.filter((i) => i.severity === "ERROR").length).toBeGreaterThanOrEqual(3);
  });

  it("warns on a dominant criterion", () => {
    const r = lintRubric({
      ...GOOD,
      criteria: [
        { name: "Everything", weight: 80, guidance: "all of it" },
        { name: "Rest", weight: 20, guidance: "the rest" },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.severity === "WARN" && /dominates/.test(i.message))).toBe(true);
  });
});

describe("normalizeRubric", () => {
  it("rescales near-miss weights to exactly 100 (largest remainder)", () => {
    const { spec, notes } = normalizeRubric({
      ...GOOD,
      criteria: [
        { name: "A", weight: 40, guidance: "a" },
        { name: "B", weight: 35, guidance: "b" },
        { name: "C", weight: 35, guidance: "c" }, // sum 110
      ],
    });
    expect(spec.criteria.reduce((s, c) => s + c.weight, 0)).toBe(100);
    expect(notes.some((n) => /rescaled/.test(n))).toBe(true);
  });

  it("leaves a far-off sum for the lint to reject", () => {
    const { spec } = normalizeRubric({
      ...GOOD,
      criteria: [
        { name: "A", weight: 10, guidance: "a" },
        { name: "B", weight: 10, guidance: "b" },
      ],
    });
    expect(spec.criteria.reduce((s, c) => s + c.weight, 0)).toBe(20);
    expect(lintRubric(spec).ok).toBe(false);
  });

  it("closes an off-by-one band seam and sorts bands", () => {
    const { spec, notes } = normalizeRubric({
      ...GOOD,
      bands: [
        { label: "Ship", min: 60, max: 100, verdict: "PASS" },
        { label: "Reject", min: 0, max: 60, verdict: "BLOCK" }, // seam at 60
      ],
    });
    expect(spec.bands[0].label).toBe("Reject");
    expect(spec.bands[1].min).toBe(61);
    expect(notes.length).toBe(1);
    expect(lintRubric(spec).ok).toBe(true); // the repaired bands tile cleanly
  });
});

describe("renderRubricBody", () => {
  it("keeps the QA pipeline contract: {{artifact}} + final Verdict line", () => {
    const body = renderRubricBody(GOOD);
    expect(body).toContain("{{artifact}}");
    expect(body).toContain("Verdict: <PASS or BLOCK>");
    expect(body).toContain("Score: <total>/100");
    expect(body).toContain("**Actionable message** (40 pts)");
    expect(body).toContain("- 0–59: Reject → BLOCK");
  });
});

describe("isRubricSpec", () => {
  it("accepts a well-formed spec and rejects malformed ones", async () => {
    const { isRubricSpec } = await import("./rubric");
    expect(isRubricSpec(GOOD)).toBe(true);
    expect(isRubricSpec({})).toBe(false);
    expect(isRubricSpec({ ...GOOD, criteria: "nope" })).toBe(false);
    expect(isRubricSpec({ ...GOOD, title: 5 })).toBe(false);
    expect(isRubricSpec({ ...GOOD, bands: [{ label: "x", min: 0, max: 100, verdict: "MAYBE" }] })).toBe(false);
  });
});

describe("projectRubricSlug", () => {
  it("is stable per project and global without one", () => {
    expect(projectRubricSlug("p1")).toBe("qa-eval-rubric:p1");
    expect(projectRubricSlug(null)).toBe("qa-eval-rubric:global");
  });
});
