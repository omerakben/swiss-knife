import { describe, expect, it } from "vitest";

import { planHintImport } from "./importHints";

// Pure decision logic extracted from the ToolHint branch of
// api/import/route.ts (POST /api/import) — see that file's comment on the
// `key`-matched upsert for why ToolHints are handled separately from the
// generic upsertAll() path. "tasks-goal" is a real STATIC_DEFAULTS key
// (lib/toolHints.ts) so validateHint() passes for it in these tests.
describe("planHintImport", () => {
  it("accepts a well-shaped row with a real registry key, carrying the untouched source row", () => {
    const source = { key: "tasks-goal", text: "Ship the report" };
    const plan = planHintImport([source]);
    expect(plan).toEqual({ valid: [{ key: "tasks-goal", row: source }], failed: 0 });
    expect(plan.valid[0].row).toBe(source); // the ORIGINAL object, not a copy/projection
  });

  it("preserves extra exported fields (id, createdAt, updatedAt) on the carried row", () => {
    const source = {
      id: "clx123",
      key: "tasks-goal",
      text: "Ship the report",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-03T03:04:05.000Z",
    };
    const plan = planHintImport([source]);
    expect(plan.failed).toBe(0);
    expect(plan.valid).toHaveLength(1);
    expect(plan.valid[0].key).toBe("tasks-goal");
    // The full original row rides along so the route can upsert
    // `update: rest` / `create: row` exactly like the pre-extraction code —
    // a cross-machine restore keeps the source machine's createdAt on create.
    expect(plan.valid[0].row).toEqual(source);
    expect(plan.valid[0].row.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("rejects a row whose key isn't in the registry", () => {
    const plan = planHintImport([{ key: "not-a-real-key", text: "hello" }]);
    expect(plan).toEqual({ valid: [], failed: 1 });
  });

  it("rejects oversize text (> MAX_HINT)", () => {
    const plan = planHintImport([{ key: "tasks-goal", text: "x".repeat(301) }]);
    expect(plan).toEqual({ valid: [], failed: 1 });
  });

  it("rejects non-string text", () => {
    const plan = planHintImport([{ key: "tasks-goal", text: 5 }]);
    expect(plan).toEqual({ valid: [], failed: 1 });
  });

  it("treats a present-but-non-array section as one corrupted-backup failure (matches the route's upsertAll contract)", () => {
    expect(planHintImport("garbage")).toEqual({ valid: [], failed: 1 });
    expect(planHintImport({})).toEqual({ valid: [], failed: 1 });
    expect(planHintImport(42)).toEqual({ valid: [], failed: 1 });
  });

  it("treats an absent/null section as benign — zero valid, zero failed", () => {
    expect(planHintImport(undefined)).toEqual({ valid: [], failed: 0 });
    expect(planHintImport(null)).toEqual({ valid: [], failed: 0 });
  });

  it("an empty array is 0 valid / 0 failed", () => {
    expect(planHintImport([])).toEqual({ valid: [], failed: 0 });
  });

  it("counts a mixed batch correctly: valid rows pass, bad-shape/unknown/oversize/non-string rows fail", () => {
    const goodA = { key: "tasks-goal", text: "Ship the report", createdAt: "2026-01-02T00:00:00.000Z" };
    const goodB = { key: "prompt-template-body", text: "Summarize this" };
    const plan = planHintImport([
      goodA, // valid
      { key: "not-a-real-key", text: "x" }, // unknown key
      { key: "tasks-goal", text: "x".repeat(301) }, // oversize
      { key: "tasks-goal", text: 5 }, // non-string text
      { text: "no key at all" }, // missing key
      "not even an object", // malformed row
      goodB, // valid
    ]);
    expect(plan.valid).toEqual([
      { key: "tasks-goal", row: goodA },
      { key: "prompt-template-body", row: goodB },
    ]);
    expect(plan.failed).toBe(5);
  });
});
