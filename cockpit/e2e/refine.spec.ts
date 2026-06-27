import { test, expect, type Page } from "@playwright/test";

// Route-mocked: exercises the universal refine through the refactored useAiTool
// (run → runStream, then refine → runStream over the current output). Uses the
// Prompt Optimizer (AiToolShell) as the host tool.
async function mockOptimize(page: Page, text: string) {
  await page.route("**/api/optimize", (r) => r.fulfill({ contentType: "text/plain", body: text }));
}

test.describe("universal refine", () => {
  test("refine replaces the draft on success and restores it on failure", async ({ page }) => {
    await mockOptimize(page, "ORIGINAL DRAFT");
    await page.goto("/tools/prompt-optimizer");
    await page.getByPlaceholder(/paste a rough prompt/i).fill("rough idea");
    await page.getByRole("button", { name: /^optimize$/i }).click();
    await expect(page.getByText("ORIGINAL DRAFT")).toBeVisible();

    // Refine succeeds → the current draft is replaced (no regenerate from input).
    await page.route("**/api/refine", (r) => r.fulfill({ contentType: "text/plain", body: "SHORTER DRAFT" }));
    await page.getByRole("button", { name: "Shorter", exact: true }).click();
    await expect(page.getByText("SHORTER DRAFT")).toBeVisible();
    await expect(page.getByText("ORIGINAL DRAFT")).toHaveCount(0);

    // Refine fails → the prior draft is restored, never lost.
    await page.unroute("**/api/refine");
    await page.route("**/api/refine", (r) =>
      r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Engine down" }) }),
    );
    await page.getByRole("button", { name: "Friendlier", exact: true }).click();
    await expect(page.getByText("SHORTER DRAFT")).toBeVisible();
  });
});
