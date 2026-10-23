import { defineConfig, devices } from "@playwright/test";

// The export test (step 5h, PRD EX-01 and EX-02): every template's Word file opens in LibreOffice
// with the same pages as the on-screen pages, and "Save as PDF" prints exactly those pages.
// Needs LibreOffice (soffice), pdfinfo and the Liberation fonts (metric-compatible with Times New
// Roman). Run `npm run build` first. The test-only pages exist only with LAWDECK_TEST_PAGES=1.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const PORT = 3110;

export default defineConfig({
  testDir: "tests/export",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath },
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { LAWDECK_TEST_PAGES: "1" },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
});
