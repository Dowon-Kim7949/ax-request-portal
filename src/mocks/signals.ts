/**
 * Window events the in-browser mock sends to the app. Kept in a module of its
 * own, with no imports, so the app can listen without loading the mock.
 */

/** The demo data could not be saved (storage full or blocked); changes live until the next reload. */
export const MOCK_STORAGE_FULL_EVENT = 'ax-request-portal:mock-storage-full'
