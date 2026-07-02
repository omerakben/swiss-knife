import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

import { MAX_HINT, PLACEHOLDER_DEFAULTS, quickActionHintKey, validateHint } from "./toolHints";
import { QUICK_ACTIONS } from "./quickActions";

describe("toolHints registry", () => {
  it("every default is non-empty and within the cap", () => {
    for (const [k, v] of Object.entries(PLACEHOLDER_DEFAULTS)) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(v.length, k).toBeLessThanOrEqual(MAX_HINT);
    }
  });
  it("covers every quick-action input that ships a placeholder", () => {
    for (const a of QUICK_ACTIONS) for (const inp of a.inputs) {
      if (inp.placeholder) expect(PLACEHOLDER_DEFAULTS[quickActionHintKey(a.id, inp.name)]).toBe(inp.placeholder);
    }
  });
  it("gates writes: unknown key, oversize, non-string", () => {
    expect(validateHint("no-such-key", "x").ok).toBe(false);
    expect(validateHint("email-brief", "x".repeat(MAX_HINT + 1)).ok).toBe(false);
    expect(validateHint("email-brief", 5 as unknown as string).ok).toBe(false);
    expect(validateHint("email-brief", "custom hint").ok).toBe(true);
  });
  it("rejects Object.prototype keys (the `in` operator walks the prototype chain)", () => {
    expect(validateHint("toString", "x").ok).toBe(false);
    expect(validateHint("__proto__", "x").ok).toBe(false);
    expect(validateHint("constructor", "x").ok).toBe(false);
    expect(validateHint("hasOwnProperty", "x").ok).toBe(false);
  });
});

// Drift tripwire (same style as the nav/manual/wizard registry tests): walk
// src/ looking for hardcoded calls to the usePlaceholder hook or hintKey prop
// literals and assert every key found is a real entry in PLACEHOLDER_DEFAULTS.
// A consumer that typos or hardcodes a stale key would otherwise silently fall
// back to an empty hook value or a 400 at save time (EditHintButton), with no
// compile-time signal. Zero matches is expected until a later task wires
// consumers — this test starts doing real work once it does. This file is
// excluded from its own scan (it necessarily talks ABOUT the patterns, not
// AS a consumer of them — see the file list below).
const SKIP_DIRS = new Set(["node_modules", ".next", "e2e"]);
const SKIP_FILES = new Set(["toolHints.test.ts"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

function findHintKeyLiterals(): string[] {
  const SRC_DIR = join(__dirname, "..");
  const usePlaceholderPattern = /usePlaceholder\(\s*["']([^"']+)["']/g;
  const hintKeyPattern = /hintKey=\{?\s*["']([^"']+)["']/g;
  const found = new Set<string>();
  for (const file of walk(SRC_DIR)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(usePlaceholderPattern)) found.add(m[1]);
    for (const m of src.matchAll(hintKeyPattern)) found.add(m[1]);
  }
  return [...found];
}

describe("toolHints usage drift", () => {
  const literals = findHintKeyLiterals();
  if (literals.length === 0) {
    // No consumer wired yet (this lands before the components that call
    // usePlaceholder/EditHintButton) — a placeholder assertion keeps the
    // suite non-empty; it.each([]) would otherwise report "no test found".
    it("no usePlaceholder/hintKey literals found yet", () => {
      expect(literals).toEqual([]);
    });
  } else {
    it.each(literals)("usePlaceholder/hintKey literal %s exists in PLACEHOLDER_DEFAULTS", (key) => {
      expect(PLACEHOLDER_DEFAULTS[key]).toBeDefined();
    });
  }
});
