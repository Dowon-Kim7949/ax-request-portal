/**
 * deploy/nginx.conf against index.html: the Content-Security-Policy must let
 * the page run. deploy/check-nginx.sh checks the same on a running nginx in
 * CI; this catches a drift at `npm run verify` time.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasPagePolicy, pagePolicyOf } from './nginx-csp'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const html = read('index.html')
const nginx = read('deploy/nginx.conf')

/** The page policy: the default value of the $ax_csp map, by directive. */
function pagePolicy(): Map<string, string[]> {
  return new Map(
    pagePolicyOf(nginx)
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map(([name, ...sources]): [string, string[]] => [name!, sources]),
  )
}

const csp = pagePolicy()

describe('Content-Security-Policy in deploy/nginx.conf', () => {
  it('runs exactly the inline scripts of index.html, by hash', () => {
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attributes]) => !/\bsrc\s*=/i.test(attributes!))
      .map(([, , body]) => `'sha256-${createHash('sha256').update(body!, 'utf8').digest('base64')}'`)
    expect(inline.length).toBeGreaterThan(0)

    const scriptSrc = csp.get('script-src') ?? []
    // On a mismatch, print the new hash with `node deploy/csp-hashes.mjs index.html`.
    expect(scriptSrc.filter((s) => s.startsWith("'sha256-")).sort()).toEqual(inline.sort())
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
  })

  it('allows the stylesheets index.html loads from other origins, and their fonts', () => {
    const origins = [...html.matchAll(/<link\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => /rel="stylesheet"/.test(tag))
      .map((tag) => /href="(https?:[^"]+)"/.exec(tag)?.[1])
      .filter((href) => href !== undefined)
      .map((href) => new URL(href).origin)
    expect(origins.length).toBeGreaterThan(0)
    for (const origin of origins) {
      expect(csp.get('style-src')).toContain(origin)
      expect(csp.get('font-src')).toContain(origin)
    }
  })

  it('shows the images the demo keeps in the browser (attachments, preview screenshots)', () => {
    // A backend or file store on another origin is added here too (see the comment in deploy/nginx.conf).
    expect(csp.get('img-src')).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:']))
  })

  it('is what vite preview sends, to the same paths as nginx', () => {
    // The E2E tests run against vite preview, under this policy (see previewCsp in vite.config.ts).
    expect(pagePolicyOf(nginx)).toMatch(/^default-src 'self'; script-src 'self' 'sha256-/)
    for (const path of ['/', '/requests/1024?tab=x', '/assets/index-abc.js', '/version.json']) {
      expect(hasPagePolicy(path), path).toBe(true)
    }
    // As in nginx: the mock service worker fetches the web font for the page under its own policy.
    expect(hasPagePolicy('/mockServiceWorker.js')).toBe(false)
    expect(hasPagePolicy('/ax/mockServiceWorker.js?v=1')).toBe(false)
    expect(nginx).toContain('~/mockServiceWorker\\.js$  "";')
  })

  it('stays strict where it matters', () => {
    expect(csp.get('default-src')).toEqual(["'self'"])
    expect(csp.get('connect-src')).toContain("'self'")
    expect(csp.get('worker-src')).toEqual(["'self'"])
    expect(csp.get('object-src')).toEqual(["'none'"])
    expect(csp.get('frame-ancestors')).toEqual(["'none'"])
    expect(csp.get('base-uri')).toEqual(["'self'"])
    expect(csp.get('form-action')).toEqual(["'self'"])
  })
})
