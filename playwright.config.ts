import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3123);

/**
 * Browser tests run against a production build in fixture mode
 * (`npm run build` first). The five viewports are the P0 visual gate sizes.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
    reducedMotion: "reduce",
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: "1280x720", use: { viewport: { width: 1280, height: 720 } } },
    { name: "1366x768", use: { viewport: { width: 1366, height: 768 } } },
    { name: "1440x900", use: { viewport: { width: 1440, height: 900 } } },
    { name: "1920x1080", use: { viewport: { width: 1920, height: 1080 } } },
    {
      name: "390x844",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT} --hostname 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/api/bootstrap`,
    env: { CASEVEX_DATA_MODE: "fixture" },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
