import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";
const isCI = Boolean(process.env.CI);

export default defineConfig({
  // Patterns based on the ECC `e2e-testing` skill.
  testDir: "./tests/e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "artifacts/junit.xml" }],
    ["json", { outputFile: "artifacts/results.json" }],
  ],

  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Enable cross-browser coverage after installing the browsers:
    //   npx playwright install firefox webkit
    // { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // { name: "webkit", use: { ...devices["Desktop Safari"] } },
    // { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  ],

  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 3100",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
