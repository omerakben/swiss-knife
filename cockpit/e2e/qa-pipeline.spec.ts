import { test, expect } from "@playwright/test";

// Mocked pipeline response (model-independent): a lint-clean run.
const OK_RESPONSE = {
  projectId: "p1",
  draftFeature: `Feature: Point of Sale — tax-exempt cash sale

  @valid @smoke @ui
  Scenario: a tax-exempt cash sale is invoiced correctly
    Given an open Cash Drawer [drawer]
    When the cashier completes the sale as tax-exempt
    Then the sale is invoiced against [drawer] with no tax`,
  lint: {
    issues: [],
    summary: { errors: 0, warnings: 0, scenarios: 1 },
    ok: true,
  },
  rubric: {
    raw: "Gate dimensions failing: none\nDomain risk level: Low\nVerdict: PASS",
    verdict: "PASS",
  },
  savedRunId: "run_1",
};

// A blocked run: lint finds an error, rubric blocks.
const BLOCKED_RESPONSE = {
  projectId: "p1",
  draftFeature: `Feature: POS sale

  Scenario: cash sale
    When the cashier scans an item
    When the cashier tenders cash
    Then a receipt prints`,
  lint: {
    issues: [
      { severity: "ERROR", line: 4, message: "Scenario 'cash sale' has no tags." },
      { severity: "ERROR", line: 4, message: "exactly one event per scenario." },
    ],
    summary: { errors: 2, warnings: 0, scenarios: 1 },
    ok: false,
  },
  rubric: {
    raw: "Gate dimensions failing: A\nDomain risk level: High\nVerdict: BLOCK",
    verdict: "BLOCK",
  },
  savedRunId: "run_2",
};

test.describe("qa pipeline", () => {
  test("tool page loads with input + Run", async ({ page }) => {
    await page.goto("/tools/qa-pipeline");
    await expect(page.getByRole("heading", { name: /qa pipeline/i })).toBeVisible();
    await expect(page.getByPlaceholder(/paste a user story/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^run$/i })).toBeVisible();
  });

  test("renders the three result cards; lint badge shows PASS when ok", async ({ page }) => {
    await page.route("**/api/qa-pipeline", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(OK_RESPONSE) })
    );
    await page.goto("/tools/qa-pipeline");
    await page.getByPlaceholder(/paste a user story/i).fill("a tax-exempt cash sale");
    await page.getByRole("button", { name: /^run$/i }).click();

    // Three cards (titles are shadcn CardTitle divs, matched by exact text).
    await expect(page.getByText("Drafted .feature", { exact: true })).toBeVisible();
    await expect(page.getByText("Lint", { exact: true })).toBeVisible();
    await expect(page.getByText("Rubric score", { exact: true })).toBeVisible();

    // Draft content + lint PASS badge + rubric PASS verdict.
    await expect(page.getByText(/tax-exempt cash sale is invoiced/i)).toBeVisible();
    await expect(page.getByText("PASS").first()).toBeVisible();
  });

  test("lint badge shows BLOCK when not ok", async ({ page }) => {
    await page.route("**/api/qa-pipeline", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(BLOCKED_RESPONSE) })
    );
    await page.goto("/tools/qa-pipeline");
    await page.getByPlaceholder(/paste a user story/i).fill("an under-specified sale");
    await page.getByRole("button", { name: /^run$/i }).click();

    await expect(page.getByText("Lint", { exact: true })).toBeVisible();
    await expect(page.getByText("BLOCK").first()).toBeVisible();
    await expect(page.getByText(/exactly one event per scenario/i)).toBeVisible();
  });

  test("shows the empty state when the project has no QA pack", async ({ page }) => {
    await page.route("**/api/qa-pipeline", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ projectId: null, needsPack: true }),
      })
    );
    await page.goto("/tools/qa-pipeline");
    await page.getByPlaceholder(/paste a user story/i).fill("any story");
    await page.getByRole("button", { name: /^run$/i }).click();

    await expect(page.getByText(/no QA pack/i)).toBeVisible();
    await expect(page.getByText(/npm run seed:lbmh/i)).toBeVisible();
  });

  test("sidebar links to QA Pipeline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "QA Pipeline", exact: true })).toBeVisible();
  });
});
