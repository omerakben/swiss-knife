import { describe, expect, it } from "vitest";

import { auditClaim, classifyBigO, maxLoopNesting, scanComplexity } from "./complexity";

describe("maxLoopNesting", () => {
  it("counts nested loops", () => {
    expect(maxLoopNesting(`{ for (a) { for (b) { x(); } } }`)).toBe(2);
  });

  it("does not stack sequential loops", () => {
    expect(maxLoopNesting(`{ for (a) { x(); } for (b) { y(); } }`)).toBe(1);
  });

  it("counts iteration callbacks as loops", () => {
    expect(maxLoopNesting(`{ items.forEach((i) => { rows.map((r) => { z(); }); }); }`)).toBe(2);
  });
});

describe("scanComplexity", () => {
  it("finds loop depth, recursion, and sort per function", () => {
    const src = `
function bubble(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length; j++) {
      if (arr[j] > arr[j + 1]) { swap(arr, j); }
    }
  }
  return arr;
}
function fib(n) {
  if (n < 2) { return n; }
  return fib(n - 1) + fib(n - 2);
}
function tidy(list) {
  return list.sort((a, b) => a - b);
}
`;
    const scan = scanComplexity(src);
    const by = Object.fromEntries(scan.functions.map((f) => [f.name, f]));
    expect(by.bubble.loopDepth).toBe(2);
    expect(by.bubble.recursive).toBe(false);
    expect(by.fib.recursive).toBe(true);
    expect(by.tidy.callsSort).toBe(true);
    expect(scan.maxLoopDepth).toBe(2);
    expect(scan.hasRecursion).toBe(true);
    expect(scan.hasSort).toBe(true);
  });

  it("ignores loop keywords inside strings and comments", () => {
    const scan = scanComplexity(`function f() {\n  // for (a) { for (b) {} }\n  const s = "while (x) {}";\n  return s;\n}`);
    expect(scan.maxLoopDepth).toBe(0);
    expect(scan.hasRecursion).toBe(false);
  });
});

describe("classifyBigO", () => {
  it("classifies the common notations", () => {
    expect(classifyBigO("O(1)")).toBe("constant");
    expect(classifyBigO("O(log n)")).toBe("logarithmic");
    expect(classifyBigO("O(n)")).toBe("linear");
    expect(classifyBigO("O(n + m)")).toBe("linear");
    expect(classifyBigO("O(n log n)")).toBe("linearithmic");
    expect(classifyBigO("O(n^2)")).toBe("polynomial");
    expect(classifyBigO("O(n²)")).toBe("polynomial");
    expect(classifyBigO("O(n*m)")).toBe("polynomial");
    expect(classifyBigO("O(2^n)")).toBe("exponential");
    expect(classifyBigO("roughly quadratic")).toBe("unknown");
  });
});

describe("auditClaim", () => {
  const flat = scanComplexity(`function pick(o) {\n  return o.a + o.b;\n}`);
  const nested = scanComplexity(
    `function m(a) {\n  for (const x of a) {\n    for (const y of a) {\n      use(x, y);\n    }\n  }\n}`
  );

  it("warns on a super-linear claim with no mechanisms", () => {
    const issues = auditClaim(flat, "O(n^2)");
    expect(issues.length).toBe(1);
    expect(issues[0].message).toMatch(/no loops, no recursion/);
  });

  it("accepts a quadratic claim over nested loops", () => {
    expect(auditClaim(nested, "O(n^2)")).toEqual([]);
  });

  it("warns on an O(1) claim over nested loops", () => {
    const issues = auditClaim(nested, "O(1)");
    expect(issues.some((i) => /optimistic/.test(i.message))).toBe(true);
  });

  it("accepts n log n when a sort is present", () => {
    const sorty = scanComplexity(`function s(a) {\n  return a.sort();\n}`);
    expect(auditClaim(sorty, "O(n log n)")).toEqual([]);
  });

  it("trusts recursion for any bound", () => {
    const rec = scanComplexity(`function fib(n) {\n  if (n < 2) { return n; }\n  return fib(n - 1) + fib(n - 2);\n}`);
    expect(auditClaim(rec, "O(2^n)")).toEqual([]);
  });

  it("warns on unparseable notation", () => {
    expect(auditClaim(flat, "pretty fast")[0].message).toMatch(/Couldn't parse/);
  });
});
