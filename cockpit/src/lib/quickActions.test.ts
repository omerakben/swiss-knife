import { describe, expect, it } from "vitest";

import { QUICK_ACTIONS, getQuickAction, missingInputs, buildMessages, getFeaturedDemo } from "./quickActions";

describe("quickActions", () => {
  it("every action has a unique id, at least one input, and a system prompt", () => {
    const ids = new Set<string>();
    for (const a of QUICK_ACTIONS) {
      expect(a.id).toBeTruthy();
      expect(ids.has(a.id), `duplicate id ${a.id}`).toBe(false);
      ids.add(a.id);
      expect(a.inputs.length).toBeGreaterThan(0);
      expect(a.system.trim().length).toBeGreaterThan(0);
      expect(a.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("getQuickAction finds by id and returns undefined for unknown", () => {
    expect(getQuickAction("summarize")?.title).toBe("Summarize this");
    expect(getQuickAction("does-not-exist")).toBeUndefined();
  });

  it("missingInputs lists required-but-empty inputs and ignores optional ones", () => {
    const a = getQuickAction("meal-plan")!; // preferences required, days optional
    expect(missingInputs(a, {})).toContain("Any preferences or restrictions?");
    expect(missingInputs(a, {})).not.toContain("How many days?");
    expect(missingInputs(a, { preferences: "vegetarian" })).toEqual([]);
    expect(missingInputs(a, { preferences: "   " })).not.toEqual([]); // whitespace is empty
  });

  it("treats non-string input values as empty and never throws", () => {
    const a = getQuickAction("summarize")!;
    const bad = { text: 123 as unknown as string };
    expect(missingInputs(a, bad)).toContain("Paste the text");
    expect(() => buildMessages(a, bad)).not.toThrow();
  });

  it("buildMessages returns a system message then a user message embedding the inputs", () => {
    const a = getQuickAction("summarize")!;
    const msgs = buildMessages(a, { text: "a distinctive phrase to find" });
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].role).toBe("user");
    expect(msgs[1].content).toContain("a distinctive phrase to find");
  });

  it("every action's buildPrompt produces non-empty text for filled inputs", () => {
    for (const a of QUICK_ACTIONS) {
      const filled = Object.fromEntries(a.inputs.map((i) => [i.name, "sample value"]));
      expect(a.buildPrompt(filled).trim().length, `${a.id} prompt empty`).toBeGreaterThan(0);
    }
  });

  it("every action has at least one example", () => {
    for (const a of QUICK_ACTIONS) {
      expect(a.examples?.length ?? 0, `${a.id} has no example`).toBeGreaterThan(0);
    }
  });

  it("every example has a label and fills its action's required inputs", () => {
    for (const a of QUICK_ACTIONS) {
      for (const ex of a.examples ?? []) {
        expect(ex.label.trim().length, `${a.id} example label empty`).toBeGreaterThan(0);
        expect(missingInputs(a, ex.inputs), `${a.id} example "${ex.label}" is missing inputs`).toEqual([]);
      }
    }
  });

  it("the featured demo resolves to a real action and a valid example", () => {
    const f = getFeaturedDemo();
    expect(f).not.toBeNull();
    expect(f!.action.id).toBeTruthy();
    expect(missingInputs(f!.action, f!.example.inputs)).toEqual([]);
  });
});
