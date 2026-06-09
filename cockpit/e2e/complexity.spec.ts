import { test, expect, type Page } from "@playwright/test";

// Model-independent: /api/complexity (chatJson) and /api/complexity-derivation
// (stream) are route-mocked.

const RESULT = {
  verdict: {
    timeBigO: "O(n^2)",
    spaceBigO: "O(1)",
    hotspots: [{ line: 3, note: "Inner loop re-scans the whole array per element." }],
  },
  scan: { functions: [], maxLoopDepth: 2, hasRecursion: false, hasSort: false, lines: 8 },
  warnings: [],
  ok: true,
};

async function mockApis(page: Page, result: unknown) {
  await page.route("**/api/complexity", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(result) })
  );
  await page.route("**/api/complexity-derivation", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: "The outer loop contributes a factor of n; the inner loop another n.",
    })
  );
}

test.describe("complexity analyzer", () => {
  test("page loads with input and analyze button", async ({ page }) => {
    await page.goto("/tools/complexity");
    await expect(page.getByRole("heading", { name: /complexity analyzer/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^analyze$/i })).toBeVisible();
  });

  test("renders verdict, scan facts, hotspots, and streams the derivation", async ({ page }) => {
    await mockApis(page, RESULT);
    await page.goto("/tools/complexity");
    await page.getByPlaceholder(/paste a function/i).fill("for (a) { for (b) { use(a, b); } }");
    await page.getByRole("button", { name: /^analyze$/i }).click();

    await expect(page.getByText("time O(n^2)")).toBeVisible();
    await expect(page.getByText("space O(1)")).toBeVisible();
    await expect(page.getByText("scan-consistent")).toBeVisible();
    await expect(page.getByText(/inner loop re-scans/i)).toBeVisible();
    await expect(page.getByText(/outer loop contributes a factor/i)).toBeVisible();
  });

  test("flags a questionable claim", async ({ page }) => {
    await mockApis(page, {
      ...RESULT,
      scan: { ...RESULT.scan, maxLoopDepth: 0 },
      warnings: [
        {
          severity: "WARN",
          message: "Claimed O(n^2), but the static scan found no loops, no recursion, and no sort calls.",
        },
      ],
      ok: false,
    });
    await page.goto("/tools/complexity");
    await page.getByPlaceholder(/paste a function/i).fill("const x = a + b;");
    await page.getByRole("button", { name: /^analyze$/i }).click();

    await expect(page.getByText("questionable claim")).toBeVisible();
    await expect(page.getByText(/no loops, no recursion/i)).toBeVisible();
  });

  test("surfaces a clear error when the engine is down", async ({ page }) => {
    await page.route("**/api/complexity", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Ollama isn't running. Start the Ollama app (open -a Ollama) and try again.",
          reason: "ollama_down",
        }),
      })
    );
    await page.goto("/tools/complexity");
    await page.getByPlaceholder(/paste a function/i).fill("x");
    await page.getByRole("button", { name: /^analyze$/i }).click();
    await expect(page.getByText(/ollama isn't running/i)).toBeVisible();
  });
});
