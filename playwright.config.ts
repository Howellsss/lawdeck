import { defineConfig, devices } from "@playwright/test";

// Browser tests of the main journeys (tests/e2e). Run `npm run build` first.
// Set PLAYWRIGHT_CHROMIUM_PATH to use an already-installed Chromium.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath },
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Tests run as if Supabase is not set up, so no real accounts are touched.
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 780 }, isMobile: false } },
  ],
});
