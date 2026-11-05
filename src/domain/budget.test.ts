import { describe, expect, it } from 'vitest'
import { BudgetInput } from '../api/contract'
import { BUDGET_LIMIT_MAX_KRW, perRequestLimitFits, YearMonth } from './model'

const limits = { monthlyLimitKrw: 500_000, perRequestLimitKrw: 20_000, alertThresholdPct: 80 }

describe('AI budget limits', () => {
  it('accepts whole won from 0 (no limit) up to the ceiling', () => {
    expect(BudgetInput.safeParse(limits).success).toBe(true)
    expect(BudgetInput.safeParse({ ...limits, monthlyLimitKrw: 0, perRequestLimitKrw: 0 }).success).toBe(true)
    expect(
      BudgetInput.safeParse({ ...limits, monthlyLimitKrw: BUDGET_LIMIT_MAX_KRW, perRequestLimitKrw: 1 })
        .success,
    ).toBe(true)
  })

  it.each([
    ['negative', { monthlyLimitKrw: -1 }],
    ['fractional', { perRequestLimitKrw: 0.5 }],
    ['above the ceiling', { monthlyLimitKrw: BUDGET_LIMIT_MAX_KRW + 1 }],
    ['infinite', { monthlyLimitKrw: Number.POSITIVE_INFINITY }],
    ['not a number', { monthlyLimitKrw: Number.NaN }],
  ])('refuses a %s limit', (_label, patch) => {
    expect(BudgetInput.safeParse({ ...limits, ...patch }).success).toBe(false)
  })

  it('keeps the per-request limit within the monthly limit unless either is unlimited', () => {
    const over = BudgetInput.safeParse({ ...limits, perRequestLimitKrw: 600_000 })
    expect(over.success).toBe(false)
    expect(over.error?.issues.map((i) => i.path.join('.'))).toEqual(['perRequestLimitKrw'])

    expect(perRequestLimitFits({ monthlyLimitKrw: 500_000, perRequestLimitKrw: 500_000 })).toBe(true)
    // 0 means no limit on that side.
    expect(perRequestLimitFits({ monthlyLimitKrw: 0, perRequestLimitKrw: 600_000 })).toBe(true)
    expect(perRequestLimitFits({ monthlyLimitKrw: 500_000, perRequestLimitKrw: 0 })).toBe(true)
  })
})

describe('YearMonth', () => {
  it('takes months 01–12 only', () => {
    for (const ok of ['2026-01', '2026-11', '2026-12']) expect(YearMonth.safeParse(ok).success, ok).toBe(true)
    for (const bad of ['2026-00', '2026-13', '2026-1', '26-11', '2026-11-01']) {
      expect(YearMonth.safeParse(bad).success, bad).toBe(false)
    }
  })
})
