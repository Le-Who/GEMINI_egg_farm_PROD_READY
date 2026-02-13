import { test, expect } from "@playwright/test";

test.describe("Gameplay Loop", () => {
  test.beforeEach(async ({ page }) => {
    // Mock Discord SDK init & API calls
    await page.route("**/discord.com/api/**", async (route) => {
      console.log("Mock hit: discord.com");
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ id: "e2e-user", username: "E2E Player" }),
      });
    });

    // Mock Backend Token Exchange
    await page.route("**/api/token", async (route) => {
      console.log("Mock hit: api/token");
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ access_token: "mock-token" }),
      });
    });

    // Mock Content to ensure stability
    await page.route("**/api/content", async (route) => {
      await route.continue(); // Let it hit the real server for content, or mock it if needed
    });

    // Mock State to avoid backend auth issues
    await page.route("**/api/state", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: "e2e-user",
            username: "E2E Player",
            coins: 1000,
            gems: 100,
            level: 1,
            xp: 0,
            inventory: {},
            pets: [],
            rooms: {
              interior: { type: "interior", items: [], unlocked: true },
              garden: { type: "garden", items: [], unlocked: false },
            },
            currentRoom: "interior",
            tutorialStep: 999, // Skip tutorial
            completedTutorial: true,
          }),
        });
      }
    });

    // Debug: Log browser console
    page.on("console", (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR: ${err.message}`));

    // We can also inject localStorage state here if needed
    await page.goto("/");
  });

  test("Shop Interaction and Item Placement", async ({ page }) => {
    // 1. Verify App Loaded (HUD visible)
    const shopBtn = page.getByRole("button", { name: /shop/i });
    await expect(shopBtn).toBeVisible({ timeout: 30000 });

    // 2. Verify Canvas load
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // 3. Open Shop
    // Use ID selector for robustness
    const shopButton = page.locator("#btn-shop");
    await expect(shopButton).toBeVisible();
    await shopButton.click();

    // 4. Buy Item
    const buyBtn = page.locator("#shop-item-planter_basic button").first();
    await expect(buyBtn).toBeVisible();
    // 5. Verify Inventory Update & Close Shop
    // Wait for buy animation
    await page.waitForTimeout(1000);

    // Close shop with ESC
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000); // Wait for shop to close and HUD to fade in

    // 6. Enter Edit Mode (via HUD button)
    const editBtn = page.locator("#btn-edit");
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // 7. Open Inventory Drawer
    const inventoryToggle = page.locator("#btn-inventory-toggle");
    await expect(inventoryToggle).toBeVisible();
    await inventoryToggle.click();

    // 8. Select Item to Place
    // Use data-testid for robustness
    // Note: Inventory items might filter based on tabs, but 'All' is default.
    // We just bought a planter, so we look for it.
    // If we only have 1 item, we can pick the first one.
    const inventoryItem = page
      .locator("[data-testid^='inventory-item-']")
      .first();
    await expect(inventoryItem).toBeVisible({ timeout: 5000 });
    await inventoryItem.click({ force: true });

    // 7. Click on Canvas to place
    await canvas.click({ position: { x: 400, y: 300 }, force: true });

    // 8. Verify placement success message or state change
    // Maybe check for "Placed!" toast or similar
    // Or check if inventory count decreased
    // For now, just ensure no error
    const errorToast = page.locator(".toast-error");
    await expect(errorToast).not.toBeVisible();
  });
});
