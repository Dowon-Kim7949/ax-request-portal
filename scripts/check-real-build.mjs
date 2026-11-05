#!/usr/bin/env node
/**
 * Builds the app for a real backend (VITE_API_MOCK=false) into a temporary
 * folder and fails if any of the in-browser mock ships with it: the service
 * worker, MSW and the mock engine, or the demo seed (accounts and password).
 * Part of `npm run verify`.
 *
 *   node scripts/check-real-build.mjs
 *
 * The mock is only reached through dynamic imports behind `__API_MOCK__`, a
 * literal the bundler folds away (vite.config.ts). Branching on anything else
 * (e.g. `env.apiMock`) keeps those imports, and this check fails.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://api.example.test'

/** Text only the mock carries, and the source file that has it (checked too, so a rename cannot hide it). */
const MARKERS = [
  { text: 'mockServiceWorker', source: 'src/mocks/browser.ts', what: 'the mock service worker registration' },
  { text: 'MOCK_ACTIVATE', source: 'src/mocks/browser.ts', what: 'the MSW re-attach message' },
  { text: 'X-Mock-Api', source: 'src/mocks/handlers.ts', what: 'the mock handlers' },
  { text: 'planner@example.com', source: 'src/mocks/seed.ts', what: 'the demo accounts' },
]

const problems = []
for (const m of MARKERS) {
  if (!readFileSync(join(root, m.source), 'utf8').includes(m.text)) {
    problems.push(`${m.source} no longer contains "${m.text}": update MARKERS in this script`)
  }
}

const out = mkdtempSync(join(tmpdir(), 'ax-real-build-'))
try {
  const build = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules/vite/bin/vite.js'),
      'build',
      '--outDir',
      out,
      '--emptyOutDir',
      '--logLevel',
      'error',
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, VITE_API_MOCK: 'false', VITE_API_BASE_URL: API },
    },
  )
  if (build.status !== 0) throw new Error(`vite build failed (exit ${build.status})`)

  if (existsSync(join(out, 'mockServiceWorker.js')))
    problems.push('dist/mockServiceWorker.js is in the build')
  const assets = readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js'))
  const code = assets.map((file) => ({ file, text: readFileSync(join(out, 'assets', file), 'utf8') }))
  if (!code.some(({ text }) => text.includes(API))) {
    problems.push(`no script calls ${API}: this does not look like a real-backend build`)
  }
  for (const { file, text } of code) {
    for (const m of MARKERS) {
      if (text.includes(m.text)) problems.push(`assets/${file} contains ${m.what} ("${m.text}")`)
    }
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

if (problems.length) {
  console.error(`Real-backend build check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}
console.log('Real-backend build check passed: no mock code or demo data in the output.')
