import { test, expect } from "@playwright/test";

// Route-mocked: /api/starters?target=image returns a preset; tapping the chip
// fills the question box. (The StarterChips component itself is covered by
// starters.spec; this asserts the Image-tool wiring.)
const fulfill = (body: unknown) => ({ contentType: "application/json", body: JSON.stringify(body) });

test.describe("image question starters", () => {
  test("a preset chip fills the question box", async ({ page }) => {
    await page.route("**/api/starters**", (route) =>
      route.fulfill(
        fulfill({
          starters: [
            { id: "im1", target: "image", label: "Read the text", inputs: { text: "Read all the text in this image." }, builtin: true, order: 0 },
          ],
        }),
      ),
    );
    await page.goto("/tools/image");

    const chip = page.getByRole("button", { name: "Read the text", exact: true });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.getByPlaceholder(/What do you want to know about this image/)).toHaveValue(/Read all the text/);
  });
});
