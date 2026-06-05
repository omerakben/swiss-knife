import { prisma } from "@/lib/db";

// Defaults come from env (and ultimately the hard-coded fallbacks). The
// Settings row, when present, overrides these at runtime.
export const DEFAULTS = {
  model: process.env.OLLAMA_MODEL ?? "gemma4:e4b",
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  temperature: 0.4,
  // Image input needs a vision-capable model. The light default (e4b) is
  // text-only, so vision routes use this instead of the chat model.
  visionModel: process.env.OLLAMA_VISION_MODEL ?? "gemma4:12b-mlx",
};

export type EffectiveConfig = {
  model: string;
  baseUrl: string;
  temperature: number;
  visionModel: string;
};

/** Settings row over env over defaults. Safe before the table is migrated. */
export async function getEffectiveConfig(): Promise<EffectiveConfig> {
  let row: { model: string | null; baseUrl: string | null; temperature: number | null } | null =
    null;
  try {
    row = await prisma.settings.findUnique({ where: { id: "singleton" } });
  } catch {
    // Settings table may not exist yet; fall back to env/defaults.
  }
  return {
    model: row?.model ?? DEFAULTS.model,
    baseUrl: row?.baseUrl ?? DEFAULTS.baseUrl,
    temperature: row?.temperature ?? DEFAULTS.temperature,
    visionModel: DEFAULTS.visionModel,
  };
}
