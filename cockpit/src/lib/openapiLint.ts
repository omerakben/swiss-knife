// OpenAPI 3.1 contract gate. Validation is done by a REAL validator
// (@seriousme/openapi-schema-validator — the official OpenAPI meta-schemas,
// bundled, fully offline), then a set of opinionated, deterministic API-design
// rules runs on the parsed document: every operation needs a success AND a
// documented failure shape, list endpoints need pagination, operations need
// ids. ERROR = gate, WARN = advisory — same contract as the other lint libs.

import YAML from "yaml";
import { Validator } from "@seriousme/openapi-schema-validator";

export type OpenapiIssue = { severity: "ERROR" | "WARN"; path: string; message: string };
export type OpenapiLintResult = {
  issues: OpenapiIssue[];
  summary: { errors: number; warnings: number; operations: number; version: string | null };
  ok: boolean;
};

const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

// Common pagination parameter names, compared case-insensitively with -/_ stripped.
const PAGINATION = new Set(["page", "limit", "cursor", "offset", "perpage", "pagesize", "pagetoken", "maxresults", "after", "before"]);

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);

/** Does a 2xx JSON response carry an array (top-level or as a wrapped property)? */
function looksLikeCollection(op: Obj): boolean {
  const responses = obj(op.responses) ?? {};
  for (const code of Object.keys(responses)) {
    if (!/^2/.test(code)) continue;
    const schema = obj(
      obj(obj(obj(obj(responses[code])?.content)?.["application/json"])?.schema) ?? null
    );
    if (!schema) continue;
    if (schema.type === "array" || schema.items) return true;
    const props = obj(schema.properties);
    if (props && Object.values(props).some((p) => obj(p)?.type === "array")) return true;
  }
  return false;
}

/**
 * Validate + lint an OpenAPI document. `input` may be a JS object, a JSON
 * string, or a YAML string (the validator parses all three).
 */
export async function lintOpenapi(input: unknown): Promise<OpenapiLintResult> {
  const issues: OpenapiIssue[] = [];
  const validator = new Validator();
  let version: string | null = null;
  let doc: Obj | null = null;

  try {
    // Pre-parse strings ourselves (YAML 1.2 is a JSON superset): the validator
    // treats any newline-free string as a FILENAME and fs.readFile()s it —
    // which both rejects minified one-line JSON pastes with a misleading error
    // and turns pasted path-like strings into local file reads.
    const data: unknown = typeof input === "string" ? YAML.parse(input) : input;
    const res = await validator.validate(data as Parameters<Validator["validate"]>[0]);
    version = (validator.version as string | undefined) ?? null;
    // Rules run on the dereferenced doc when possible so $ref'd response
    // schemas still trigger the collection/pagination checks.
    if (res.valid) {
      try {
        doc = obj(validator.resolveRefs({}));
      } catch {
        doc = obj(validator.specification);
      }
    } else {
      doc = obj(validator.specification);
      const errors = Array.isArray(res.errors) ? res.errors : [];
      for (const e of errors.slice(0, 20)) {
        const err = obj(e) ?? {};
        issues.push({
          severity: "ERROR",
          path: typeof err.instancePath === "string" && err.instancePath ? err.instancePath : "/",
          message: typeof err.message === "string" ? err.message : "schema violation",
        });
      }
      if (errors.length === 0) {
        issues.push({ severity: "ERROR", path: "/", message: "Document does not match the OpenAPI schema." });
      }
    }
  } catch (e) {
    issues.push({
      severity: "ERROR",
      path: "/",
      message: e instanceof Error ? e.message : "Not a parseable OpenAPI document.",
    });
  }

  if (version && !version.startsWith("3.1")) {
    issues.push({ severity: "WARN", path: "/openapi", message: `Targets OpenAPI ${version} — prefer 3.1.` });
  }

  let operations = 0;
  const paths = obj(doc?.paths);
  if (paths) {
    for (const [p, rawItem] of Object.entries(paths)) {
      const pathItem = obj(rawItem);
      if (!pathItem) continue;
      for (const m of HTTP_METHODS) {
        const op = obj(pathItem[m]);
        if (!op) continue;
        operations += 1;
        const where = `${m.toUpperCase()} ${p}`;
        const responses = obj(op.responses) ?? {};
        const codes = Object.keys(responses);

        if (!codes.some((c) => /^2(\d\d|XX)$/i.test(c))) {
          issues.push({ severity: "ERROR", path: where, message: "No 2xx response — the operation can never succeed." });
        }
        if (!codes.some((c) => /^4(\d\d|XX)$/i.test(c))) {
          issues.push({
            severity: "ERROR",
            path: where,
            message: "No 4xx response — every operation can be called wrong (validation/auth); document the failure shape.",
          });
        }
        if (!codes.some((c) => /^5(\d\d|XX)$/i.test(c) || c === "default")) {
          issues.push({ severity: "WARN", path: where, message: "No 5xx (or default) response documented." });
        }
        if (!op.operationId) {
          issues.push({ severity: "WARN", path: where, message: "Missing operationId (client generators need it)." });
        }
        if (!op.summary && !op.description) {
          issues.push({ severity: "WARN", path: where, message: "No summary or description." });
        }

        if (m === "get" && looksLikeCollection(op)) {
          const params = [
            ...(Array.isArray(op.parameters) ? op.parameters : []),
            ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
          ];
          const names = params.map((x) =>
            String(obj(x)?.name ?? "")
              .toLowerCase()
              .replace(/[-_]/g, "")
          );
          if (!names.some((n) => PAGINATION.has(n))) {
            issues.push({
              severity: "WARN",
              path: where,
              message: "Unpaginated list — the response is a collection but there's no page/limit/cursor parameter.",
            });
          }
        }
      }
    }
  }
  if (operations === 0 && !issues.some((i) => i.severity === "ERROR")) {
    issues.push({ severity: "ERROR", path: "/paths", message: "No operations found." });
  }

  const errors = issues.filter((i) => i.severity === "ERROR").length;
  const warnings = issues.filter((i) => i.severity === "WARN").length;
  return { issues, summary: { errors, warnings, operations, version }, ok: errors === 0 };
}

/** Cheap detector: does this text look like an existing OpenAPI document? */
export function looksLikeOpenapiDoc(text: string): boolean {
  return /["']?openapi["']?\s*:/.test(text.slice(0, 2000));
}
