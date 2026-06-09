import { test, expect } from "@playwright/test";

// Model-independent: /api/code-review (Ollama) is route-mocked; /api/code-smells
// is deterministic and runs for real, so these tests exercise the actual scanner.

const SMELLY = `function process(a, b, c, d, e, f, g) {
  setTimeout(cb, 5000);
  return a;
}`;

const CLEAN = `function add(a, b) {
  return a + b;
}`;

test.describe("code review", () => {
  test("page loads with input and review button", async ({ page }) => {
    await page.goto("/tools/code-review");
    await expect(page.getByRole("heading", { name: /code review/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^review$/i })).toBeVisible();
  });

  test("smelly code is blocked by the scan and the explanation streams", async ({ page }) => {
    await page.route("**/api/code-review", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "The 7-parameter signature should become an options object.",
      })
    );
    await page.goto("/tools/code-review");
    await page.getByPlaceholder(/paste ts\/js code/i).fill(SMELLY);
    await page.getByRole("button", { name: /^review$/i }).click();

    await expect(page.getByText("GATE BLOCK")).toBeVisible();
    await expect(page.getByText(/takes 7 parameters/i)).toBeVisible();
    await expect(page.getByText(/magic number 5000/i)).toBeVisible();
    await expect(page.getByText(/options object/i).last()).toBeVisible();
  });

  test("clean code passes without calling the model", async ({ page }) => {
    let modelCalled = false;
    await page.route("**/api/code-review", (route) => {
      modelCalled = true;
      return route.fulfill({ status: 200, contentType: "text/plain", body: "should not appear" });
    });
    await page.goto("/tools/code-review");
    await page.getByPlaceholder(/paste ts\/js code/i).fill(CLEAN);
    await page.getByRole("button", { name: /^review$/i }).click();

    await expect(page.getByText("GATE PASS")).toBeVisible();
    await expect(page.getByText(/clean — no smells found/i)).toBeVisible();
    expect(modelCalled).toBe(false);
  });

  test("scan results survive an engine-down explanation", async ({ page }) => {
    await page.route("**/api/code-review", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Ollama isn't running. Start it (run `ollama serve`) and try again.",
          reason: "ollama_down",
        }),
      })
    );
    await page.goto("/tools/code-review");
    await page.getByPlaceholder(/paste ts\/js code/i).fill(SMELLY);
    await page.getByRole("button", { name: /^review$/i }).click();

    // Deterministic findings still render; the model failure is a note, not a wipe.
    await expect(page.getByText("GATE BLOCK")).toBeVisible();
    await expect(page.getByText(/takes 7 parameters/i)).toBeVisible();
    await expect(page.getByText(/ollama isn't running/i)).toBeVisible();
  });
});
