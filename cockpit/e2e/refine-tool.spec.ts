import { test, expect, type Page } from "@playwright/test";

// Route-mocked (model-independent): /api/refine/chat streams plain text. We use
// distinct bodies per phase so we can assert the lens switch actually re-ran.
async function mockChat(page: Page, body: string) {
  await page.unroute("**/api/refine/chat").catch(() => {});
  await page.route("**/api/refine/chat", (r) => r.fulfill({ contentType: "text/plain", body }));
}

test.describe("Refine (idea-discussion)", () => {
  test("start an idea, switch lens with one click, then save the answer as a note", async ({ page }) => {
    await mockChat(page, "1. Who is the newsletter for?\n2. How often will it go out?");
    await page.goto("/tools/refine");

    // Interview is the default lens; sharing an idea runs it.
    await page.getByLabel("Your idea").fill("A weekly newsletter for my bakery");
    await page.getByRole("button", { name: /^start$/i }).click();
    await expect(page.getByText("Who is the newsletter for?")).toBeVisible();

    // One click on another lens sends a lens turn over the discussion so far.
    await mockChat(page, "**What's strong** The audience is concrete.");
    await page.getByRole("button", { name: "Critique", exact: true }).click();
    await expect(page.getByText("Critique the idea as it stands now.")).toBeVisible();
    await expect(page.getByText("The audience is concrete.")).toBeVisible();

    // The latest answer can be saved as a note verbatim (no model re-run).
    await page.route("**/api/ideas", (r) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify({ idea: { id: "x" } }) }),
    );
    await page.getByRole("button", { name: "Save as note" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  });

  test("a fresh idea clears the discussion", async ({ page }) => {
    await mockChat(page, "1. What's the goal?");
    await page.goto("/tools/refine");
    await page.getByLabel("Your idea").fill("An app that reminds me to call my parents");
    await page.getByRole("button", { name: /^start$/i }).click();
    await expect(page.getByText("What's the goal?")).toBeVisible();

    await page.getByRole("button", { name: /new idea/i }).click();
    await expect(page.getByText("What's the goal?")).toHaveCount(0);
    await expect(page.getByText(/Not sure where to start/i)).toBeVisible();
  });
});
