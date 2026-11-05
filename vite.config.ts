/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { checkEnv, type EnvReport } from './src/config/env-check.ts'

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

/**
 * A real-backend build ships no mock service worker. Vite copies public/ as
 * is, so the file is removed from the output once it has been written.
 */
function dropMockWorker(): Plugin {
  return {
    name: 'ax:drop-mock-worker',
    apply: 'build',
    writeBundle({ dir }) {
      if (dir) rmSync(join(dir, 'mockServiceWorker.js'), { force: true })
    },
  }
}

/**
 * `vite build` stops on a setting that would ship a broken or silently mocked
 * app. The dev server only warns: it never reaches users, and with a malformed
 * VITE_API_MOCK it falls back to the mock, which the demo banner shows.
 */
function reportEnv(report: EnvReport, command: 'build' | 'serve'): void {
  const list = (items: string[]) => items.map((m) => `\n  - ${m}`).join('')
  if (command === 'build' && report.errors.length) {
    throw new Error(`Invalid build settings (see .env.example):${list(report.errors)}`)
  }
  const warnings = [...report.errors, ...report.warnings]
  if (warnings.length) console.warn(`[env] Check the build settings (see .env.example):${list(warnings)}`)
  if (command === 'build' && report.apiMock) {
    console.info(
      '[env] Demo build: the in-browser mock API answers every call and data stays in each browser. ' +
        'Set VITE_API_MOCK=false and VITE_API_BASE_URL to use a real backend.',
    )
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const buildId = resolveBuildId(env)
  const envReport = checkEnv(env)
  // `vite preview` serves an existing build, and Vitest only borrows this config.
  if (!isPreview && mode !== 'test' && !process.env.VITEST) reportEnv(envReport, command)

  return {
    // Sub-path deployments (e.g. https://host/ax/) set VITE_BASE=/ax/
    base: env.VITE_BASE || '/',
    define: { __BUILD_ID__: JSON.stringify(buildId) },
    plugins: [react(), tailwindcss(), versionFile(buildId), envReport.apiMock ? null : dropMockWorker()],
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
              // zod-jitless rides along: a chunk runs after the chunks it imports, so in the entry
              // chunk it would run after the schemas in the app chunks were built (see that file).
              {
                name: 'vendor-zod',
                test: /node_modules[\\/]zod[\\/]|[\\/]src[\\/]config[\\/]zod-jitless\.ts$/,
              },
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
