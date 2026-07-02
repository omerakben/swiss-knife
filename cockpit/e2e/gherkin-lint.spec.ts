import { test, expect, type Page } from "@playwright/test";

const BAD = `Feature: POS sale

  Scenario: cash sale
    Given a cart
    When the cashier scans an item
    When the cashier tenders cash
    Then a receipt prints`;

// The formerly-hardcoded "Load example" button is now an editable StarterChips
// list (target=gherkin-lint); mock it so the chip label/text is deterministic
// regardless of the dev DB's starters (a locally-edited starter can't break this).
const GOOD = `Feature: Point of Sale — cash sale
  A walk-in customer buys in-stock items and pays cash.

  @valid @smoke @ui
  Scenario: a completed cash sale prints a receipt
    Given an open Cash Drawer [drawer]
    And a Cart [cart] holding one in-stock item
    When the cashier tenders the exact cash amount
    Then the sale is invoiced against [drawer]
    And a receipt prints for [cart]`;

async function mockGherkinStarters(page: Page) {
  await page.route("**/api/starters**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        starters: [
          { id: "g1", target: "gherkin-lint", label: "POS cash sale .feature", inputs: { text: GOOD }, builtin: true, order: 0 },
        ],
      }),
    }),
  );
}

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
    await mockGherkinStarters(page);
    await page.goto("/tools/gherkin-lint");
    await page.getByRole("button", { name: "POS cash sale .feature", exact: true }).click();
    await page.getByRole("button", { name: /^lint$/i }).click();
    await expect(page.getByText("PASS")).toBeVisible();
    await expect(page.getByText(/clean — no issues/i)).toBeVisible();
  });
});
