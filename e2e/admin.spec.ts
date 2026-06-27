import { test, expect } from "@playwright/test";
import { login, DEMO_CREDENTIALS } from "./helpers";

test.describe("Admin-only features", () => {
  test("admin can access db-admin page", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.admin.email, DEMO_CREDENTIALS.admin.password);
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    await page.click('[data-testid="db-btn"]');
    await page.waitForURL(/\/db-admin$/, { timeout: 15000 });
    await expect(page.locator("text=Database Overview")).toBeVisible();
    await expect(page.locator('[data-testid="docs-banner"]')).toBeVisible();
    await expect(page.locator("text=users").or(page.locator("text=incidents"))).toBeVisible({ timeout: 15000 });
  });

  test("admin db page has back navigation", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.admin.email, DEMO_CREDENTIALS.admin.password);
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    await page.click('[data-testid="db-btn"]');
    await page.waitForURL(/\/db-admin$/, { timeout: 15000 });
    await page.click('[data-testid="back-btn"]');
    await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
  });

  test("non-admin cannot see db-admin button", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.fire.email, DEMO_CREDENTIALS.fire.password);
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    await expect(page.locator('[data-testid="db-btn"]')).not.toBeVisible();
  });
});
