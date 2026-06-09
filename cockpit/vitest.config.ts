import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the deterministic "hard constraint" libs (the safety net the
// whole memory/QA design leans on). Scoped to src/**/*.test.ts so it never
// collides with the Playwright e2e specs in ./e2e (*.spec.ts). The @/ alias is
// resolved here directly to avoid an extra tsconfig-paths plugin dependency.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
