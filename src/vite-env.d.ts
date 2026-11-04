/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE?: string
  readonly VITE_API_MOCK?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BUILD_ID?: string
}

/** Identifier of this build, also written to version.json (vite.config.ts) */
declare const __BUILD_ID__: string

interface ImportMeta {
  readonly env: ImportMetaEnv
}
