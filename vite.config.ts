/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // Sub-path deployments (e.g. https://host/ax/) set VITE_BASE=/ax/
    base: env.VITE_BASE || '/',
    plugins: [react(), tailwindcss()],
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
