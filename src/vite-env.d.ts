/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE?: string
  readonly VITE_API_MOCK?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BUILD_ID?: string
}

/** Identifier of this build, also written to version.json (vite.config.ts) */
declare const __BUILD_ID__: string

/**
 * Whether this build serves the API from the in-browser mock (VITE_API_MOCK,
 * read by src/config/env-check.ts). A literal in the bundle: code that loads
 * the mock must branch on it directly, not through `env.apiMock`, so a
 * real-backend build leaves that code out.
 */
declare const __API_MOCK__: boolean

interface ImportMeta {
  readonly env: ImportMetaEnv
}
