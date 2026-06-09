import { describe, it, expect } from "vitest";
import { normalizeCategory, FACT_CATEGORIES } from "@/lib/memory";

describe("normalizeCategory", () => {
  it("maps each of the 8 valid categories to itself", () => {
    for (const c of FACT_CATEGORIES) {
      expect(normalizeCategory(c)).toBe(c);
    }
  });
  it("maps off-taxonomy labels to 'general' (incl. near-misses)", () => {
    expect(normalizeCategory("people")).toBe("general"); // roadmap term, not in the set
    expect(normalizeCategory("foo")).toBe("general");
    expect(normalizeCategory("bug")).toBe("general");
    expect(normalizeCategory("gloss")).toBe("general"); // substring of glossary, not a member
  });
  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeCategory("  Glossary ")).toBe("glossary");
    expect(normalizeCategory("GLOSSARY")).toBe("glossary");
  });
  it("maps null / undefined / empty to 'general'", () => {
    expect(normalizeCategory(null)).toBe("general");
    expect(normalizeCategory(undefined)).toBe("general");
    expect(normalizeCategory("")).toBe("general");
  });
});
