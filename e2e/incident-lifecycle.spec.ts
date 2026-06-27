import { test, expect, Page } from "@playwright/test";
import { login, DEMO_CREDENTIALS } from "./helpers";

async function submitReport(page: Page) {
  await page.goto("/report", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="report-desc"]', { timeout: 15000 });
  await page.fill('[data-testid="report-desc"]', "Test incident from Playwright E2E test");
  await page.click('[data-testid="sev-High"]');
  await page.click('[data-testid="svc-Police"]');
  await page.click('[data-testid="submit-report"]');
}

test.describe("Full incident lifecycle", () => {
  test("citizen can submit a report without photo", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.citizen.email, DEMO_CREDENTIALS.citizen.password);
    await page.waitForURL(/\/home$/, { timeout: 20000 });

    await page.goto("/report", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="report-desc"]', { timeout: 15000 });
    await page.fill('[data-testid="report-desc"]', "E2E test: suspicious activity reported");
    await page.click('[data-testid="sev-Medium"]');
    await page.click('[data-testid="svc-Police"]');
    await page.click('[data-testid="submit-report"]');
  });

  test("citizen can see report in my reports after submitting", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.citizen.email, DEMO_CREDENTIALS.citizen.password);
    await page.waitForURL(/\/home$/, { timeout: 20000 });

    await page.goto("/report", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="report-desc"]', { timeout: 15000 });
    await page.fill('[data-testid="report-desc"]', "E2E test: checking my reports flow");
    await page.click('[data-testid="sev-Low"]');
    await page.click('[data-testid="svc-Ambulance"]');
    await page.click('[data-testid="submit-report"]');

    await page.goto("/my-reports", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="reports-list"]', { timeout: 15000 });
    await expect(page.locator("text=E2E test: checking my reports flow")).toBeVisible({ timeout: 15000 });
  });
});
