import { describe, it, expect } from "vitest";
import { tokenize, jaccard, dedupeCap } from "@/lib/memoryLoop";

describe("tokenize", () => {
  it("lowercases, splits on punctuation, and drops words of length <= 2", () => {
    const t = tokenize("Point of Sale");
    expect(t.has("point")).toBe(true);
    expect(t.has("sale")).toBe(true);
    expect(t.has("of")).toBe(false); // length 2 -> dropped
  });
  it("treats punctuation as a separator", () => {
    const t = tokenize("tax-exempt!");
    expect(t.has("tax")).toBe(true);
    expect(t.has("exempt")).toBe(true);
  });
});

describe("jaccard", () => {
  it("is 1 for identical token sets (case-insensitive)", () => {
    expect(jaccard("point of sale", "POINT of SALE")).toBe(1);
  });
  it("is 0 for disjoint sets", () => {
    expect(jaccard("alpha beta", "gamma delta")).toBe(0);
  });
  it("hits exactly the 0.8 dedupe boundary at 4-of-5 overlap (>= counts as dup)", () => {
    // A = 5 tokens, B = 4 of them -> inter 4, union 5 -> 4/5 = 0.8
    expect(jaccard("alpha beta gamma delta epsilon", "alpha beta gamma delta")).toBeCloseTo(0.8, 10);
  });
  it("is below the cutoff at 3-of-5 overlap", () => {
    expect(jaccard("alpha beta gamma delta epsilon", "alpha beta gamma")).toBeLessThan(0.8);
  });
  it("is 0 when a side has no tokens longer than 2 chars", () => {
    expect(jaccard("a an of", "alpha")).toBe(0);
    expect(jaccard("", "")).toBe(0);
  });
});

describe("dedupeCap", () => {
  const cat = "general" as const;
  it("collapses case-insensitive duplicate values", () => {
    const out = dedupeCap([
      { value: "Foo", category: cat },
      { value: "foo", category: cat },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("Foo"); // first wins
  });
  it("drops values of length <= 2 and trims whitespace", () => {
    const out = dedupeCap([
      { value: "ab", category: cat },
      { value: "  spaced  ", category: cat },
    ]);
    expect(out.map((o) => o.value)).toEqual(["spaced"]);
  });
  it("caps at 8, preserving the first-8 order", () => {
    const raw = Array.from({ length: 12 }, (_, i) => ({ value: `fact ${i}`, category: cat }));
    const out = dedupeCap(raw);
    expect(out).toHaveLength(8);
    expect(out[0].value).toBe("fact 0");
    expect(out[7].value).toBe("fact 7");
  });
  it("carries the category through unchanged", () => {
    const out = dedupeCap([{ value: "glossary term", category: "glossary" }]);
    expect(out[0].category).toBe("glossary");
  });
});
