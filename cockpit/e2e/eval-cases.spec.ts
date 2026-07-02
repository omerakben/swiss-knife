import { test, expect, type Page } from "@playwright/test";

// Model-independent: /api/eval-cases is fully route-mocked (generate needs
// Ollama + embeddings; accept writes the DB).

const fulfill = (body: unknown) => ({
  contentType: "application/json",
  body: JSON.stringify(body),
});

const CASES = [
  { dimension: "happy", title: "Valid certificate on file", artifact: "Sale with certificate EX-100 on file", expectedVerdict: "PASS", rationale: "Meets the spec.", duplicateOf: null },
  { dimension: "boundary", title: "Certificate expires today", artifact: "Certificate expiry == sale date", expectedVerdict: "PASS", rationale: "Edge of validity.", duplicateOf: null },
  { dimension: "adversarial", title: "Photocopied certificate", artifact: "Cashier accepts a photo of a certificate", expectedVerdict: "BLOCK", rationale: "Gaming the rule.", duplicateOf: null },
  { dimension: "ambiguous", title: "Out-of-state certificate", artifact: "Certificate issued in another state", expectedVerdict: "BLOCK", rationale: "Spec is silent.", duplicateOf: null },
  { dimension: "out-of-scope", title: "Online order", artifact: "Tax exemption on a web order", expectedVerdict: "BLOCK", rationale: "POS spec only.", duplicateOf: 2 },
];

const GOOD = {
  cases: CASES,
  lint: {
    issues: [],
    summary: {
      errors: 0,
      warnings: 0,
      total: 5,
      byDimension: { happy: 1, boundary: 1, adversarial: 1, ambiguous: 1, "out-of-scope": 1 },
    },
    ok: true,
  },
  dedupe: "done",
  ok: true,
};

async function mockApi(page: Page, generateResult: unknown) {
  await page.route("**/api/eval-cases", (route) => {
    const posted = route.request().postDataJSON() as { accept?: unknown };
    if (posted?.accept) return route.fulfill(fulfill({ savedId: "g1" }));
    return route.fulfill(fulfill(generateResult));
  });
}

test.describe("eval case generator", () => {
  test("page loads with input and generate button", async ({ page }) => {
    await page.goto("/tools/eval-cases");
    await expect(page.getByRole("heading", { name: /eval case generator/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^generate cases$/i })).toBeVisible();
  });

  test("a full-coverage set renders with dimensions, dup flag, and accepts", async ({ page }) => {
    await mockApi(page, GOOD);
    // The spec box placeholder is now a user-editable ToolHint
    // (eval-cases-spec); mock the GET so a locally-edited hint can't break
    // the selector below.
    await page.route("**/api/tool-hints", (route) =>
      route.fulfill({ contentType: "application/json", body: '{"hints":{}}' })
    );
    await page.goto("/tools/eval-cases");
    await page.getByPlaceholder(/paste the spec/i).fill("tax exemption requires a certificate");
    await page.getByRole("button", { name: /^generate cases$/i }).click();

    await expect(page.getByText("GATE PASS")).toBeVisible();
    await expect(page.getByText("Valid certificate on file")).toBeVisible();
    await expect(page.getByText("adversarial", { exact: true })).toBeVisible();
    await expect(page.getByText("≈ case 3")).toBeVisible();

    await page.getByRole("button", { name: /accept → golden/i }).first().click();
    await expect(page.getByRole("button", { name: /accepted ✓/i })).toBeVisible();
  });

  test("missing dimensions block the gate", async ({ page }) => {
    await mockApi(page, {
      ...GOOD,
      cases: CASES.slice(0, 2),
      lint: {
        issues: [{ severity: "ERROR", message: "No adversarial case — every dimension needs at least one." }],
        summary: { errors: 1, warnings: 0, total: 2, byDimension: { happy: 1, boundary: 1, adversarial: 0, ambiguous: 0, "out-of-scope": 0 } },
        ok: false,
      },
      ok: false,
    });
    await page.route("**/api/tool-hints", (route) =>
      route.fulfill({ contentType: "application/json", body: '{"hints":{}}' })
    );
    await page.goto("/tools/eval-cases");
    await page.getByPlaceholder(/paste the spec/i).fill("x");
    await page.getByRole("button", { name: /^generate cases$/i }).click();

    await expect(page.getByText("GATE BLOCK")).toBeVisible();
    await expect(page.getByText(/no adversarial case/i)).toBeVisible();
  });

  test("surfaces a clear error when the engine is down", async ({ page }) => {
    await page.route("**/api/eval-cases", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Ollama isn't running. Start the Ollama app (open -a Ollama) and try again.",
          reason: "ollama_down",
        }),
      })
    );
    await page.route("**/api/tool-hints", (route) =>
      route.fulfill({ contentType: "application/json", body: '{"hints":{}}' })
    );
    await page.goto("/tools/eval-cases");
    await page.getByPlaceholder(/paste the spec/i).fill("x");
    await page.getByRole("button", { name: /^generate cases$/i }).click();
    await expect(page.getByText(/ollama isn't running/i)).toBeVisible();
  });
});
