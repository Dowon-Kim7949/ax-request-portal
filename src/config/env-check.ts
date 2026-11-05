/**
 * Checks the build settings in .env.example before they are baked into the bundle.
 *
 * vite.config.ts runs `checkEnv` on every build (errors stop it) and dev start
 * (everything is a warning), and src/config/env.ts reads VITE_API_MOCK with
 * `isApiMock`, so the build and the app agree on what a value means.
 *
 * No imports and no globals: this file is compiled for the browser
 * (tsconfig.app.json) and for the Node-side Vite config (tsconfig.node.json).
 */

/** The raw values, as Vite's `loadEnv` returns them (environment over .env files). */
export interface EnvInput {
  readonly VITE_API_MOCK?: string
  readonly VITE_API_BASE_URL?: string
}

export interface EnvReport {
  /** True when every API call is answered by the in-browser mock (demo mode). */
  apiMock: boolean
  /** Settings that would ship a broken or silently mocked app. `vite build` stops on them. */
  errors: string[]
  /** Worth a look, but the build still works. */
  warnings: string[]
}

/**
 * Unset or empty means the mock, so a fresh clone builds and runs without a
 * backend. Only the exact string "false" switches to the real backend; the
 * build rejects anything else (see `checkEnv`).
 */
export function isApiMock(value: string | undefined): boolean {
  return value !== 'false'
}

const BASE_URL_HINT =
  'Use "/api" (same origin, e.g. behind the /api proxy in deploy/nginx.conf) or a full URL such as "https://api.your-company.com".'

/** Reserved example hosts (RFC 2606) and the placeholder in .env.example: never a real backend. */
const PLACEHOLDER_HOST = /(^|\.)(example(\.(com|net|org|internal))?|invalid)$/i

const LOOPBACK_HOST = /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/i

/**
 * The value as quoted in a message, minus what may be a secret (a user name
 * and password, a query or fragment): build logs are often public.
 */
function shown(value: string): string {
  return JSON.stringify(
    value.replace(/^([a-z][a-z\d+.-]*:\/\/)?[^/?#]*@/i, '$1***@').replace(/([?#])[\s\S]*$/, '$1…'),
  )
}

function checkBaseUrl(value: string, errors: string[], warnings: string[]): void {
  if (!value.trim()) {
    errors.push(`VITE_API_MOCK=false needs VITE_API_BASE_URL, the backend to call. ${BASE_URL_HINT}`)
    return
  }
  if (value !== value.trim()) {
    errors.push(`VITE_API_BASE_URL has leading or trailing spaces: ${shown(value)}.`)
    return
  }

  // A same-origin path: the browser calls the site's own origin, nginx proxies it.
  if (value.startsWith('/') && !value.startsWith('//')) {
    if (/[?#]/.test(value)) {
      errors.push(
        `VITE_API_BASE_URL must not contain "?" or "#": API paths are appended to it (got ${shown(value)}).`,
      )
    }
    return
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    errors.push(`VITE_API_BASE_URL is not a URL: ${shown(value)}. ${BASE_URL_HINT}`)
    return
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    errors.push(
      `VITE_API_BASE_URL must be an http(s) URL or a path starting with "/" (got ${shown(value)}). ${BASE_URL_HINT}`,
    )
    return
  }
  if (url.username || url.password) {
    // Not echoed back: the value holds a secret, and build logs are often public.
    errors.push(
      'VITE_API_BASE_URL must not contain a user name or password: it ends up in the public bundle.',
    )
    return
  }
  if (url.search || url.hash) {
    errors.push(
      `VITE_API_BASE_URL must not have a query string or fragment: API paths are appended to it (got ${shown(value)}).`,
    )
    return
  }
  if (PLACEHOLDER_HOST.test(url.hostname)) {
    errors.push(
      `VITE_API_BASE_URL still points at a placeholder host (${url.hostname}). Set it to your backend. ${BASE_URL_HINT}`,
    )
    return
  }

  if (url.protocol === 'http:' && !LOOPBACK_HOST.test(url.hostname)) {
    warnings.push(
      `VITE_API_BASE_URL uses plain http (${url.origin}): sign-in tokens would travel unencrypted. Use https outside a local setup.`,
    )
  }
  warnings.push(
    `API calls go to ${url.origin}. Unless the app is served from that same origin, add it to connect-src in the ` +
      `Content-Security-Policy (deploy/nginx.conf) and allow the app's origin in the backend's CORS settings.`,
  )
}

/** Validates the settings. Pure: the caller decides whether errors stop the build. */
export function checkEnv(input: EnvInput): EnvReport {
  const errors: string[] = []
  const warnings: string[] = []

  const mock = input.VITE_API_MOCK
  if (mock !== undefined && mock !== '' && mock !== 'true' && mock !== 'false') {
    errors.push(
      `VITE_API_MOCK must be "true" or "false", or unset for the in-browser mock API (got ${JSON.stringify(mock)}).`,
    )
  }

  const apiMock = isApiMock(mock)
  if (!apiMock) checkBaseUrl(input.VITE_API_BASE_URL ?? '', errors, warnings)

  return { apiMock, errors, warnings }
}
