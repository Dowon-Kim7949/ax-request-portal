/** Axis helpers for the hand-built charts. */

/** Clean axis steps (1, 2, 2.5, 5 × 10ⁿ), about three of them up to the maximum. */
export function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0] }
  const raw = max / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag
  const top = step * Math.ceil(max / step)
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)
  return { top, ticks }
}
