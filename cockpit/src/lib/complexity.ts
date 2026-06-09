// Complexity Analyzer primitives. The MODEL estimates Big-O (it can reason
// about algorithms); the STATIC SCAN here establishes what growth mechanisms
// the code actually contains — loop nesting, recursion, sorting — and audits
// the model's claim against them. A static scan can't prove Big-O, but it can
// prove the ABSENCE of mechanisms: a claim of O(n²) over code with no loops,
// no recursion, and no sort is a hallucination worth flagging. Reuses the
// codeSmells lexer (strings/comments stripped, functions located).

import { findFunctions, ownBody, stripCode } from "@/lib/codeSmells";

export type FnComplexity = {
  name: string;
  line: number;
  loopDepth: number; // max nesting of loops/iteration callbacks within the function
  recursive: boolean;
  callsSort: boolean;
};

export type ComplexityScan = {
  functions: FnComplexity[];
  maxLoopDepth: number;
  hasRecursion: boolean;
  hasSort: boolean;
  lines: number;
};

export type GrowthClass =
  | "constant"
  | "logarithmic"
  | "linear"
  | "linearithmic"
  | "polynomial"
  | "exponential"
  | "unknown";

export type ClaimIssue = { severity: "WARN"; message: string };

const LOOP_KEYWORD = /\b(for|while)\s*\(|\bdo\s*\{/g;
const ITERATION_METHOD = /\.(map|forEach|filter|reduce|reduceRight|flatMap|some|every|find|findIndex)\s*\(/g;
const SORT_CALL = /\.(sort|toSorted)\s*\(/;

/** Max overlapping-loop nesting in a (stripped) function body. */
export function maxLoopNesting(body: string): number {
  // Collect loop-introduction positions, then walk chars tracking brace depth;
  // a loop entered at depth d is "active" until depth returns to d.
  const starts = new Set<number>();
  for (const re of [LOOP_KEYWORD, ITERATION_METHOD]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) starts.add(m.index);
  }

  let depth = 0;
  let max = 0;
  const stack: number[] = [];
  for (let i = 0; i < body.length; i++) {
    if (starts.has(i)) {
      stack.push(depth);
      if (stack.length > max) max = stack.length;
    } else if (body[i] === "{") depth++;
    else if (body[i] === "}") {
      depth--;
      while (stack.length && stack[stack.length - 1] >= depth) stack.pop();
    }
  }
  return max;
}

/** Deterministic growth-mechanism scan over a snippet. */
export function scanComplexity(code: string): ComplexityScan {
  const stripped = stripCode(code);
  const fns = findFunctions(stripped);

  const functions: FnComplexity[] = fns.map((fn) => {
    const body = ownBody(stripped, fn, fns);
    const recursive =
      fn.name !== "(anonymous)" && new RegExp(`\\b${escapeRe(fn.name)}\\s*\\(`).test(body.slice(1));
    return {
      name: fn.name,
      line: fn.headerLine,
      loopDepth: maxLoopNesting(body),
      recursive,
      callsSort: SORT_CALL.test(body),
    };
  });

  // Top-level code outside functions still counts (a bare nested loop snippet).
  const wholeDepth = maxLoopNesting(stripped);

  const maxLoopDepth = Math.max(wholeDepth, ...functions.map((f) => f.loopDepth), 0);
  return {
    functions,
    maxLoopDepth,
    hasRecursion: functions.some((f) => f.recursive),
    hasSort: SORT_CALL.test(stripped),
    lines: code.split(/\r?\n/).length,
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse a Big-O string ("O(n log n)", "O(n²)", "O(n*m)") into a growth class. */
export function classifyBigO(s: string): GrowthClass {
  const inner = /o\(([^)]*)\)/i.exec(s.replace(/\s+/g, ""));
  if (!inner) return "unknown";
  const t = inner[1]
    .toLowerCase()
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[×·]/g, "*");

  if (/!|\d+\^[a-z]|[a-z]\^[a-z]/.test(t)) return "exponential"; // n!, 2^n, k^n
  if (/[a-z]\^\d|([a-z])\*\1|[a-z]\*[a-z]/.test(t)) return "polynomial"; // n^2, n*n, n*m
  if (/[a-z]\*?log/.test(t)) return "linearithmic"; // nlogn, n*logn
  if (/^log/.test(t)) return "logarithmic";
  if (/^[a-z](\+[a-z])*$/.test(t)) return "linear"; // n, n+m, v+e
  if (/^(1|c)$/.test(t)) return "constant";
  return "unknown";
}

const RANK: Record<GrowthClass, number> = {
  constant: 0,
  logarithmic: 1,
  linear: 2,
  linearithmic: 3,
  polynomial: 4,
  exponential: 5,
  unknown: -1,
};

/**
 * Audit the model's time claim against the scanned mechanisms. WARNs only —
 * the scan can't prove a bound, but it can flag claims the code's structure
 * cannot justify (and suspicious under-claims).
 */
export function auditClaim(scan: ComplexityScan, timeBigO: string): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  const cls = classifyBigO(timeBigO);

  if (cls === "unknown") {
    issues.push({ severity: "WARN", message: `Couldn't parse the claimed bound "${timeBigO}" — expected O(...) notation.` });
    return issues;
  }

  // What can the visible mechanisms justify, at most?
  const cap = scan.hasRecursion
    ? RANK.exponential // recursion can be anything; trust the model
    : scan.maxLoopDepth >= 2
      ? RANK.polynomial
      : scan.maxLoopDepth === 1 || scan.hasSort
        ? RANK.linearithmic
        : RANK.constant;

  if (RANK[cls] > cap) {
    const found =
      scan.maxLoopDepth === 0 && !scan.hasRecursion && !scan.hasSort
        ? "no loops, no recursion, and no sort calls"
        : `max loop depth ${scan.maxLoopDepth}${scan.hasSort ? " plus sorting" : ""} and no recursion`;
    issues.push({
      severity: "WARN",
      message: `Claimed ${timeBigO}, but the static scan found ${found} — nothing in the code's structure justifies that growth. (A static scan can't prove Big-O; treat the claim as unverified.)`,
    });
  }

  if (RANK[cls] <= RANK.logarithmic && scan.maxLoopDepth >= 2) {
    issues.push({
      severity: "WARN",
      message: `Claimed ${timeBigO}, but the scan found loops nested ${scan.maxLoopDepth} deep — that bound looks optimistic unless the loops are constant-bounded.`,
    });
  }

  return issues;
}
