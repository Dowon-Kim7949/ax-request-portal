/**
 * Build-time environment. See .env.example; vite.config.ts validates these
 * values (src/config/env-check.ts) and refuses to build with a bad one.
 */
export const env = {
  /**
   * Serve every API call from the in-browser mock (MSW). True unless
   * VITE_API_MOCK is exactly "false", so a fresh clone runs without a backend.
   * The UI says so on every screen (src/app/demo-banner.tsx). Decided at build
   * time (`__API_MOCK__`, from isApiMock in src/config/env-check.ts).
   */
  apiMock: __API_MOCK__,
  /** Backend base URL (ignored in mock mode) */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  /** Public path the app is served from, always ending with "/" */
  base: import.meta.env.BASE_URL,
} as const

/** Base URL every API call is prefixed with. The mock intercepts same-origin `/api`. */
export const apiRoot = env.apiMock ? '/api' : env.apiBaseUrl
