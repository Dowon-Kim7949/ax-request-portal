/**
 * Window events the in-browser mock sends to the app. Kept in a module of its
 * own, with no imports, so the app can listen without loading the mock.
 */

/** The demo data could not be saved (storage full or blocked); changes live until the next reload. */
export const MOCK_STORAGE_FULL_EVENT = 'ax-request-portal:mock-storage-full'

/** Another tab changed the demo data and this tab's mock has taken it up: cached answers are out of date. */
export const MOCK_DATA_CHANGED_EVENT = 'ax-request-portal:mock-data-changed'

/** A failure to save no listener has taken up yet (see `takeMockStorageFull`). */
let storageFullUnheard = false

/**
 * Says that saving the demo data failed. The first save can fail while the
 * mock starts, before the app renders anything that listens, so the failure
 * is also kept until a listener takes it (`takeMockStorageFull`).
 */
export function reportMockStorageFull(): void {
  storageFullUnheard = true
  window.dispatchEvent(new Event(MOCK_STORAGE_FULL_EVENT))
}

/** True once for a reported failure, then false until the next one: the caller tells the person. */
export function takeMockStorageFull(): boolean {
  const unheard = storageFullUnheard
  storageFullUnheard = false
  return unheard
}
