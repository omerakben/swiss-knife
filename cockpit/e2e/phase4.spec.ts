import { test, expect } from "@playwright/test";

test.describe("phase 4", () => {
  test("memory page shows add + suggest controls", async ({ page }) => {
    await page.goto("/tools/memory");
    await expect(page.getByRole("heading", { name: /memory/i })).toBeVisible();
    await expect(page.getByPlaceholder(/add a fact/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /suggest from text/i })).toBeVisible();
  });

  test("image page shows upload + ask controls", async ({ page }) => {
    await page.goto("/tools/image");
    await expect(page.getByRole("heading", { name: /image/i })).toBeVisible();
    // "Upload image" is a styled <label>, not a button role.
    await expect(page.getByText(/upload image/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^ask$/i })).toBeVisible();
  });

  test("sidebar links to memory and image", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Memory", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Image", exact: true })).toBeVisible();
  });
});
