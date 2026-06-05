// Shared template engine for the prompt library (variable templates) and
// brainstorming (technique modes). Pure functions — safe to import on client
// or server. This is the only place that knows variables are stored as JSON.

export type VarDef = {
  name: string;
  label?: string;
  type?: "text" | "textarea" | "select";
  options?: string[];
  default?: string;
  required?: boolean;
};

/** Parse a Template.variables JSON string into VarDef[] (safe fallback to []). */
export function parseVariables(json: string | null | undefined): VarDef[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as VarDef[]) : [];
  } catch {
    return [];
  }
}

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g;

/** Replace {{name}} placeholders in body with values (missing → empty string). */
export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(VAR_RE, (_match, name: string) => values[name] ?? "");
}

/** The distinct {{variable}} names referenced in a template body. */
export function templateVariableNames(body: string): string[] {
  const names = new Set<string>();
  for (const m of body.matchAll(VAR_RE)) names.add(m[1]);
  return [...names];
}

/** Names of required variables that have no value yet (for form validation). */
export function missingRequired(vars: VarDef[], values: Record<string, string>): string[] {
  return vars.filter((v) => v.required && !values[v.name]?.trim()).map((v) => v.name);
}

/**
 * Build a Template.variables JSON string when saving a custom template: use the
 * caller's advanced JSON if it's a valid array, otherwise derive [{name}] from
 * the {{placeholders}} in the body.
 */
export function buildVariablesJson(json: string | null | undefined, body: string): string {
  if (json && json.trim()) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      // fall through to derived
    }
  }
  return JSON.stringify(templateVariableNames(body).map((name) => ({ name })));
}
