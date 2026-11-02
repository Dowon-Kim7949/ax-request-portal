/** Build-time environment. See .env.example. */
export const env = {
  /** Serve every API call from the in-browser mock (MSW). Defaults to true until a backend exists. */
  apiMock: (import.meta.env.VITE_API_MOCK ?? 'true') !== 'false',
  /** Backend base URL (ignored in mock mode) */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  /** Public path the app is served from, always ending with "/" */
  base: import.meta.env.BASE_URL,
} as const

/** Base URL every API call is prefixed with. The mock intercepts same-origin `/api`. */
export const apiRoot = env.apiMock ? '/api' : env.apiBaseUrl
