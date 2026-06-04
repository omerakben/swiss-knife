import { test, expect } from "@playwright/test";

test.describe("tasks", () => {
  test("board shows columns and can add a task", async ({ page }) => {
    await page.goto("/tools/tasks");
    await expect(page.getByRole("heading", { name: /tasks/i })).toBeVisible();
    await expect(page.getByText("To do")).toBeVisible();
    await expect(page.getByText("Doing")).toBeVisible();
    await expect(page.getByText("Done", { exact: true })).toBeVisible();

    const title = `Smoke task ${Date.now()}`;
    const input = page.getByPlaceholder(/add a task/i);
    await input.fill(title);
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText(title)).toBeVisible();
  });

  test("list view is reachable", async ({ page }) => {
    await page.goto("/tools/tasks");
    await page.getByRole("tab", { name: /^list$/i }).click();
    await expect(page.getByRole("tab", { name: /^list$/i })).toBeVisible();
  });

  test("AI task buttons are present", async ({ page }) => {
    await page.goto("/tools/tasks");
    await expect(page.getByRole("button", { name: /generate from goal/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /daily summary/i })).toBeVisible();
  });
});
