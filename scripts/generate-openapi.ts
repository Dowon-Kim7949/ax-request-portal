import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serializeOpenApi } from '../src/api/openapi'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'docs/openapi.json')

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, serializeOpenApi(), 'utf8')
console.log(`wrote ${out}`)
