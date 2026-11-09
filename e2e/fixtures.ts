/**
 * Playwright's `test` with this suite's fixtures. Specs import `test` and
 * `expect` from here instead of '@playwright/test'.
 */
import { test as base, type BrowserContext } from '@playwright/test'

export * from '@playwright/test'

/**
 * WebKit's Windows port sometimes stops producing animation frames for a page
 * that has gone idle on a busy machine: requestAnimationFrame callbacks stop
 * firing until the next input event. Playwright waits for animation frames
 * before every click and fill (the "stable" check), so the action waits until
 * the test times out, on any test. Measured in the page during such a stall:
 * timers run, the page is visible and focused, no animation is running, and a
 * frame callback does not fire within a second; a forced click wakes it.
 *
 * A page that always has a frame requested does not go idle. On a saturated
 * machine, 3 of 50 runs of the wizard flow stalled without this and none of 50
 * with it. It was seen with WebKit on Windows only (Chromium never showed it;
 * WebKit on Linux, as in CI, was not measured), so it is installed there only.
 */
export async function keepFramesRunning(context: BrowserContext, browserName: string) {
  if (browserName !== 'webkit' || process.platform !== 'win32') return
  await context.addInitScript(() => {
    const frame = () => requestAnimationFrame(frame)
    requestAnimationFrame(frame)
  })
}

export const test = base.extend<{ framesKeptRunning: void }>({
  framesKeptRunning: [
    async ({ context, browserName }, use) => {
      await keepFramesRunning(context, browserName)
      await use()
    },
    { auto: true },
  ],
})
