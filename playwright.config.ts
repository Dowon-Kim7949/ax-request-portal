import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

/**
 * Every user flow must work on a phone, a tablet and a desktop,
 * so each spec runs once per viewport. layout.spec.ts sets its own edge
 * viewports (320 px phone, landscape tablet) and runs in Chromium only.
 */
const WIDTH_ONLY = /layout\.spec\.ts/
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 14'] }, testIgnore: WIDTH_ONLY },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'] }, testIgnore: WIDTH_ONLY },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
