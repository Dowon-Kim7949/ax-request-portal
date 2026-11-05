import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate, hqPlaceName, type TimeView } from '@/lib/format'
import { hqTimeZone, hqToday, resolveViewTimeZone, sameOffset } from '@/lib/time-zone'
import { usePreferences } from '@/stores/preferences'

/** How this device shows timestamps; re-renders when Settings change. */
export function useTimeView(): TimeView {
  const preference = usePreferences((s) => s.timeZone)
  const showHq = usePreferences((s) => s.showHqTime)
  return useMemo(() => ({ timeZone: resolveViewTimeZone(preference), showHq }), [preference, showHq])
}

/**
 * Tells a viewer on another clock that dates follow the head office.
 * `today` adds the head office's date, for date pickers whose earliest day is "today".
 * Nothing for viewers whose clock matches the head office's.
 */
export function useHqCalendarNote(kind: 'calendar' | 'today' = 'calendar'): string | undefined {
  const { t } = useTranslation()
  const { timeZone } = useTimeView()
  if (sameOffset(timeZone, hqTimeZone())) return undefined
  return kind === 'today'
    ? t('time.hqToday', { place: hqPlaceName(), date: formatDate(hqToday(), { weekday: false }) })
    : t('time.hqCalendar', { place: hqPlaceName() })
}
