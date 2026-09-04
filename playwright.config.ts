import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Database-backed owner tests share a local Supabase-compatible auth fixture.
  // Keep that fixture alive in one worker; ordinary no-database UI checks remain parallel.
  ...(process.env.TEST_DATABASE_URL ? { workers: 1 } : {}),
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } }
  ],
  webServer: {
    command: "corepack pnpm dev --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true",
    timeout: 120_000
  }
});
