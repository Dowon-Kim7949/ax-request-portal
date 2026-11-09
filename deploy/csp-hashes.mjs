#!/usr/bin/env node
/**
 * Prints the Content-Security-Policy source ('sha256-…') of every inline
 * <script> in an HTML file, one per line. script-src in deploy/nginx.conf
 * must list them; deploy/check-nginx.sh compares them with what nginx serves.
 *
 *   node deploy/csp-hashes.mjs index.html      # or dist/index.html
 *   curl -fsS http://localhost:8080/ | node deploy/csp-hashes.mjs
 *
 * No dependencies: it runs wherever the app is built or checked.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const html = readFileSync(process.argv[2] ?? 0, 'utf8') // 0 = stdin

for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc\s*=/i.test(attributes)) continue
  console.log(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`)
}
