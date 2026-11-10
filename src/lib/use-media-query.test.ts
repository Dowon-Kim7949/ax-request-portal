import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FIT_QUERY } from './use-media-query'

describe('FIT_QUERY', () => {
  it('says what the fit: variant in src/index.css says', () => {
    // The CSS lays a page out to fit the window; the script makes its list a focusable region. They must agree.
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const variant = /@custom-variant fit \(@media ([^;]+)\);/.exec(css)?.[1]
    expect(variant).toBe(FIT_QUERY)
  })
})
