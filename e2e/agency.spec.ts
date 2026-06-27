import { test, expect } from "@playwright/test";
import { login, DEMO_CREDENTIALS } from "./helpers";

test.describe("Agency / Dispatch flows", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.admin.email, DEMO_CREDENTIALS.admin.password);
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
  });

  test("dashboard shows console header and stats", async ({ page }) => {
    await expect(page.locator("text=Dispatch Console")).toBeVisible();
    await expect(page.locator('[data-testid="logout-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="db-btn"]')).toBeVisible();
  });

  test("dashboard shows incident filters", async ({ page }) => {
    await expect(page.locator('[data-testid="filter-All"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-New"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-Acknowledged"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-EnRoute"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-OnScene"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-Resolved"]')).toBeVisible();
  });

  test("filter chips are clickable", async ({ page }) => {
    await page.click('[data-testid="filter-New"]');
    await page.click('[data-testid="filter-All"]');
    await page.click('[data-testid="filter-Resolved"]');
  });

  test("incidents list is present", async ({ page }) => {
    await expect(page.locator('[data-testid="incidents-list"]')).toBeVisible({ timeout: 15000 });
  });

  test("dashboard auto-refreshes", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator('[data-testid="incidents-list"]')).toBeVisible();
  });

  test("can open incident detail modal", async ({ page }) => {
    const incidentCard = page.locator('[testID^="inc-"]').first();
    await expect(incidentCard).toBeVisible({ timeout: 15000 });
    await incidentCard.click();
    await expect(page.locator('[data-testid="modal-close"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Incident Detail")).toBeVisible();
    await expect(page.locator("text=REPORTER")).toBeVisible();
    await expect(page.locator("text=RESPONSE")).toBeVisible();
  });

  test("can close incident detail modal", async ({ page }) => {
    const incidentCard = page.locator('[testID^="inc-"]').first();
    await expect(incidentCard).toBeVisible({ timeout: 15000 });
    await incidentCard.click();
    await expect(page.locator('[data-testid="modal-close"]')).toBeVisible({ timeout: 10000 });
    await page.click('[data-testid="modal-close"]');
    await expect(page.locator("text=Incident Detail")).not.toBeVisible({ timeout: 10000 });
  });

  test("dashboard shows analytics breakdown", async ({ page }) => {
    await expect(page.locator("text=BY SEVERITY")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=BY SERVICE")).toBeVisible({ timeout: 15000 });
  });

  test("dashboard shows stat cards", async ({ page }) => {
    await expect(page.locator("text=Total")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Active")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Resolved")).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Agency role-based access", () => {
  test("fire dispatch sees filtered incidents", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.fire.email, DEMO_CREDENTIALS.fire.password);
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    await expect(page.locator('[data-testid="incidents-list"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="db-btn"]')).not.toBeVisible();
  });

  test("medical dispatch sees filtered incidents", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.medical.email, DEMO_CREDENTIALS.medical.password);
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    await expect(page.locator('[data-testid="incidents-list"]')).toBeVisible({ timeout: 15000 });
  });

  test("police dispatch sees filtered incidents", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.police.email, DEMO_CREDENTIALS.police.password);
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    await expect(page.locator('[data-testid="incidents-list"]')).toBeVisible({ timeout: 15000 });
  });
});
