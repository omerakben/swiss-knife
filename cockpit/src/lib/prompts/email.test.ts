import { describe, it, expect } from "vitest";
import { emailSpec } from "./email";

describe("emailSpec", () => {
  it("folds the requested tone and length into the rules and carries two examples", () => {
    const spec = emailSpec("friendly", "short (2-3 sentences)");
    expect(spec.rules.join(" ")).toContain("friendly");
    expect(spec.rules.join(" ")).toContain("short (2-3 sentences)");
    expect(spec.examples.length).toBe(2);
    expect(spec.outputContract.toLowerCase()).toContain("subject");
  });

  it("each example input mirrors the route's user-message shape", () => {
    for (const ex of emailSpec("neutral", "medium").examples) {
      expect(ex.input).toContain("Intent / notes for the email:");
    }
  });
});
