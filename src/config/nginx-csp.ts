/**
 * The page's Content-Security-Policy as deploy/nginx.conf writes it: the
 * default value of its `$ax_csp` map. That file is the one place the policy
 * is written; `vite preview` (and so the E2E tests, vite.config.ts) and
 * src/config/deploy-config.test.ts read it from there.
 *
 * No imports and no globals: compiled for the Node-side Vite config and the tests.
 */

/** The policy text, e.g. "default-src 'self'; script-src …". Throws when nginx.conf has none. */
export function pagePolicyOf(nginxConf: string): string {
  const policy = /^\s*default\s+"(default-src [^"]+)";/m.exec(nginxConf)?.[1]
  if (!policy) throw new Error('no default Content-Security-Policy in deploy/nginx.conf ($ax_csp map)')
  return policy
}

/** Paths nginx serves without the page policy: the mock service worker (see the comment in nginx.conf). */
export function hasPagePolicy(path: string): boolean {
  return !/\/mockServiceWorker\.js$/.test(path.split(/[?#]/)[0] ?? path)
}
