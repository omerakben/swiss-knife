import { test, expect } from "@playwright/test";

// Lint mode is fully deterministic (the real 3.1 validator, no Ollama), so the
// paste-a-contract tests hit the REAL route. Only the prose→design path (model)
// is mocked.

const BAD_CONTRACT = `openapi: 3.1.0
info:
  title: Invoices
  version: 1.0.0
paths:
  /invoices:
    get:
      summary: List invoices
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
`;

test.describe("api contract designer", () => {
  test("page loads with input and run button", async ({ page }) => {
    await page.goto("/tools/api-contract");
    await expect(page.getByRole("heading", { name: /api contract designer/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /design \/ lint contract/i })).toBeVisible();
  });

  test("pasting a flawed contract lints it for real and blocks the gate", async ({ page }) => {
    // The prose/paste box placeholder is now a user-editable ToolHint
    // (api-contract); mock the GET so a locally-edited hint can't break the
    // selector below.
    await page.route("**/api/tool-hints", (route) =>
      route.fulfill({ contentType: "application/json", body: '{"hints":{}}' })
    );
    await page.goto("/tools/api-contract");
    await page.getByPlaceholder(/describe|openapi/i).fill(BAD_CONTRACT);
    await page.getByRole("button", { name: /design \/ lint contract/i }).click();

    await expect(page.getByText("GATE BLOCK")).toBeVisible();
    await expect(page.getByText("linted", { exact: true })).toBeVisible();
    await expect(page.getByText(/no 4xx response/i)).toBeVisible();
    await expect(page.getByText(/unpaginated list/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /export \.yaml/i })).toBeVisible();
  });

  test("prose designs a contract via the model (mocked)", async ({ page }) => {
    await page.route("**/api/api-contract", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          mode: "designed",
          yamlText: "openapi: 3.1.0\ninfo:\n  title: Invoices\n  version: 1.0.0\n",
          lint: {
            issues: [],
            summary: { errors: 0, warnings: 0, operations: 2, version: "3.1" },
            ok: true,
          },
          ok: true,
        }),
      })
    );
    await page.route("**/api/tool-hints", (route) =>
      route.fulfill({ contentType: "application/json", body: '{"hints":{}}' })
    );
    await page.goto("/tools/api-contract");
    await page.getByPlaceholder(/describe|openapi/i).fill("an endpoint to list invoices");
    await page.getByRole("button", { name: /design \/ lint contract/i }).click();

    await expect(page.getByText("GATE PASS")).toBeVisible();
    await expect(page.getByText("designed", { exact: true })).toBeVisible();
    await expect(page.getByText(/2 operations/i)).toBeVisible();
  });

  test("surfaces a clear error when the engine is down", async ({ page }) => {
    await page.route("**/api/api-contract", (route) =>
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
    await page.goto("/tools/api-contract");
    await page.getByPlaceholder(/describe|openapi/i).fill("an endpoint for things");
    await page.getByRole("button", { name: /design \/ lint contract/i }).click();
    await expect(page.getByText(/ollama isn't running/i)).toBeVisible();
  });
});
