import { SETUP_PATH } from '@/app/guards'
import { env } from '@/config/env'

/**
 * The address a setup link opens: this app's `/setup`, with the token in the
 * fragment, which browsers never send to a server (nor in a `Referer`).
 */
export function setupUrl(
  token: string,
  origin: string = window.location.origin,
  base: string = env.base,
): string {
  return `${origin}${base.replace(/\/$/, '')}${SETUP_PATH}#token=${encodeURIComponent(token)}`
}

/** The token of a `#token=…` fragment, or '' */
export function tokenFromHash(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? ''
}
