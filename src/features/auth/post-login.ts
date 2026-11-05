import { matchRoutes, type RouteObject } from 'react-router'
import { LOGIN_PATH } from '@/app/guards'
import { userCan } from '@/app/hooks'
import { routes as appRoutes, type RouteHandle } from '@/app/router'
import type { User } from '@/domain/model'

const HOME = '/'
/** Base for parsing only: a path that resolves to another origin is not an in-app path. */
const PARSE_BASE = 'http://in-app.invalid'
/** Old addresses forward at most this many times before the redirect gives up and goes home. */
const MAX_FORWARDS = 3

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

/**
 * `next` as an in-app URL, or null. Accepts only a path that starts with
 * exactly one `/`, and refuses backslashes and control characters, which
 * browsers may turn into `//` (another site) or strip.
 */
export function parseInAppPath(next: string | null | undefined): URL | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  if (next.includes('\\') || hasControlCharacter(next)) return null
  try {
    const url = new URL(next, PARSE_BASE)
    return url.origin === PARSE_BASE ? url : null
  } catch {
    return null
  }
}

/**
 * Where to go after signing in. Every use of the login screen's `next`
 * goes through here: it returns `next` only when it is an in-app page that
 * exists, is not the login screen itself, and that `user` may open under the
 * configured permissions (the same rule as `useCan`). Anything else goes home,
 * so a sign-in never lands on a "not allowed" page or loops back to /login.
 */
export function resolvePostLoginPath(
  next: string | null | undefined,
  user: Pick<User, 'role'> | null | undefined,
  routes: RouteObject[] = appRoutes,
): string {
  let url = parseInAppPath(next)
  for (let forwards = 0; url && forwards <= MAX_FORWARDS; forwards++) {
    const matches = matchRoutes(routes, url.pathname)
    const leaf = matches?.at(-1)?.route
    // No match, or only the catch-all "not found" page.
    if (!matches || !leaf || leaf.path === '*') return HOME
    if (matches.some((m) => m.route.path === LOGIN_PATH)) return HOME
    const handles = matches.map((m) => m.route.handle as RouteHandle | undefined)
    if (handles.some((h) => h?.permission && !userCan(user, h.permission))) return HOME
    const forward = handles.at(-1)?.redirectTo
    if (!forward) return url.pathname + url.search + url.hash
    url = parseInAppPath(forward)
  }
  return HOME
}
