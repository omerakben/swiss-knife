import { test, expect } from "@playwright/test";

// Bulk multi-select. Real-DB camp: rows are created through the UI with unique
// names and cleaned up by the bulk ops under test.

test.describe("bulk select — tasks", () => {
  test("select two tasks, move them to done, then bulk delete", async ({ page }) => {
    const a = `Bulk A ${Date.now()}`;
    const b = `Bulk B ${Date.now()}`;
    await page.goto("/tools/tasks");
    for (const t of [a, b]) {
      await page.getByPlaceholder(/add a task/i).fill(t);
      await page.getByRole("button", { name: /^add$/i }).click();
      await expect(page.getByText(t).first()).toBeVisible();
    }

    await page.getByRole("tab", { name: "List" }).click();
    await page.getByRole("checkbox", { name: `Select ${a}` }).check();
    await page.getByRole("checkbox", { name: `Select ${b}` }).check();
    await expect(page.getByText("2 selected")).toBeVisible();

    await page.getByRole("button", { name: "→ done" }).click();
    await expect(page.getByRole("checkbox", { name: `Mark ${a} done` })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: `Mark ${b} done` })).toBeChecked();

    // Bulk delete with the confirm gate.
    await page.getByRole("checkbox", { name: `Select ${a}` }).check();
    await page.getByRole("checkbox", { name: `Select ${b}` }).check();
    await page.getByRole("button", { name: /^delete 2$/i }).click();
    await page.getByRole("button", { name: /^delete$/i }).click(); // confirm dialog
    await expect(page.getByText(a)).toBeHidden();
    await expect(page.getByText(b)).toBeHidden();
  });
});

test.describe("bulk select — memory", () => {
  test("select two facts and move them to trash, then purge", async ({ page }) => {
    const a = `Bulk fact A ${Date.now()}`;
    const b = `Bulk fact B ${Date.now()}`;
    await page.goto("/tools/memory");
    for (const v of [a, b]) {
      await page.getByPlaceholder(/add a fact/i).fill(v);
      await page.getByRole("button", { name: /^add$/i }).click();
      await expect(page.getByText(v)).toBeVisible();
    }

    await page.getByRole("checkbox", { name: `Select fact: ${a.slice(0, 40)}` }).check();
    await page.getByRole("checkbox", { name: `Select fact: ${b.slice(0, 40)}` }).check();
    await expect(page.getByText("2 selected")).toBeVisible();
    await page.getByRole("button", { name: /move to trash/i }).click();
    await expect(page.getByText(/2 facts moved to trash/i)).toBeVisible();

    // The facts left the active list; purge them from the Trash for cleanup.
    await expect(page.getByRole("checkbox", { name: `Select fact: ${a.slice(0, 40)}` })).toBeHidden();
    await page.getByRole("button", { name: /^trash \(/i }).click();
    for (const v of [a, b]) {
      const row = page
        .locator("div")
        .filter({ hasText: v })
        .filter({ has: page.getByRole("button", { name: /delete forever/i }) })
        .last();
      await row.getByRole("button", { name: /delete forever/i }).click();
    }
  });
});
