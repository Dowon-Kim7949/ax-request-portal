import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { api } from './contract'
import { buildOpenApiDocument, serializeOpenApi } from './openapi'

describe('OpenAPI contract', () => {
  it('docs/openapi.json is up to date — run `npm run openapi` after changing the contract', () => {
    const committed = readFileSync(resolve(process.cwd(), 'docs/openapi.json'), 'utf8').replace(/\r\n/g, '\n')
    expect(committed).toBe(serializeOpenApi())
  })

  it('describes every endpoint exactly once', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, { operationId: string }>> }
    const ids = Object.values(doc.paths).flatMap((ops) => Object.values(ops).map((o) => o.operationId))
    expect(ids.sort()).toEqual(Object.keys(api).sort())
  })

  it('has no dangling $ref', () => {
    const doc = buildOpenApiDocument() as { components: { schemas: Record<string, unknown> } }
    const refs = [...JSON.stringify(doc).matchAll(/"#\/components\/schemas\/([^"]+)"/g)].map((m) => m[1]!)
    const missing = [...new Set(refs)].filter((id) => !(id in doc.components.schemas))
    expect(missing).toEqual([])
  })
})
