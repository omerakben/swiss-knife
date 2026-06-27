import { test, expect, type Page } from "@playwright/test";

// Route-mocked (model-independent): the /api/starters endpoints are stubbed.
const fulfill = (body: unknown) => ({ contentType: "application/json", body: JSON.stringify(body) });

type StarterRow = { id: string; target: string; label: string; inputs: Record<string, string>; builtin: boolean; order: number };
const row = (id: string, label: string, inputs: Record<string, string>, builtin = true): StarterRow => ({
  id,
  target: "reply-to-message",
  label,
  inputs,
  builtin,
  order: 0,
});

/** One handler for the whole /api/starters family; the GET reflects a mutable list. */
async function mockStarters(page: Page, initial: StarterRow[], onChange: (next: StarterRow[]) => void) {
  let list = initial;
  await page.route("**/api/starters**", (route) => {
    const req = route.request();
    const method = req.method();
    const url = req.url();
    if (method === "GET") return route.fulfill(fulfill({ starters: list }));
    if (method === "POST" && url.endsWith("/reset")) {
      onChange((list = initial));
      return route.fulfill(fulfill({ ok: true, count: initial.length }));
    }
    if (method === "POST") {
      const created = row("s_new", "My starter", { message: "x", intent: "y" }, false);
      onChange((list = [...list, created]));
      return route.fulfill(fulfill({ starter: created }));
    }
    if (method === "PATCH") {
      const id = url.split("/").pop() ?? "";
      onChange((list = list.map((s) => (s.id === id ? { ...s, label: "Edited name" } : s))));
      return route.fulfill(fulfill({ ok: true, starter: list.find((s) => s.id === id) }));
    }
    if (method === "DELETE") {
      const id = url.split("/").pop() ?? "";
      onChange((list = list.filter((s) => s.id !== id)));
      return route.fulfill(fulfill({ ok: true }));
    }
    return route.fulfill(fulfill({ ok: true }));
  });
}

test.describe("starters", () => {
  test("runner shows starter chips, saves a new one, then deletes it", async ({ page }) => {
    await mockStarters(
      page,
      [row("s1", "School bake sale", { message: "m1", intent: "i1" }), row("s2", "Reschedule a call", { message: "m2", intent: "i2" })],
      () => {},
    );

    await page.goto("/tools/quick-actions?action=reply-to-message");
    await expect(page.getByRole("button", { name: "School bake sale", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reschedule a call", exact: true })).toBeVisible();

    // Fill the form so "Save current" appears, then save it as a starter.
    await page.getByPlaceholder("Paste it here…").fill("Can you cover Saturday?");
    await page.getByPlaceholder(/say yes/).fill("yes, ask what time");
    await page.getByRole("button", { name: /Save current/ }).click();
    await page.getByLabel("Name").fill("My starter");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "My starter", exact: true })).toBeVisible();

    // Manage → delete the new one.
    await page.getByRole("button", { name: "Manage" }).click();
    await page.getByRole("button", { name: "Delete My starter" }).click();
    await expect(page.getByRole("button", { name: "My starter", exact: true })).toHaveCount(0);
  });

  test("runner resets starters to defaults", async ({ page }) => {
    await mockStarters(page, [row("s1", "School bake sale", { message: "m1", intent: "i1" })], () => {});
    await page.goto("/tools/quick-actions?action=reply-to-message");
    await page.getByRole("button", { name: "Manage" }).click();
    await page.getByRole("button", { name: /Reset to defaults/ }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByRole("button", { name: "School bake sale", exact: true })).toBeVisible();
  });

  test("inbox starter fills the textarea", async ({ page }) => {
    await page.route("**/api/starters**", (route) =>
      route.fulfill(
        fulfill({
          starters: [
            { id: "i1", target: "inbox", label: "A list of to-dos", inputs: { text: "call the printer, send the quote" }, builtin: true, order: 0 },
          ],
        }),
      ),
    );
    await page.goto("/tools/inbox");
    const chip = page.getByRole("button", { name: "A list of to-dos", exact: true });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.getByPlaceholder(/Paste a note/)).toHaveValue(/call the printer/);
  });
});
