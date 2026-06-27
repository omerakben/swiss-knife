import { describe, it, expect } from "vitest";
import { compileSpec } from "./spec";
import { TASKS_GENERATE_SPEC } from "./tasksGenerate";

describe("TASKS_GENERATE_SPEC", () => {
  it("compiles to system + 2 example turns + the goal, with each example output line-shaped", () => {
    const msgs = compileSpec(TASKS_GENERATE_SPEC, "Open a small bakery");
    expect(msgs.map((m) => m.role)).toEqual(["system", "user", "assistant", "user", "assistant", "user"]);
    expect(msgs[msgs.length - 1].content).toBe("Open a small bakery");
    // every example output is one-task-per-line, no bullets/numbering
    for (const ex of TASKS_GENERATE_SPEC.examples) {
      for (const line of ex.output.split("\n")) {
        expect(line.trim().length).toBeGreaterThan(0);
        expect(line).not.toMatch(/^[\s\-*\d.)]/); // no leading bullet/number
      }
    }
  });
});
