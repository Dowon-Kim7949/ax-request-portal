import { ApiError } from './client'

/**
 * What to tell the user about a failed call: the API's own message (already in
 * the UI language, see Accept-Language), or `fallback` for anything else.
 */
export function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}
