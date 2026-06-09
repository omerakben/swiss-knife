import { test, expect, type Page } from "@playwright/test";

// Model-independent: /api/rubric-designer is fully route-mocked (design needs
// Ollama; save writes the DB).

const fulfill = (body: unknown) => ({
  contentType: "application/json",
  body: JSON.stringify(body),
});

const SPEC = {
  title: "API error-response quality",
  artifactType: "REST error response",
  criteria: [
    { name: "Actionable message", weight: 40, guidance: "Says what failed and what to do." },
    { name: "Correct status code", weight: 30, guidance: "Status matches the failure class." },
    { name: "No internals leaked", weight: 30, guidance: "No stack traces or SQL." },
  ],
  bands: [
    { label: "Reject", min: 0, max: 59, verdict: "BLOCK" },
    { label: "Ship", min: 60, max: 100, verdict: "PASS" },
  ],
  passSample: '{"error":"Due date must be ISO-8601."}',
  blockSample: '{"error":"NullPointerException at line 412"}',
};

const GOOD_RESULT = {
  spec: SPEC,
  notes: [],
  lint: {
    issues: [],
    summary: { errors: 0, warnings: 0, weightTotal: 100, criteria: 3, bands: 2 },
    ok: true,
  },
  separation: {
    pass: { verdict: "PASS", score: 88 },
    block: { verdict: "BLOCK", score: 25 },
    ok: true,
  },
  body: "…rendered…{{artifact}}…",
  ok: true,
};

async function mockDesigner(page: Page, designResult: unknown) {
  await page.route("**/api/rubric-designer", (route) => {
    if (route.request().method() === "POST") {
      const posted = route.request().postDataJSON() as { save?: boolean };
      if (posted?.save) {
        return route.fulfill(
          fulfill({ savedId: "t1", slug: "qa-eval-rubric:global", name: SPEC.title })
        );
      }
      return route.fulfill(fulfill(designResult));
    }
    return route.fulfill(fulfill({ current: null }));
  });
}

test.describe("rubric designer", () => {
  test("page loads with input and design button", async ({ page }) => {
    await mockDesigner(page, GOOD_RESULT);
    await page.goto("/tools/rubric-designer");
    await expect(page.getByRole("heading", { name: /eval rubric designer/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^design rubric$/i })).toBeVisible();
  });

  test("a gated design renders criteria, bands, separation, and saves", async ({ page }) => {
    await mockDesigner(page, GOOD_RESULT);
    await page.goto("/tools/rubric-designer");
    await page.getByPlaceholder(/what artifact is being judged/i).fill("error responses must be actionable");
    await page.getByRole("button", { name: /^design rubric$/i }).click();

    await expect(page.getByText("GATE PASS")).toBeVisible();
    await expect(page.getByText("Actionable message")).toBeVisible();
    await expect(page.getByText("40 pts")).toBeVisible();
    await expect(page.getByText(/0–59 Reject → BLOCK/)).toBeVisible();
    await expect(page.getByText("separates", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /save as project rubric/i }).click();
    await expect(page.getByRole("button", { name: /^saved$/i })).toBeVisible();
  });

  test("a broken design is blocked and cannot be saved", async ({ page }) => {
    await mockDesigner(page, {
      ...GOOD_RESULT,
      lint: {
        issues: [{ severity: "ERROR", message: "Criterion weights sum to 90, not 100." }],
        summary: { errors: 1, warnings: 0, weightTotal: 90, criteria: 3, bands: 2 },
        ok: false,
      },
      separation: null,
      ok: false,
    });
    await page.goto("/tools/rubric-designer");
    await page.getByPlaceholder(/what artifact is being judged/i).fill("x");
    await page.getByRole("button", { name: /^design rubric$/i }).click();

    await expect(page.getByText("GATE BLOCK")).toBeVisible();
    await expect(page.getByText(/sum to 90, not 100/)).toBeVisible();
    await expect(page.getByRole("button", { name: /save as project rubric/i })).toBeDisabled();
  });

  test("surfaces a clear error when the engine is down", async ({ page }) => {
    await page.route("**/api/rubric-designer", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Ollama isn't running. Start the Ollama app (open -a Ollama) and try again.",
            reason: "ollama_down",
          }),
        });
      }
      return route.fulfill(fulfill({ current: null }));
    });
    await page.goto("/tools/rubric-designer");
    await page.getByPlaceholder(/what artifact is being judged/i).fill("x");
    await page.getByRole("button", { name: /^design rubric$/i }).click();
    await expect(page.getByText(/ollama isn't running/i)).toBeVisible();
  });
});
