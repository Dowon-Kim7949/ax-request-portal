import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { HqCalendarNote } from '@/components/ui/date-time'
import { formatMonth, shiftMonth } from '@/lib/format'
import { hqToday } from '@/lib/time-zone'

/**
 * Previous / next month, never past the current one. The filter row of a monthly dashboard.
 * Months are head-office calendar months, as the API totals them.
 */
export function MonthStepper({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const { t } = useTranslation()
  const current = hqToday().slice(0, 7)
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('dashboard.prevMonth')}
          onClick={() => onChange(shiftMonth(month, -1))}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="min-w-28 text-center font-bold">{formatMonth(month)}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('dashboard.nextMonth')}
          disabled={month >= current}
          onClick={() => onChange(shiftMonth(month, 1))}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <HqCalendarNote className="min-w-0" />
    </div>
  )
}
