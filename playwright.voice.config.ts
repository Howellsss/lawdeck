import { defineConfig, devices } from "@playwright/test";

// Tests on test-only pages (tests/voice): the voice-mode conversation, with a pretend microphone
// and pretend answers and audio, and the drafting form. Pages under /test-pages exist only with
// LAWDECK_TEST_PAGES=1, never on the live site. Run `npm run build` first.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const PORT = 3120;

export default defineConfig({
  testDir: "tests/voice",
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath, args: ["--autoplay-policy=no-user-gesture-required"] },
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { LAWDECK_TEST_PAGES: "1" },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1200, height: 900 } } }],
});
