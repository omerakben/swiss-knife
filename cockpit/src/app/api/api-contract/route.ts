import YAML from "yaml";

import { assertOllamaReady } from "@/lib/health";
import { chatJson } from "@/lib/ollama";
import { getEffectiveConfig } from "@/lib/config";
import { lintOpenapi, looksLikeOpenapiDoc } from "@/lib/openapiLint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 40_000;

// Loose envelope: the top-level OpenAPI shape is pinned, paths/components stay
// free-form objects — the REAL validation is the deterministic gate
// (lib/openapiLint.ts with the official 3.1 meta-schema), not this schema.
const ENVELOPE = {
  type: "object",
  properties: {
    openapi: { type: "string" },
    info: {
      type: "object",
      properties: { title: { type: "string" }, version: { type: "string" } },
      required: ["title", "version"],
    },
    paths: { type: "object" },
    components: { type: "object" },
  },
  required: ["openapi", "info", "paths"],
};

const SYSTEM = `You design REST API contracts as OpenAPI 3.1 documents.

Hard requirements:
- "openapi" MUST be "3.1.0".
- Design ONLY what the prose asks for — one or a few operations, not a whole product.
- EVERY operation has: an operationId, a summary, a 2xx response with a JSON schema,
  at least one 4xx response, and a 5xx (or default) response.
- Error responses use a consistent JSON shape, e.g. {"error": "<human message>"} unless the
  prose specifies otherwise.
- List/collection endpoints MUST take pagination parameters (limit + cursor, or page).
- Put shared shapes in components/schemas and $ref them.
Use the user's domain vocabulary; do not invent fields they didn't imply.`;

export async function POST(req: Request) {
  const { input } = (await req.json().catch(() => ({}))) as { input?: string };
  if (!input || typeof input !== "string" || !input.trim()) {
    return Response.json(
      { error: "Describe the endpoint in prose — or paste an existing OpenAPI document to lint." },
      { status: 400 }
    );
  }
  if (input.length > MAX_CHARS) {
    return Response.json({ error: "That's too long — one contract at a time." }, { status: 413 });
  }

  // ── Existing contract → deterministic lint only (no model, works offline). ──
  if (looksLikeOpenapiDoc(input)) {
    const lint = await lintOpenapi(input);
    return Response.json({ mode: "linted", yamlText: input, lint, ok: lint.ok });
  }

  // ── Prose → design via the model, then the same deterministic gate. ──
  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  const cfg = await getEffectiveConfig();
  let doc: Record<string, unknown>;
  try {
    // chatJson = structured extraction: NO memory injection (perf rule).
    doc = await chatJson<Record<string, unknown>>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: input.trim() },
      ],
      ENVELOPE,
      { model: cfg.model, baseUrl: cfg.baseUrl, temperature: 0.2 }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Couldn't design the contract." },
      { status: 500 }
    );
  }

  const lint = await lintOpenapi(doc);
  const yamlText = YAML.stringify(doc);
  return Response.json({ mode: "designed", yamlText, lint, ok: lint.ok });
}
