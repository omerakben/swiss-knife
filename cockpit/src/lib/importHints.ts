import { validateHint } from "./toolHints";

// Pure decision logic for the ToolHint import row gate — extracted from the
// toolHints branch of POST /api/import (api/import/route.ts) so it's unit
// testable without a request/DB round trip. Mirrors the same
// present-but-non-array-is-a-corrupted-section contract that upsertAll()
// uses for every other import section in that route: an absent/null field is
// a legitimate "nothing to import" (0 valid, 0 failed), but a present field
// of the wrong type is a corrupted backup and counts as one failure. Row-level
// shape/gate failures (bad shape, unknown key, oversize/non-string text) each
// count as one failure too. Upsert-time failures (e.g. a DB error) are NOT
// this function's concern — the route adds those on top of `failed` after
// attempting the upsert for each `valid` entry.
//
// Each valid entry carries the UNTOUCHED source row alongside its validated
// key: the route upserts `update: rest` (row minus id) / `create: row`, so
// extra exported fields (e.g. createdAt) survive a cross-machine restore
// exactly as they did before this extraction.
export type HintImportEntry = { key: string; row: Record<string, unknown> };

export type HintImportPlan = {
  valid: HintImportEntry[];
  failed: number;
};

export function planHintImport(rows: unknown): HintImportPlan {
  if (rows != null && !Array.isArray(rows)) return { valid: [], failed: 1 };

  const valid: HintImportEntry[] = [];
  let failed = 0;
  for (const h of Array.isArray(rows) ? rows : []) {
    const key = h && typeof h === "object" ? (h as Record<string, unknown>).key : undefined;
    const text = h && typeof h === "object" ? (h as Record<string, unknown>).text : undefined;
    // Route the same registry gate a live save goes through (lib/toolHints.ts)
    // over an imported row too — otherwise a corrupted/foreign backup (unknown
    // key, or a multi-MB "text") lands in the DB permanently, since nothing
    // downstream re-validates a ToolHint row after import.
    if (typeof key !== "string" || !key || !validateHint(key, text as string).ok) {
      failed += 1;
      continue;
    }
    valid.push({ key, row: h as Record<string, unknown> });
  }
  return { valid, failed };
}
