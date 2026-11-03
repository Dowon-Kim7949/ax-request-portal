import { describe, expect, it } from 'vitest'
import { niceScale } from './chart'

describe('niceScale', () => {
  it('rounds the axis up to clean steps', () => {
    expect(niceScale(9_043)).toEqual({ top: 10_000, ticks: [0, 5_000, 10_000] })
    expect(niceScale(1_800)).toEqual({ top: 2_000, ticks: [0, 1_000, 2_000] })
    expect(niceScale(42)).toEqual({ top: 60, ticks: [0, 20, 40, 60] })
    expect(niceScale(700)).toEqual({ top: 750, ticks: [0, 250, 500, 750] })
  })

  it('keeps an empty chart drawable', () => {
    expect(niceScale(0)).toEqual({ top: 1, ticks: [0] })
  })
})
