import type { ServerLanguage } from './copy'
import { MockEngine, STATE_VERSION, type EngineOptions, type MockState } from './engine'
import { buildSeedState } from './seed'

export const STORAGE_KEY = 'ax-request-portal:mock-db'
/**
 * The revision of the saved state, kept apart from it so a tab can check for
 * another tab's save without reading and parsing the whole state.
 */
export const REVISION_KEY = 'ax-request-portal:mock-db:revision'

export interface MockStore {
  engine: MockEngine
  now: () => Date
  /**
   * Picks up what another tab saved since this tab last read or wrote. Call it
   * before handling a request, with nothing awaited between it and `save`.
   */
  sync: () => void
  /** Persist after a mutation (no-op without storage) */
  save: () => void
  /** Throw away all changes and rebuild the demo data in `lang` */
  reset: (lang: ServerLanguage) => void
}

type MockStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

interface StoreOptions extends EngineOptions {
  now?: () => Date
  /** Pass `null` to keep everything in memory (tests) */
  storage?: MockStorage | null
  /** Language of freshly seeded demo data */
  language?: ServerLanguage
  /**
   * Called when saving fails (storage full or blocked): the demo keeps working
   * in memory, but a reload loses the changes. Called once per run of failures.
   */
  onSaveError?: (error: unknown) => void
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isCounter = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0

/**
 * Why a stored value cannot be used as the demo state, or null when it has the
 * shape this version writes. Deliberately shallow — every collection and
 * setting the engine reads exists with the right kind of value — so a copy
 * written by an older build, cut short or edited by hand is rebuilt instead of
 * breaking a screen later on.
 */
export function stateProblem(value: unknown): string | null {
  if (!isRecord(value)) return 'not an object'
  if (value.version !== STATE_VERSION) return `version ${String(value.version)}, expected ${STATE_VERSION}`
  for (const key of ['revision', 'seq', 'nextRequestId'] as const) {
    if (!isCounter(value[key])) return `${key} is not a counter`
  }
  if (value.language !== 'ko' && value.language !== 'en') return 'unknown language'
  if (typeof value.dirty !== 'boolean' || typeof value.seededAt !== 'string') return 'missing flags'

  const lists = ['users', 'projects', 'requests', 'notifications', 'aiUsage', 'attachments'] as const
  for (const key of lists) {
    const list = value[key]
    if (!Array.isArray(list) || !list.every((item) => isRecord(item) && item.id !== undefined)) {
      return `${key} is not a list of records`
    }
  }
  const requests = value.requests as Array<Record<string, unknown>>
  if (!requests.every((r) => isCounter(r.id) && typeof r.status === 'string' && Array.isArray(r.timeline))) {
    return 'a request is incomplete'
  }
  if (requests.some((r) => (r.id as number) >= (value.nextRequestId as number))) {
    return 'request ids would be issued twice'
  }

  if (!isRecord(value.notificationSettings)) return 'notificationSettings is missing'
  const budget = value.budget
  if (
    !isRecord(budget) ||
    !['monthlyLimitKrw', 'perRequestLimitKrw', 'alertThresholdPct'].every(
      (k) => typeof budget[k] === 'number',
    )
  ) {
    return 'budget is incomplete'
  }
  const ai = value.ai
  if (
    !isRecord(ai) ||
    !isRecord(ai.selections) ||
    !Array.isArray(ai.overrides) ||
    !isRecord(ai.providers) ||
    !isRecord(ai.pricing) ||
    !Array.isArray(ai.pricing.models)
  ) {
    return 'AI settings are incomplete'
  }
  return null
}

type Loaded = { state: MockState } | { problem: string } | null

function read(storage: MockStorage | null): Loaded {
  if (!storage) return null
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { problem: 'not valid JSON' }
  }
  const problem = stateProblem(value)
  return problem ? { problem } : { state: value as MockState }
}

export function createMockStore(options: StoreOptions): MockStore {
  const { now = () => new Date(), storage = null, language = 'ko', onSaveError, ...engineOptions } = options

  const storedRevision = (): number => {
    if (!storage) return 0
    try {
      const n = Number(storage.getItem(REVISION_KEY))
      return isCounter(n) ? n : 0
    } catch {
      return 0
    }
  }

  /** Fresh demo data, numbered after anything saved before so other tabs take it up. */
  const seed = (lang: ServerLanguage, after: number) =>
    new MockEngine({ ...buildSeedState(now(), engineOptions, lang), revision: after }, engineOptions)

  let engine: MockEngine
  let failing = false
  const save = () => {
    engine.state.revision += 1
    if (!storage) return
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(engine.state))
      // Written last: a tab that sees the new revision finds the state already saved.
      storage.setItem(REVISION_KEY, String(engine.state.revision))
      failing = false
    } catch (err) {
      // Quota exceeded or blocked: the demo keeps working in memory. Say so once.
      if (!failing) {
        failing = true
        onSaveError?.(err)
      }
    }
  }

  const loaded = read(storage)
  if (loaded && 'state' in loaded) {
    engine = new MockEngine(loaded.state, engineOptions)
  } else {
    if (loaded) console.warn(`[mock api] Stored demo data was rebuilt: ${loaded.problem}.`)
    engine = seed(language, storedRevision())
    save()
  }

  return {
    get engine() {
      return engine
    },
    now,
    sync() {
      if (!storage || storedRevision() <= engine.state.revision) return
      const fresh = read(storage)
      if (fresh && 'state' in fresh && fresh.state.revision > engine.state.revision) {
        engine = new MockEngine(fresh.state, engineOptions)
      }
    },
    save,
    reset(lang) {
      const after = Math.max(engine.state.revision, storedRevision())
      try {
        // Frees the space first: the old copy may be what filled the storage.
        storage?.removeItem(STORAGE_KEY)
      } catch {
        // ignore: save() reports it if writing fails too
      }
      engine = seed(lang, after)
      save()
    },
  }
}
