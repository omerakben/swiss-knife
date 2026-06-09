import { describe, expect, it } from "vitest";

import { lintOpenapi, looksLikeOpenapiDoc } from "./openapiLint";

const GOOD = {
  openapi: "3.1.0",
  info: { title: "Things API", version: "1.0.0" },
  paths: {
    "/things/{id}": {
      get: {
        operationId: "getThing",
        summary: "Fetch one thing",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "ok", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "not found" },
          "500": { description: "server error" },
        },
      },
    },
  },
};

describe("lintOpenapi", () => {
  it("passes a complete 3.1 operation", async () => {
    const r = await lintOpenapi(GOOD);
    expect(r.ok).toBe(true);
    expect(r.summary.errors).toBe(0);
    expect(r.summary.operations).toBe(1);
    expect(r.summary.version).toContain("3.1");
  });

  it("accepts a YAML string", async () => {
    const yaml = `openapi: 3.1.0
info:
  title: T
  version: 1.0.0
paths:
  /ping:
    get:
      operationId: ping
      summary: Ping
      responses:
        "200":
          description: ok
        "400":
          description: bad
        "500":
          description: boom
`;
    const r = await lintOpenapi(yaml);
    expect(r.ok).toBe(true);
  });

  it("errors when an operation has no 4xx response", async () => {
    const doc = structuredClone(GOOD) as typeof GOOD;
    // @ts-expect-error test surgery
    delete doc.paths["/things/{id}"].get.responses["404"];
    const r = await lintOpenapi(doc);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.severity === "ERROR" && /No 4xx response/.test(i.message))).toBe(true);
  });

  it("errors when an operation has no 2xx response and warns on missing 5xx", async () => {
    const doc = structuredClone(GOOD) as typeof GOOD;
    // @ts-expect-error test surgery
    delete doc.paths["/things/{id}"].get.responses["200"];
    // @ts-expect-error test surgery
    delete doc.paths["/things/{id}"].get.responses["500"];
    const r = await lintOpenapi(doc);
    expect(r.issues.some((i) => i.severity === "ERROR" && /No 2xx/.test(i.message))).toBe(true);
    expect(r.issues.some((i) => i.severity === "WARN" && /No 5xx/.test(i.message))).toBe(true);
  });

  it("warns on an unpaginated collection GET", async () => {
    const doc = {
      ...GOOD,
      paths: {
        "/things": {
          get: {
            operationId: "listThings",
            summary: "List things",
            responses: {
              "200": {
                description: "ok",
                content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
              },
              "400": { description: "bad" },
              "500": { description: "boom" },
            },
          },
        },
      },
    };
    const r = await lintOpenapi(doc);
    expect(r.issues.some((i) => i.severity === "WARN" && /Unpaginated list/.test(i.message))).toBe(true);

    const paginated = structuredClone(doc);
    // @ts-expect-error test surgery
    paginated.paths["/things"].get.parameters = [
      { name: "limit", in: "query", schema: { type: "integer" } },
    ];
    const r2 = await lintOpenapi(paginated);
    expect(r2.issues.some((i) => /Unpaginated list/.test(i.message))).toBe(false);
  });

  it("warns when targeting 3.0 instead of 3.1", async () => {
    const doc = structuredClone(GOOD) as Record<string, unknown>;
    doc.openapi = "3.0.3";
    const r = await lintOpenapi(doc);
    expect(r.issues.some((i) => i.severity === "WARN" && /prefer 3\.1/.test(i.message))).toBe(true);
  });

  it("reports real schema violations from the validator", async () => {
    const r = await lintOpenapi({ openapi: "3.1.0", info: { title: "T" }, paths: {} });
    // info.version is required by the OpenAPI schema
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.severity === "ERROR")).toBe(true);
  });

  it("rejects garbage input without throwing", async () => {
    const r = await lintOpenapi("not: [valid: openapi");
    expect(r.ok).toBe(false);
  });
});

describe("looksLikeOpenapiDoc", () => {
  it("detects yaml/json contracts vs prose", () => {
    expect(looksLikeOpenapiDoc("openapi: 3.1.0\ninfo: {}")).toBe(true);
    expect(looksLikeOpenapiDoc('{"openapi": "3.1.0"}')).toBe(true);
    expect(looksLikeOpenapiDoc("I need an endpoint that lists invoices")).toBe(false);
  });
});
