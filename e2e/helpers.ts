import { Page } from "@playwright/test";

export const DEMO_CREDENTIALS = {
  citizen: { email: "citizen@urbanintel.app", password: "Citizen@123" },
  admin: { email: "admin@urbanintel.app", password: "Admin@123" },
  fire: { email: "fire@urbanintel.app", password: "Fire@123" },
  medical: { email: "medical@urbanintel.app", password: "Medical@123" },
  police: { email: "police@urbanintel.app", password: "Police@123" },
};

export async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="login-email"]', { timeout: 20000 });
  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', password);
  await page.click('[data-testid="login-submit"]');
}

export async function clearSession(page: Page) {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded", timeout: 20000 });
  try {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } catch {
  }
  await page.context().clearCookies();
}
