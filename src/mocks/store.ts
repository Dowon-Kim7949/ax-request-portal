import type { ServerLanguage } from './copy'
import { MockEngine, STATE_VERSION, type EngineOptions, type MockState } from './engine'
import { buildSeedState } from './seed'

export const STORAGE_KEY = 'ax-request-portal:mock-db'

export interface MockStore {
  engine: MockEngine
  now: () => Date
  /** Persist after a mutation (no-op without storage) */
  save: () => void
  /** Throw away all changes and rebuild the demo data in `lang` */
  reset: (lang: ServerLanguage) => void
}

interface StoreOptions extends EngineOptions {
  now?: () => Date
  /** Pass `null` to keep everything in memory (tests) */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  /** Language of freshly seeded demo data */
  language?: ServerLanguage
}

function load(storage: StoreOptions['storage']): MockState | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as MockState
    return state.version === STATE_VERSION ? state : null
  } catch {
    return null
  }
}

export function createMockStore(options: StoreOptions): MockStore {
  const { now = () => new Date(), storage = null, language = 'ko', ...engineOptions } = options
  let engine = new MockEngine(load(storage) ?? buildSeedState(now(), engineOptions, language), engineOptions)

  const save = () => {
    if (!storage) return
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(engine.state))
    } catch {
      // Quota exceeded or private mode: the demo keeps working in memory.
    }
  }
  save()

  return {
    get engine() {
      return engine
    },
    now,
    save,
    reset(lang) {
      storage?.removeItem(STORAGE_KEY)
      engine = new MockEngine(buildSeedState(now(), engineOptions, lang), engineOptions)
      save()
    },
  }
}
