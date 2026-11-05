/**
 * Where the request wizard keeps a person's unsubmitted request on this device.
 * Kept apart from the wizard so signing out (src/stores/session.ts) can delete
 * it without loading the wizard.
 */

/** localStorage key of `userId`'s draft. */
export const draftKey = (userId: string) => `ax-request-portal:draft:${userId}`

/** Deletes `userId`'s draft from this device. */
export function clearDraft(userId: string): void {
  try {
    localStorage.removeItem(draftKey(userId))
  } catch {
    // Storage blocked: nothing was kept.
  }
}
