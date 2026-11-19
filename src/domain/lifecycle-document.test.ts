import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUARD_NAMES, TRANSITIONS } from './lifecycle'
import { buildLifecycleDocument, serializeLifecycle } from './lifecycle-document'
import { RequestStatus } from './model'

describe('docs/lifecycle.json', () => {
  it('is up to date — run `npm run lifecycle` after changing the lifecycle', () => {
    const committed = readFileSync(resolve(process.cwd(), 'docs/lifecycle.json'), 'utf8').replace(
      /\r\n/g,
      '\n',
    )
    expect(committed).toBe(serializeLifecycle())
  })

  it('covers every status and names an existing event for every guard', () => {
    const doc = buildLifecycleDocument()
    expect(Object.keys(doc.turn).sort()).toEqual([...RequestStatus.options].sort())
    expect(Object.keys(doc.stage).sort()).toEqual([...RequestStatus.options].sort())
    expect(Object.keys(doc.guards).sort()).toEqual([...GUARD_NAMES].sort())
    for (const event of Object.values(doc.guards)) expect(TRANSITIONS).toHaveProperty(event)
    for (const event of doc.userEvents) expect(TRANSITIONS).toHaveProperty(event)
  })
})
