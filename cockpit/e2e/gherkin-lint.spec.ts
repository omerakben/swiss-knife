import { test, expect } from "@playwright/test";

const BAD = `Feature: POS sale

  Scenario: cash sale
    Given a cart
    When the cashier scans an item
    When the cashier tenders cash
    Then a receipt prints`;

test.describe("gherkin lint", () => {
  test("tool page loads", async ({ page }) => {
    await page.goto("/tools/gherkin-lint");
    await expect(page.getByRole("heading", { name: /gherkin lint/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^lint$/i })).toBeVisible();
  });

  test("flags a non-conformant feature (no tags, two events)", async ({ page }) => {
    await page.goto("/tools/gherkin-lint");
    await page.getByPlaceholder(/paste a .feature/i).fill(BAD);
    await page.getByRole("button", { name: /^lint$/i }).click();
    await expect(page.getByText("BLOCK")).toBeVisible();
    await expect(page.getByText(/exactly one event per scenario/i)).toBeVisible();
    await expect(page.getByText(/has no tags/i)).toBeVisible();
  });

  test("a conformant example passes", async ({ page }) => {
    await page.goto("/tools/gherkin-lint");
    await page.getByRole("button", { name: /load example/i }).click();
    await page.getByRole("button", { name: /^lint$/i }).click();
    await expect(page.getByText("PASS")).toBeVisible();
    await expect(page.getByText(/clean — no issues/i)).toBeVisible();
  });
});
