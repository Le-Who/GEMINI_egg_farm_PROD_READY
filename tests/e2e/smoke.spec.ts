import { test, expect } from "@playwright/test";

test.describe("Smoke Test", () => {
  test("Homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Discord Garden/i);
    // basic canvas check
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
  });
});
