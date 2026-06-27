import { test, expect } from "@playwright/test";
import { login, clearSession, DEMO_CREDENTIALS } from "./helpers";

test.describe("Auth flows", () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page);
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator("text=URBAN INTEL")).toBeVisible();
    await expect(page.locator("text=Emergency Response Platform")).toBeVisible();
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-citizen"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-admin"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-fire"]')).toBeVisible();
    await expect(page.locator('[data-testid="goto-register"]')).toBeVisible();
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.locator("text=Create account")).toBeVisible();
    await expect(page.locator('[data-testid="reg-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="reg-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="reg-phone"]')).toBeVisible();
    await expect(page.locator('[data-testid="reg-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="reg-submit"]')).toBeVisible();
    await expect(page.locator('[data-testid="role-citizen"]')).toBeVisible();
    await expect(page.locator('[data-testid="role-agency"]')).toBeVisible();
    await expect(page.locator('[data-testid="role-admin"]')).toBeVisible();
    await expect(page.locator('[data-testid="goto-login"]')).toBeVisible();
  });

  test("login as citizen redirects to citizen home", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.citizen.email, DEMO_CREDENTIALS.citizen.password);
    await page.waitForURL(/\/home$/, { timeout: 20000 });
    await expect(page.locator("text=Hello, Demo")).toBeVisible();
    await expect(page.locator('[data-testid="sos-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="bento-report"]')).toBeVisible();
    await expect(page.locator('[data-testid="bento-reports"]')).toBeVisible();
    await expect(page.locator('[data-testid="bento-tips"]')).toBeVisible();
  });

  test("login as admin redirects to agency dashboard", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.admin.email, DEMO_CREDENTIALS.admin.password);
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    await expect(page.locator("text=Dispatch Console")).toBeVisible();
    await expect(page.locator('[data-testid="db-btn"]')).toBeVisible();
  });

  test("login as fire dispatch redirects to agency dashboard", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.fire.email, DEMO_CREDENTIALS.fire.password);
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    await expect(page.locator("text=Dispatch Console")).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await login(page, "wrong@email.com", "wrongpass");
    await expect(page.locator("text=Login failed").or(page.locator("text=Invalid"))).toBeVisible({ timeout: 10000 });
  });

  test("can navigate from login to register", async ({ page }) => {
    await page.goto("/auth/login");
    await page.click('[data-testid="goto-register"]');
    await page.waitForURL(/\/register$/, { timeout: 15000 });
    await expect(page.locator("text=Create account")).toBeVisible();
  });

  test("can navigate from register to login", async ({ page }) => {
    await page.goto("/auth/register");
    await page.click('[data-testid="goto-login"]');
    await page.waitForURL(/\/login$/, { timeout: 15000 });
    await expect(page.locator("text=Sign in")).toBeVisible();
  });

  test("demo citizen button fills credentials", async ({ page }) => {
    await page.goto("/auth/login");
    await page.click('[data-testid="demo-citizen"]');
    await expect(page.locator('[data-testid="login-email"]')).toHaveValue("citizen@urbanintel.app");
    await expect(page.locator('[data-testid="login-password"]')).toHaveValue("Citizen@123");
  });

  test("demo admin button fills credentials", async ({ page }) => {
    await page.goto("/auth/login");
    await page.click('[data-testid="demo-admin"]');
    await expect(page.locator('[data-testid="login-email"]')).toHaveValue("admin@urbanintel.app");
    await expect(page.locator('[data-testid="login-password"]')).toHaveValue("Admin@123");
  });

  test("logout from citizen home works", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.citizen.email, DEMO_CREDENTIALS.citizen.password);
    await page.waitForURL(/\/home$/, { timeout: 20000 });
    await page.click('[data-testid="logout-btn"]');
    await page.waitForURL(/\/login$/, { timeout: 15000 });
  });

  test("logout from agency dashboard works", async ({ page }) => {
    await login(page, DEMO_CREDENTIALS.admin.email, DEMO_CREDENTIALS.admin.password);
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    await page.click('[data-testid="logout-btn"]');
    await page.waitForURL(/\/login$/, { timeout: 15000 });
  });
});
