import { test, expect } from "@playwright/test";
import { login, DEMO_CREDENTIALS } from "./helpers";

test.describe("Citizen flows", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.citizen.email, DEMO_CREDENTIALS.citizen.password);
    await page.waitForURL(/\/home$/, { timeout: 20000 });
  });

  test("citizen home screen shows all elements", async ({ page }) => {
    await expect(page.locator('[data-testid="sos-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="bento-report"]')).toBeVisible();
    await expect(page.locator('[data-testid="bento-reports"]')).toBeVisible();
    await expect(page.locator('[data-testid="bento-tips"]')).toBeVisible();
    await expect(page.locator('[data-testid="logout-btn"]')).toBeVisible();
    await expect(page.locator("text=TRUST SCORE")).toBeVisible();
  });

  test("report incident page loads from bento", async ({ page }) => {
    await page.click('[data-testid="bento-report"]');
    await page.waitForURL(/\/report$/, { timeout: 15000 });
    await expect(page.locator("text=Report Incident")).toBeVisible();
    await expect(page.locator('[data-testid="pick-camera"]')).toBeVisible();
    await expect(page.locator('[data-testid="pick-gallery"]')).toBeVisible();
    await expect(page.locator('[data-testid="sev-Low"]')).toBeVisible();
    await expect(page.locator('[data-testid="sev-Medium"]')).toBeVisible();
    await expect(page.locator('[data-testid="sev-High"]')).toBeVisible();
    await expect(page.locator('[data-testid="svc-Ambulance"]')).toBeVisible();
    await expect(page.locator('[data-testid="svc-Fire"]')).toBeVisible();
    await expect(page.locator('[data-testid="svc-Police"]')).toBeVisible();
    await expect(page.locator('[data-testid="report-desc"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-report"]')).toBeVisible();
  });

  test("report page has back navigation", async ({ page }) => {
    await page.click('[data-testid="bento-report"]');
    await page.waitForURL(/\/report$/, { timeout: 15000 });
    await page.click('[data-testid="report-back"]');
    await page.waitForURL(/\/home$/, { timeout: 15000 });
  });

  test("severity and service selection works on report page", async ({ page }) => {
    await page.click('[data-testid="bento-report"]');
    await page.waitForURL(/\/report$/, { timeout: 15000 });

    await page.click('[data-testid="sev-High"]');
    await page.click('[data-testid="sev-Low"]');

    await page.click('[data-testid="svc-Police"]');
    await page.click('[data-testid="svc-Fire"]');
  });

  test("my reports page loads with empty state", async ({ page }) => {
    await page.click('[data-testid="bento-reports"]');
    await page.waitForURL(/\/my-reports$/, { timeout: 15000 });
    await expect(page.locator('[data-testid="reports-list"]')).toBeVisible();
  });

  test("my reports page has back navigation", async ({ page }) => {
    await page.click('[data-testid="bento-reports"]');
    await page.waitForURL(/\/my-reports$/, { timeout: 15000 });
    await page.click('[data-testid="back-btn"]');
    await page.waitForURL(/\/home$/, { timeout: 15000 });
  });

  test("safety tips shows alert", async ({ page }) => {
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Safety Tips");
      await dialog.accept();
    });
    await page.click('[data-testid="bento-tips"]');
  });

  test("sos button triggers alert", async ({ page }) => {
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("SOS Emergency");
      await dialog.accept();
    });
    await page.click('[data-testid="sos-button"]');
  });

  test("can navigate to report via SOS alert", async ({ page }) => {
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("SOS Emergency");
      await dialog.accept();
    });
    await page.click('[data-testid="sos-button"]');
    await page.waitForURL(/\/report$/, { timeout: 15000 });
    await expect(page.locator("text=SOS Alert")).toBeVisible();
  });
});
