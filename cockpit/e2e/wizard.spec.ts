import { test, expect, type Page } from "@playwright/test";

// Route-mocked (model-independent): /api/wizard is fulfilled with deterministic
// text naming a tool by its exact nav label so the answer + the "Open ___" chip
// (from suggestTools) render without the engine.
async function mockWizard(page: Page, text: string) {
  await page.route("**/api/wizard", (route) => route.fulfill({ contentType: "text/plain", body: text }));
}

async function openGuide(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open the Haven Desk guide" }).click();
  await expect(page.getByText("Hi! I can explain any tool and point you to it.")).toBeVisible();
}

test.describe("help wizard", () => {
  test("answers a starter and shows a tool chip that navigates", async ({ page }) => {
    await mockWizard(page, "Use **Meeting Notes** to turn rough notes into reviewed tasks.");
    await openGuide(page);

    await page.getByRole("button", { name: "How do I turn meeting notes into tasks?" }).click();

    await expect(page.getByText("to turn rough notes into reviewed tasks")).toBeVisible();
    const chip = page.getByRole("link", { name: "Open Meeting Notes" });
    await expect(chip).toHaveAttribute("href", "/tools/meeting-notes");

    await chip.click();
    await expect(page).toHaveURL(/\/tools\/meeting-notes$/);
    // Non-modal + globally mounted: the guide survives the navigation.
    await expect(page.getByText("Haven Desk guide")).toBeVisible();
  });

  test("the panel is non-modal — the page behind stays interactive", async ({ page }) => {
    await mockWizard(page, "The Quick Actions tool helps with everyday tasks.");
    await openGuide(page);

    // A background sidebar link is clickable while the panel is open (no overlay,
    // no focus trap). If the dialog were modal this click would be intercepted.
    // `exact` matches only the sidebar link, not the dashboard card (whose
    // accessible name also includes its description).
    await page.getByRole("link", { name: "Prompt Optimizer", exact: true }).click();
    await expect(page).toHaveURL(/\/tools\/prompt-optimizer$/);
  });
});
