import { describe, expect, it } from "vitest";

import {
  REFINE_MODES,
  DEFAULT_MODE,
  getRefineMode,
  buildRefineSystem,
  type RefineModeId,
} from "./refine";

describe("refine kit", () => {
  it("has the four AHA lenses with unique ids and non-empty copy", () => {
    const ids = REFINE_MODES.map((m) => m.id);
    expect(ids).toEqual(["interview", "align", "critique", "sharpen"]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of REFINE_MODES) {
      expect(m.label.trim().length).toBeGreaterThan(0);
      expect(m.blurb.trim().length).toBeGreaterThan(0);
      expect(m.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("default mode is a real lens", () => {
    expect(REFINE_MODES.some((m) => m.id === DEFAULT_MODE)).toBe(true);
  });

  it("getRefineMode falls back to the default on unknown/empty input", () => {
    expect(getRefineMode("interview").id).toBe("interview");
    expect(getRefineMode("nope").id).toBe(DEFAULT_MODE);
    expect(getRefineMode(null).id).toBe(DEFAULT_MODE);
    expect(getRefineMode(undefined).id).toBe(DEFAULT_MODE);
  });

  it("buildRefineSystem always carries the frame, the lens body, and the safety block", () => {
    for (const m of REFINE_MODES) {
      const sys = buildRefineSystem(m.id);
      expect(sys).toContain("You are Refine");
      expect(sys).toContain(m.body.split("\n")[0]); // lens-specific first line
      expect(sys).toContain("Do not act as a lawyer, doctor, or accountant");
    }
  });

  it("the interview lens forbids solving and caps the question count", () => {
    const sys = buildRefineSystem("interview");
    expect(sys).toMatch(/do not solve/i);
    expect(sys).toMatch(/3 to 5 questions/i);
  });

  it("an unknown lens still yields a usable prompt (default body)", () => {
    const sys = buildRefineSystem("garbage" as RefineModeId);
    expect(sys).toContain(getRefineMode(DEFAULT_MODE).body.split("\n")[0]);
  });
});
