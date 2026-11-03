/**
 * WCAG contrast for every token pair the UI actually draws, in both themes.
 * Reads the values straight from src/index.css, so editing a color that
 * breaks readability fails CI. Text needs 4.5:1 (AA); control borders, icons
 * and chart marks need 3:1 (WCAG 1.4.11).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]!] = m[2]!.toLowerCase()
  return out
}

const lightBlock = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
const darkBlock = /\.dark\s*\{([\s\S]*?)\n {2}\}/.exec(css)?.[1] ?? ''
const THEMES = {
  light: tokens(lightBlock),
  dark: { ...tokens(lightBlock), ...tokens(darkBlock) },
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const WHITE = '#ffffff'
const TEXT = 4.5
const UI = 3

/** [foreground, background, minimum]; `white` is literal white text on a fill. */
const PAIRS: Array<[string, string, number]> = [
  // body text on every page surface
  ...['ink-900', 'ink-700', 'ink-600', 'ink-500', 'ink-400'].flatMap((fg) =>
    ['surface', 'canvas', 'muted'].map((bg): [string, string, number] => [fg, bg, TEXT]),
  ),
  // accent text and links
  ['accent', 'surface', TEXT],
  ['accent', 'canvas', TEXT],
  ['accent', 'muted', TEXT],
  ['accent-strong', 'brand-50', TEXT],
  ['accent-strong', 'brand-100', TEXT],
  // status text on its tint and on plain surfaces
  ['success-fg', 'success-50', TEXT],
  ['warning-fg', 'warning-50', TEXT],
  ['danger-fg', 'danger-50', TEXT],
  ['success-fg', 'surface', TEXT],
  ['warning-fg', 'surface', TEXT],
  ['danger-fg', 'surface', TEXT],
  ['ai-700', 'ai-50', TEXT],
  ['ink-700', 'brand-50', TEXT],
  ['ink-700', 'warning-50', TEXT],
  ['ink-700', 'danger-50', TEXT],
  // white text on fills
  ['white', 'brand-600', TEXT],
  ['white', 'brand-hover', TEXT],
  ['white', 'success-600', TEXT],
  ['white', 'danger-600', TEXT],
  ['on-inverse', 'inverse', TEXT],
  // controls, icons and chart marks (non-text)
  ['field', 'surface', UI],
  ['field', 'canvas', UI],
  ['field', 'muted', UI],
  ['brand-600', 'surface', UI],
  ['ai-500', 'surface', UI],
  ['ai-600', 'surface', UI],
  ['warning-600', 'surface', UI],
  ['brand-500', 'surface', UI],
  ['provider-anthropic', 'surface', UI],
  ['provider-openai', 'surface', UI],
]

describe.each(Object.entries(THEMES))('%s theme contrast', (_name, t) => {
  it('defines every token it is checked against', () => {
    const missing = PAIRS.flatMap(([fg, bg]) => [fg, bg]).filter((k) => k !== 'white' && !t[k])
    expect([...new Set(missing)]).toEqual([])
  })

  it.each(PAIRS)('%s on %s ≥ %s:1', (fg, bg, min) => {
    const fgHex = fg === 'white' ? WHITE : t[fg]!
    const ratio = contrast(fgHex, t[bg]!)
    expect(ratio, `${fgHex} on ${t[bg]} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min)
  })
})
