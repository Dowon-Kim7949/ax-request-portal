/**
 * docs/lifecycle.json: the request lifecycle as data, for backends.
 *
 * The rules live in `lifecycle.ts`; this writes the table-shaped part of them
 * (statuses, transitions, who sends each event, which guard belongs to which
 * event, turns and stages) next to docs/openapi.json, so a backend can pin
 * both to one commit and test its own port against the same data.
 * Regenerate with `npm run lifecycle`; a unit test fails while it is stale.
 */
import { GUARD_EVENTS, stageOf, TERMINAL_STATUSES, TRANSITIONS, turnOf, USER_EVENTS } from './lifecycle'
import { RequestStatus, SCOPE_REVISIONS_MAX } from './model'

export function buildLifecycleDocument() {
  const statuses = RequestStatus.options
  return {
    description:
      'The request lifecycle of AX Request Portal, generated from src/domain/lifecycle.ts by `npm run lifecycle`. Do not edit. Guards are named here; their conditions are in lifecycle.ts (assertGuards).',
    statuses,
    terminal: TERMINAL_STATUSES,
    transitions: TRANSITIONS,
    userEvents: USER_EVENTS,
    guards: GUARD_EVENTS,
    scopeRevisionsMax: SCOPE_REVISIONS_MAX,
    turn: Object.fromEntries(statuses.map((s) => [s, turnOf(s)])),
    stage: Object.fromEntries(statuses.map((s) => [s, stageOf(s)])),
  }
}

export function serializeLifecycle(): string {
  return `${JSON.stringify(buildLifecycleDocument(), null, 2)}\n`
}
