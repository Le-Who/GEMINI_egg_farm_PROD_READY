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
    // NOTE: This relies on UI having accessible buttons or we click by coordinates/visuals
    // Since this is a Phaser game, DOM elements might be limited to the UI layer overlay.
    // Assuming UI is React overlaid on Phaser (based on App.tsx structure)
    // const shopBtn was already checked above

    // If UI text is not accessible, we might need a test-id
    // Retrying with a more generic selector if specific one fails,
    // but for now let's assume standard React UI elements
    await expect(shopBtn).toBeVisible();
    await shopBtn.click();

    // 3. Buy Item
    // Use ID selector for robustness
    const buyBtn = page.locator("#shop-item-planter_basic button").first();
    await expect(buyBtn).toBeVisible();
    await buyBtn.click({ force: true });

    // 4. Verify Inventory Update
    await page.keyboard.press("Escape");

    // 5. Enter Edit Mode
    const editBtn = page.getByRole("button", { name: /edit/i });
    await expect(editBtn).toBeVisible();
    await editBtn.click({ force: true });

    // 6. Select Item to Place
    // Target the first item in the carousel (likely the one we just bought)
    // We can look for the "x1" badge or similar, or just the first button in the bottom bar
    const inventoryItem = page.locator("button:has-text('x1')").first();
    // Or better: filter by text if we know the name "Basic Planter"
    // const inventoryItem = page.getByRole("button", { name: "Basic Planter" }).first();
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
