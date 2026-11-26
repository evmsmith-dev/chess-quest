// End-to-end tests run against the built site in dist/ (npm run test:e2e builds it first).
// Set APP_DIR=. to run them against the unbuilt source instead.
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT || 4173);
const appDir = process.env.APP_DIR || "dist";
const phone = { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }; // Galaxy S26-sized
const tablet = { viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 2 }; // iPad Air, landscape
const smallPhone = { viewport: { width: 384, height: 832 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.8 }; // Galaxy A26-sized
// Safari's engine (WebKit) on an iPad, portrait. Its browser can't always be downloaded locally,
// so set WEBKIT=1 to include it (GitHub's test run does).
const webkit = process.env.WEBKIT === "1";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  use: {
    baseURL: `http://localhost:${port}/`,
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Desktop Chrome"], ...phone } },
    { name: "phone-landscape", use: { ...devices["Desktop Chrome"], ...phone, viewport: { width: 915, height: 412 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], ...tablet } },
    { name: "tablet-portrait", use: { ...devices["Desktop Chrome"], ...tablet, viewport: { width: 820, height: 1180 } } },
    { name: "small-phone", use: { ...devices["Desktop Chrome"], ...smallPhone } },
    { name: "small-phone-landscape", use: { ...devices["Desktop Chrome"], ...smallPhone, viewport: { width: 832, height: 384 } } },
    ...(webkit ? [{ name: "ipad-safari", use: { ...devices["iPad (gen 7)"], viewport: { width: 820, height: 1180 } } }] : []),
  ],
  webServer: {
    command: `node scripts/serve.mjs ${appDir} ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
