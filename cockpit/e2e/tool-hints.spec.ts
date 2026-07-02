import { test, expect, type Page } from "@playwright/test";

// Route-mocked (model-independent): /api/tool-hints is fully stubbed so the
// suite never depends on the dev DB's saved hint overrides. GET returns the
// overrides map; PUT is captured (not persisted) so a save/reset can be
// asserted without touching the DB. Exercised on the Email Writer's
// "email-brief" hint — any usePlaceholder-wired field would do; this one is
// the smallest page with a single hinted field.
const EMAIL_BRIEF_DEFAULT =
  "e.g. Ask for a 2-day extension on the report, apologize for the delay, propose Thursday.";

type PutBody = { key: string; text: string };

async function mockToolHints(page: Page, hints: Record<string, string>, onPut?: (body: PutBody) => void) {
  await page.route("**/api/tool-hints", (route) => {
    const req = route.request();
    if (req.method() === "PUT") {
      const body = req.postDataJSON() as PutBody;
      onPut?.(body);
      const text = body.text.trim() ? body.text : EMAIL_BRIEF_DEFAULT;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ key: body.key, text, ...(body.text.trim() ? {} : { reset: true }) }),
      });
    }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ hints }) });
  });
}

test.describe("tool hints", () => {
  test("a saved override renders as the box's placeholder", async ({ page }) => {
    await mockToolHints(page, { "email-brief": "CUSTOM HINT" });
    await page.goto("/tools/email-writer");
    await expect(page.getByPlaceholder("CUSTOM HINT")).toBeVisible();
  });

  test("the pencil dialog saves a new hint and closes", async ({ page }) => {
    const puts: PutBody[] = [];
    await mockToolHints(page, {}, (b) => puts.push(b));
    await page.goto("/tools/email-writer");
    // Wait for the bulk GET to resolve so the dialog's prefill reflects it.
    await expect(page.getByPlaceholder(EMAIL_BRIEF_DEFAULT)).toBeVisible();

    await page.getByRole("button", { name: "Edit hint: Brief" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Edit hint")).toBeVisible();
    await expect(dialog.getByLabel("Hint text")).toHaveValue(EMAIL_BRIEF_DEFAULT);

    await dialog.getByLabel("Hint text").fill("Ask about renewing the printer maintenance contract.");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();

    await expect(dialog).toBeHidden();
    expect(puts).toEqual([{ key: "email-brief", text: "Ask about renewing the printer maintenance contract." }]);
  });

  test("Reset to default sends empty text", async ({ page }) => {
    const puts: PutBody[] = [];
    await mockToolHints(page, { "email-brief": "CUSTOM HINT" }, (b) => puts.push(b));
    await page.goto("/tools/email-writer");
    await expect(page.getByPlaceholder("CUSTOM HINT")).toBeVisible();

    await page.getByRole("button", { name: "Edit hint: Brief" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Hint text")).toHaveValue("CUSTOM HINT");

    await dialog.getByRole("button", { name: "Reset to default" }).click();

    await expect(dialog).toBeHidden();
    expect(puts).toEqual([{ key: "email-brief", text: "" }]);
  });
});
