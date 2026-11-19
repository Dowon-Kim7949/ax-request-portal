import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serializeLifecycle } from '../src/domain/lifecycle-document'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'docs/lifecycle.json')

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, serializeLifecycle(), 'utf8')
console.log(`wrote ${out}`)
