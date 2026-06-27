import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

const ROOT = __dirname;
const FRONTEND_PORT = 8081;
const BACKEND_PORT = 8001;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `.venv\\Scripts\\python.exe -m uvicorn server:app --host 0.0.0.0 --port ${BACKEND_PORT}`,
      port: BACKEND_PORT,
      reuseExistingServer: true,
      timeout: 60000,
      cwd: path.join(ROOT, "backend"),
    },
    {
      command: `yarn web --port ${FRONTEND_PORT}`,
      port: FRONTEND_PORT,
      reuseExistingServer: true,
      timeout: 120000,
      cwd: path.join(ROOT, "frontend"),
    },
  ],
});
