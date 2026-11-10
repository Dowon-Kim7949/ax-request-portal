import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

/**
 * Every user flow must work on a phone, a tablet and a desktop,
 * so each spec runs once per viewport. Three specs run in the desktop project
 * only: layout.spec.ts sets its own edge viewports (320 px phone, landscape
 * tablet), fit.spec.ts its big-screen ones (FHD, 1280 × 720, a short laptop),
 * and cursor.spec.ts checks mouse cursors, which touch screens lack. The
 * desktop project's own 1440 × 900 is a big screen too: its runs see the pages
 * that fit the window laid out that way.
 * The accessibility scan (axe.spec.ts) runs on the phone and the desktop: the
 * tablet has the phone's engine and the same components, so it adds time but
 * no findings of its own.
 */
const DESKTOP_ONLY = /(layout|fit|cursor)\.spec\.ts/
const NOT_ON_TABLET = /axe\.spec\.ts/
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
    // The app follows the browser language, color scheme and time zone; pin the defaults
    // (the time zone to the head office's). i18n.spec.ts, theme.spec.ts and
    // time-zone.spec.ts switch them per test.
    locale: 'ko-KR',
    colorScheme: 'light',
    timezoneId: 'Asia/Seoul',
  },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 14'] }, testIgnore: DESKTOP_ONLY },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'] }, testIgnore: [DESKTOP_ONLY, NOT_ON_TABLET] },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
