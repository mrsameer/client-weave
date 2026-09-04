export const puppeteerConfig = {
  baseUrl: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
  headless: process.env.CI === "true"
} as const;
