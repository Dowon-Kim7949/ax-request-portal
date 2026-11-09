import { useCallback, useSyncExternalStore } from 'react'

/** Tablet width and up (Tailwind `md`): where the navigation becomes a rail or a sidebar. */
export const TABLET_UP = '(min-width: 48rem)'

/**
 * Whether the viewport matches a media query, following changes. Without
 * `matchMedia` (jsdom) nothing matches.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches,
    () => false,
  )
}
