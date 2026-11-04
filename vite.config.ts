/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Identifies a build: VITE_BUILD_ID if set, else the commit (rebuilding the
 * same commit is the same version), else the build time.
 */
function resolveBuildId(env: Record<string, string>): string {
  if (env.VITE_BUILD_ID) return env.VITE_BUILD_ID
  if (env.GITHUB_SHA) return env.GITHUB_SHA.slice(0, 12)
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return Date.now().toString(36)
  }
}

/** Writes dist/version.json, which open tabs poll to learn that a newer build is deployed. */
function versionFile(buildId: string): Plugin {
  return {
    name: 'ax:version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify({ buildId })}\n` })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const buildId = resolveBuildId(env)

  return {
    // Sub-path deployments (e.g. https://host/ax/) set VITE_BASE=/ax/
    base: env.VITE_BASE || '/',
    define: { __BUILD_ID__: JSON.stringify(buildId) },
    plugins: [react(), tailwindcss(), versionFile(buildId)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // Stable vendor chunks: an app-only deploy leaves these hashes (and browser caches) intact.
          // Icons are left out on purpose so each page only pulls the icons it uses.
          codeSplitting: {
            groups: [
              { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'vendor-router', test: /node_modules[\\/]react-router[\\/]/ },
              { name: 'vendor-query', test: /node_modules[\\/](@tanstack|zustand)[\\/]/ },
              { name: 'vendor-i18n', test: /node_modules[\\/](i18next|react-i18next)[\\/]/ },
              { name: 'vendor-zod', test: /node_modules[\\/]zod[\\/]/ },
              {
                name: 'vendor-ui',
                test: /node_modules[\\/](radix-ui|@radix-ui|@floating-ui|react-remove-scroll[^\\/]*|aria-hidden|use-callback-ref|use-sidecar|sonner|tailwind-merge|clsx|class-variance-authority)[\\/]/,
              },
              // UI dictionaries: a copy change only touches this chunk.
              { name: 'messages', test: /[\\/]src[\\/]i18n[\\/][a-z]{2}\.ts$/ },
            ],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  }
})
