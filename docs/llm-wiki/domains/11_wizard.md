---
title: Request Wizard
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-09
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/wizard
  - src/features/drafts/sync-core.ts
  - src/features/drafts/sync-engine.ts
  - src/features/drafts/sync.ts
  - src/features/drafts/hooks.ts
  - src/domain/precheck.ts
  - src/stores/draft.ts
evidence:
  - src/features/wizard/schema.ts#symbol:STEPS
  - src/features/wizard/schema.ts#symbol:firstInvalidStep
  - src/features/wizard/schema.ts#symbol:toDraft
  - src/features/wizard/schema.ts#symbol:parseChecklist
  - src/features/wizard/schema.ts#symbol:readDraftValues
  - src/features/wizard/schema.ts#symbol:savedDraftValues
  - src/features/wizard/schema.ts#symbol:toDraftContent
  - src/features/wizard/schema.ts#symbol:draftContentOf
  - src/features/wizard/schema.ts#symbol:hasWrittenContent
  - src/features/wizard/schema.ts#symbol:missingAttachmentIds
  - src/features/wizard/schema.ts#symbol:DRAFT_SAVE_DELAY_MS
  - src/features/wizard/wizard-page.tsx#symbol:WizardPage
  - src/features/wizard/wizard-page.tsx#symbol:WizardSession
  - src/features/wizard/wizard-page.tsx#symbol:WizardOpener
  - src/features/wizard/wizard-page.tsx#symbol:WizardForm
  - src/features/wizard/wizard-page.tsx#symbol:useLiveSearch
  - src/features/wizard/draft-opening.ts#symbol:openDraft
  - src/features/wizard/draft-opening.ts#symbol:startServer
  - src/features/wizard/draft-status.tsx#symbol:DraftStatusBar
  - src/features/wizard/draft-status.tsx#symbol:ConflictNotice
  - src/features/wizard/draft-status.tsx#symbol:LimitNotice
  - src/features/wizard/draft-status.tsx#symbol:DRAFTS_LIST_PATH
  - src/features/wizard/step-notice.ts#symbol:StepNotice
  - src/features/wizard/steps.tsx#symbol:StepTitle
  - src/features/wizard/steps.tsx#symbol:MissingAttachments
  - src/features/wizard/steps.tsx#symbol:ReviewStep
  - src/stores/draft.ts#symbol:draftsKey
  - src/stores/draft.ts#symbol:legacyDraftKey
  - src/stores/draft.ts#symbol:LocalDraft
  - src/stores/draft.ts#symbol:newLocalId
  - src/stores/draft.ts#symbol:resolveDraftId
  - src/stores/draft.ts#symbol:putLocalDraft
  - src/stores/draft.ts#symbol:isStoredOnDevice
  - src/stores/draft.ts#symbol:clearDrafts
  - src/stores/draft.ts#symbol:subscribeLocalDrafts
  - src/features/drafts/sync-core.ts#symbol:shouldSend
  - src/features/drafts/sync-core.ts#symbol:requestFor
  - src/features/drafts/sync-core.ts#symbol:outcomeOf
  - src/features/drafts/sync-core.ts#symbol:settle
  - src/features/drafts/sync-engine.ts#symbol:DraftSyncEngine
  - src/features/drafts/sync-engine.ts#symbol:DRAFT_SYNC_DELAY_MS
  - src/features/drafts/sync.ts#symbol:draftSync
  - src/features/drafts/sync.ts#symbol:migrateLegacyDraft
  - src/features/drafts/sync.ts#symbol:DRAFT_SETTLE_TIMEOUT_MS
  - src/features/drafts/hooks.ts#symbol:useDraftSync
  - src/features/drafts/hooks.ts#symbol:useDraftSaveState
  - src/features/drafts/hooks.ts#symbol:useDiscardDraft
  - src/api/contract.ts#symbol:SavedDraft
  - src/api/contract.ts#symbol:DraftContent
  - src/api/contract.ts#symbol:RequestSubmission
  - src/api/contract.ts#symbol:DRAFT_ID_PATTERN
  - src/api/queries.ts#symbol:usePrecheck
  - src/api/queries.ts#symbol:useCreateRequest
  - src/api/queries.ts#symbol:CREATE_REQUEST_KEY
  - src/api/queries.ts#symbol:useUploadAttachment
  - src/api/queries.ts#symbol:storeSavedDraft
  - src/api/queries.ts#symbol:dropSavedDraft
  - src/domain/precheck.ts#symbol:precheckDraft
  - src/mocks/engine.ts#symbol:publicAttachment
  - src/mocks/engine.ts#symbol:createDraft
  - src/features/wizard/wizard-page.test.tsx
  - src/features/wizard/schema.test.ts
  - src/features/drafts/sync-core.test.ts
  - src/features/drafts/sync-engine.test.ts
  - src/stores/draft.test.ts
  - src/mocks/api.test.ts
  - src/mocks/attachments.test.ts
  - e2e/requester.spec.ts
  - e2e/drafts.spec.ts
related:
  - docs/llm-wiki/domains/04_detail.md
  - docs/llm-wiki/domains/08_requests.md
  - docs/llm-wiki/domains/05_home.md
  - docs/llm-wiki/domains/02_auth.md
  - docs/llm-wiki/WCAG.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Request Wizard

## Responsibility

Filing a new work request at `/requests/new` (`request:create`): seven steps, a draft kept on this device and saved to the person's account, a non-blocking precheck and submission. The list of saved drafts is shown on [My Requests](08_requests.md) and [Home](05_home.md); everything after submission belongs to [Request Detail](04_detail.md). The route sets `handle.focus`, which hides the phone tab bar; the action bar is fixed at the bottom on phones and inline from `md` up.

## Steps and URL

- `STEPS`: `project`, `type`, `targets`, `describe`, `criteria`, `extra`, `review`. The current step is `?step=N` in the URL (non-integers become 0, values are clamped). `?project=<id>` without a step starts at step 1 with the project chosen. `?draft=<id>` names the draft the form is for (see Opening a draft).
- Choosing a project or a type advances immediately.
- For the `checklist` type (findings from an audit or inspection) the `criteria` step lists findings instead of acceptance criteria: an optional source, then up to `CHECKLIST_ITEMS_MAX` (30) items of number, clause, finding and "fixed when". Rows can be imported from a pasted table (`parseChecklist`: tab- or `|`-separated, 4 / 3 / 2 / 1 columns, a header row skipped); importing keeps the rows already typed. The step's validation is a `superRefine` on the whole schema: findings for `checklist`, acceptance criteria for every other type.
- `firstInvalidStep` computes the first step whose fields are not yet valid; a deep link further than that is sent back. An unknown or inactive `?project=` clears the project and returns to step 0.
- "Next" validates only the current step's fields (`form.trigger(current.fields)`). "Back" uses history when there is an entry, otherwise it replaces the step; on step 0 it closes to home.
- The form's own URL changes (the step, and `?draft=` moving from nothing to a local id to the server id, with `replace` and no scroll reset) are built from the router's current location (`useLiveSearch`, through `UNSAFE_DataRouterContext`), not from the params of the current render: the router commits navigations as transitions, so a render for something else (a save that just finished) can still hold the previous step, and a URL built from it would undo the step just taken. Outside a data router it falls back to the render's params.
- `WizardSession` keeps the open form when `?draft=` moves because of the form itself or when going back through its own steps; any other draft, or a new-request link, starts a fresh form.

## Draft on this device

- `src/stores/draft.ts` keeps every unsubmitted draft of one person on this device under `draftsKey(userId)` = `ax-request-portal:drafts:<userId>`, as `{ v: 1, entries, aliases }`. It is kept apart from the wizard and the sync engine so the session can delete it without loading either; the wizard values inside are opaque to it.
- An entry (`LocalDraft`) is keyed by `localId`: a local id (`LOCAL_ID_PREFIX` `local-` plus random hex from `getRandomValues`, which works without a secure context) until the server has saved the draft, then the server id. It holds the step, the wizard values, `updatedAt`, `dirty`, the server link (`draftId`, `baseVersion`) and the sync's flags `conflict` and `limited`. An entry the server holds in full is deleted, so the device keeps only what the account does not have.
- `aliases` remember for 24 hours which server id (and version) a local id became, for a tab, a back button or a reload still holding the local id; `resolveDraftId` follows them. Entries and aliases are maps without inherited keys, read with `Object.hasOwn`, because ids come from links (`?draft=__proto__` finds nothing).
- Storage full: `putLocalDraft` first writes without the attachments' data (each inline attachment's `url` emptied, id and name kept, so the account copy keeps the attachment) and returns `withoutAttachments`; if that does not fit either, this tab keeps the change in memory (`failed`) and the sync still sends from that copy. `isStoredOnDevice` says whether storage holds this tab's last write. Each kind of failure shows one warning toast per visit.
- `subscribeLocalDrafts` reports changes made in this tab and in others (`storage` events).
- Signing out on purpose deletes everything this device keeps of the person's drafts (`clearDrafts`: the drafts, the pre-account draft and the list's remembered count); a session expiry keeps them ([Auth](02_auth.md)).
- The single draft kept before drafts were saved to the account (`legacyDraftKey` = `ax-request-portal:draft:<userId>`) is moved once into the store as a new unsent entry by `migrateLegacyDraft` when the sync starts; one with nothing written in it is just deleted.
- `readDraftValues` reads a stored draft with a shape-only schema (`DraftShape`, `.partial()`), never `WizardSchema.partial()`, which still enforces `min`/`refine` on present keys and would throw a normal half-written draft away. Missing keys are filled from `EMPTY_VALUES`, an empty criteria list becomes one blank row, and each attachment is checked against the contract's `Attachment` (its URL must pass `FileUrl`): one that fails is taken from the account's copy when it has it, otherwise dropped and named in a warning toast.

## Writing

- The form is written to this device after typing pauses for `DRAFT_SAVE_DELAY_MS` (300 ms), on every step change, when the tab is hidden (`visibilitychange`), on `pagehide` and when the wizard unmounts, because a phone may discard a hidden tab without warning. A new form gets a local id, and `?draft=local-…` in the URL, only once something is written (`hasWrittenContent`), so a reload offline still continues it.
- Nothing is written after the request is created or the draft deleted, or after a sign-out on purpose (`ended.reason === 'signedOut'`), so a pending write cannot bring the draft back.
- Another tab writing the same draft: when this screen has typed nothing since it last wrote or read the draft, it shows the other tab's words; when both have, it shows the conflict notice and writes nothing over the other tab's words until the person chooses.

## Saving to the account

- `DraftSyncEngine` (`src/features/drafts/sync-engine.ts`, no React; the rules are pure functions in `sync-core.ts`) sends the drafts on this device to the account one request at a time, so each update carries the version the previous answer gave. `draftSync(userId)` returns the tab's one engine for the signed-in person and stops the previous person's; asked for anyone else it returns an engine that sends nothing, and answers arriving after a sign-out or another sign-in change nothing.
- `useDraftSync`, rendered once in the signed-in shell for people with `request:create`, starts it: it moves the pre-account draft, sends what is waiting on start, when the connection comes back and when the page is hidden, and puts what the sync saved into the query cache (`storeSavedDraft`, `dropSavedDraft`).
- When it sends (`SyncTrigger`, `shouldSend`): `DRAFT_SYNC_DELAY_MS` (1 s) after a local write (`schedule`), and at once on a step change, on leaving the wizard, when the page is hidden, on start or sign-in, when back online and when an account slot frees up. A draft is never sent while it is in conflict, or while it is being submitted or deleted; one the account had no room for (`limited`) is not sent on typing pauses, only on the other triggers. At most five sends of one draft follow each other before it waits for the next trigger.
- What it sends (`requestFor`): a new draft is `POST /drafts` with `clientId` = its local id, so a create repeated after a lost answer gets back the draft the first one made (sent again over version 1 when that draft lacks what was sent); a linked draft is `PUT /drafts/{id}` with `baseVersion`. Attachments the server said it cannot find are left out of later sends.
- What the answer means (`outcomeOf`, `settle`):
  - saved, nothing typed since: the entry is deleted (the alias stays); typed since: it stays, under the server id, at the version answered, and is sent again;
  - `409 conflict`: the entry is marked `conflict` and waits for the person, unless another tab already moved its base version, then it is simply sent again;
  - `409 limit_reached`: the entry is marked `limited` and stays on this device;
  - `404`: the draft was deleted or submitted elsewhere; the entry is unlinked and sent as a new draft, and the wizard says so;
  - network, timeout, `5xx` or `401`: nothing changes until the next trigger;
  - a new draft saved for an entry that is gone by then (submitted, deleted, signed out of) or that another tab already saved as another draft is deleted at once.
- `useDraftSaveState` turns the entry and the engine's send state into `saving`, `saved`, `local` (this device only, sent when there is a connection), `limited`, `unsaved` (kept nowhere but on this screen) or `conflict`; `limited` wins over a send in progress.

## Opening a draft

- `openDraft` reads `?draft=`: absent is a new form; a value that cannot be an id (not `/^[A-Za-z0-9_-]{1,100}$/`) is not found; a local id opens this device's copy (not found without one); a server id shows a loading state, reads the draft (`GET /drafts/{id}`) and decides with `startServer`:
  - read, no unsent copy here: the account's version;
  - an unsent copy written over the version the account still has: the copy, sent soon; over an older version: a conflict, recorded on the entry, with the copy on screen;
  - `404` with a copy: the copy goes on as a new draft, with a notice; without one: "draft not found", with links to the saved drafts (`DRAFTS_LIST_PATH` = `/requests#drafts`) and to a new request;
  - not reachable with a copy: the copy; without one: `LoadFailed`.
- An account draft's attachments come from `SavedDraft.attachments` (those that still exist and are the caller's); ones it lists but the server no longer has are counted in a warning toast.

## Save state and notices

- `DraftStatusBar`, one line under the progress bar: the save state on the left ("Saving…", "Saved to your account", "Saved on this device only · uploads once you are online", "Saved on this device only", "Not saved · keep this screen open", "Save conflict"; the states that need the person in stronger type) and "Delete draft" on the right once there is something to delete. On a new, empty form the same line holds `DraftsNotice` (the drafts to continue; [My Requests](08_requests.md)) until a save state takes its place, so the form does not move.
- The line's live region is written from an effect, after mount, and only when a stable state other than `saving` changes: a screen reader hears once that the draft stopped reaching the account, not every retry while offline.
- `ConflictNotice`: "Save what is on this screen" (reads the latest version and writes over it) or "Load the saved version". Its title is a `p`, not a heading, because it sits above the step's `h1`; the section is labelled by it. `LimitNotice`: the account holds `drafts.maxPerAccount` drafts, with a link to the list. While either is shown, the step's `h1` is described by it (`aria-describedby` through the `StepNotice` context), so a screen reader hears it when the heading takes focus, also when the draft opens that way.
- After choosing, focus moves to the step's heading and a success toast says what happened. Loaded words go to the step they were saved on, but no further than they are complete (`firstInvalidStep`), and on the review step the precheck runs again.
- "Delete draft" opens a confirmation sheet that says where the draft is deleted from (this device and the account, or this device only when the account never had it), then deletes this device's copy and the account's (`useDiscardDraft`; an account copy already gone counts as deleted), retries drafts that were waiting for room, and opens a fresh form.

## Submission

- Submit first checks `firstInvalidStep` (loaded words may leave an earlier step incomplete), writes what is pending, then `engine.pause(key, DRAFT_SETTLE_TIMEOUT_MS)` holds the draft and waits up to 3 s for a send already on its way, so the request can name the account's draft. The body is `RequestSubmission`: the `RequestDraft` plus `draftId` when the account has the draft. The server deletes that draft in the same operation as creating the request; a refused submission leaves it.
- `useCreateRequest` takes `onCreated` / `onFailed` at hook level, so they run even when the wizard was left while the request was on its way. `onCreated` stops further writes, calls `engine.submitted(key, draftId)` (forgets the draft under every key it has had, and deletes an account draft a save created meanwhile that the request did not name) and shows the success toast; the hook drops the named draft from the cached lists. `onFailed` releases the hold. Only the move to `/requests/:id` (with replace) is per call.
- Submissions carry `CREATE_REQUEST_KEY`. A wizard opened while an earlier submission is still on its way shows a spinner ("Sending the request you submitted earlier…") and opens the form only when it has finished, so the old draft cannot be submitted twice.
- When the server cannot find attachments (expired, removed or someone else's upload), it answers `400` with `issues[].path = attachmentIds.<index>` (`attachmentNotFound`). `missingAttachmentIds` maps them back to ids: the toast names the files and offers a way to the attachment step, and `MissingAttachments` (an alert inside the wizard) lists them on the attachment and review steps, where each missing file is outlined until it is removed.

## Leaving

- Leaving for another path asks first (a sheet through `useBlocker`; reload or tab close through `beforeunload`) only when something is written (`hasWrittenContent`: title, descriptions, other targets, criteria, findings, out of scope, attachments or a desired date — not just a service, type or screen pick) and it would be lost: the write to this device failed and the account has no copy, or another tab's words are waiting for the person's choice. The pending write is flushed first. Otherwise leaving is free: the draft is on this device or in the account.
- It does not ask after a successful submission, while a submission is on its way (the hook finishes the job), or when another tab signed in as someone else (the new person must not continue another person's request).

## Focus

A layout effect on step change scrolls to the top and focuses the step heading (`StepTitle`, `tabIndex=-1`) before paint. A passive effect ran after the user had started typing in the first field and stole focus mid-input.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `usePrecheck` | `POST /requests/precheck` | `RequestDraft` → `{ issues: PrecheckIssue[] }` | Runs on entering the review step; each run clears the previous advice first. Issues are advice shown next to their fields (also on earlier steps); they never block submission. Failure shows an inline note with a "check again" button, no toast. Submit is disabled while it runs. |
| `useUploadAttachment` | `POST /attachments` (multipart, 120 s time limit) | `File` → `Attachment` | Files upload one by one; over 10 MB is rejected client-side with a toast. Only attachment ids are submitted, and only the uploader may attach an upload. |
| `useCreateRequest` | `POST /requests` (201) | `RequestSubmission` (project, type, title, targets, current/desired behaviour, 1–5 acceptance criteria — or, for `checklist`, `checklistSource` and 1–30 `checklist` items — out of scope, attachment ids, desired date and its reason; optional `draftId`) → `WorkRequest` | Success: `onRequestChanged`, the named draft leaves the drafts cache (`dropSavedDraft`), then the hook-level handling above. Failure: toast with the server message, or the missing-attachment handling. The server turns each finding into one acceptance criterion (`[number] fixed-when`, or the finding when that is empty). |
| `draftApi` (sync engine, through `call`) | `GET /drafts/{id}`, `POST /drafts` (201), `PUT /drafts/{id}` | `SavedDraftInput` (`step`, `content: DraftContent`, `clientId`) / `SavedDraftUpdate` (`step`, `content`, `baseVersion`) → `SavedDraft` | `409 conflict` (saved since `baseVersion`), `409 limit_reached` (create only), `404` (not the caller's, or gone), `400` with `content.attachmentIds.<i>` for a missing or someone else's attachment. Saves go to the cache through `storeSavedDraft`. |
| `useDiscardDraft` (through `useDeleteDraft`) | `DELETE /drafts/{id}` (204) | — | A `404` counts as deleted. This device's copy is deleted first; a failure rejects with the account copy still listed. |

There are no query hooks for saving a draft: the sync engine sends each draft's saves one after another itself, because a TanStack mutation scope is fixed per hook and cannot follow a draft whose id changes on its first save. The wizard reads the draft it opens under `keys.draft(id)`.

`DraftContent` has the `RequestDraft` fields with attachments as `attachmentIds`, every top-level field optional and empty values allowed; only abuse ceilings apply (`DRAFT_TEXT_MAX` 10,000 characters, `DRAFT_LIST_MAX` 50 items, `DRAFT_STEP_MAX` 6). `toDraftContent` cuts what would not fit instead of being refused; the device keeps the whole. A saved draft's id matches `DRAFT_ID_PATTERN` (1–100 letters, digits, `-` or `_`, never starting with `local-`). An account holds at most `appConfig.drafts.maxPerAccount` (20) drafts.

The desired-date input's minimum is today on the head-office business calendar (`hqToday`); a person whose clock differs sees the "dates follow head office" hint under it ([Glossary](../GLOSSARY.md)). If the project list cannot be loaded, the project step shows a compact `LoadFailed` with a retry, and a `?project=` preset is kept instead of cleared.

`toDraft` trims strings, turns empty values into `undefined`, drops empty criteria and finding rows, sends findings only for `checklist` (and no criteria then) and omits the date reason when there is no date. The precheck also flags a repeated finding number and a finding without "fixed when". The mock precheck (`precheckDraft`) is deterministic, recognises Korean and English text and answers in the request language; it also books a small light-model cost.

## Accessibility

Progress bar with `aria-valuenow`; project and type pickers are radio groups; target pickers are `aria-pressed` toggles; precheck results are a polite live region; Enter advances instead of submitting before the review step. The review summary is a `<dl>` whose groups hold only `<dt>` and `<dd>`: each row's edit button sits inside its `<dd>`. Draft notices describe the step heading, and the save line speaks only when a problem starts (see Save state and notices).

## Evidence

- `src/features/wizard/schema.ts#symbol:STEPS`, `src/features/wizard/schema.ts#symbol:firstInvalidStep`, `src/features/wizard/schema.ts#symbol:toDraft` — steps, deep-link guard, payload mapping.
- `src/features/wizard/schema.ts#symbol:readDraftValues`, `src/features/wizard/schema.ts#symbol:savedDraftValues`, `src/features/wizard/schema.ts#symbol:toDraftContent`, `src/features/wizard/schema.ts#symbol:draftContentOf`, `src/features/wizard/schema.ts#symbol:DRAFT_SAVE_DELAY_MS` — reading and writing draft content.
- `src/stores/draft.ts#symbol:draftsKey`, `src/stores/draft.ts#symbol:legacyDraftKey`, `src/stores/draft.ts#symbol:LocalDraft`, `src/stores/draft.ts#symbol:newLocalId`, `src/stores/draft.ts#symbol:resolveDraftId`, `src/stores/draft.ts#symbol:putLocalDraft`, `src/stores/draft.ts#symbol:isStoredOnDevice`, `src/stores/draft.ts#symbol:clearDrafts`, `src/stores/draft.ts#symbol:subscribeLocalDrafts`, `src/stores/draft.test.ts` — drafts on this device.
- `src/features/drafts/sync-core.ts#symbol:shouldSend`, `src/features/drafts/sync-core.ts#symbol:requestFor`, `src/features/drafts/sync-core.ts#symbol:outcomeOf`, `src/features/drafts/sync-core.ts#symbol:settle`, `src/features/drafts/sync-engine.ts#symbol:DraftSyncEngine`, `src/features/drafts/sync-engine.ts#symbol:DRAFT_SYNC_DELAY_MS`, `src/features/drafts/sync-core.test.ts`, `src/features/drafts/sync-engine.test.ts` — saving to the account.
- `src/features/drafts/sync.ts#symbol:draftSync`, `src/features/drafts/sync.ts#symbol:migrateLegacyDraft`, `src/features/drafts/sync.ts#symbol:DRAFT_SETTLE_TIMEOUT_MS`, `src/features/drafts/hooks.ts#symbol:useDraftSync`, `src/features/drafts/hooks.ts#symbol:useDraftSaveState`, `src/features/drafts/hooks.ts#symbol:useDiscardDraft` — the app's engine, its hooks and deleting.
- `src/features/wizard/schema.ts#symbol:hasWrittenContent`, `src/features/wizard/schema.ts#symbol:missingAttachmentIds` — leave confirmation and missing attachments.
- `src/features/wizard/wizard-page.tsx#symbol:WizardPage`, `src/features/wizard/wizard-page.tsx#symbol:WizardSession`, `src/features/wizard/wizard-page.tsx#symbol:WizardOpener`, `src/features/wizard/wizard-page.tsx#symbol:WizardForm`, `src/features/wizard/wizard-page.tsx#symbol:useLiveSearch` — URL state, opening, writing, conflicts, submission, leave confirmation.
- `src/features/wizard/draft-opening.ts#symbol:openDraft`, `src/features/wizard/draft-opening.ts#symbol:startServer` — what `?draft=` opens.
- `src/features/wizard/draft-status.tsx#symbol:DraftStatusBar`, `src/features/wizard/draft-status.tsx#symbol:ConflictNotice`, `src/features/wizard/draft-status.tsx#symbol:LimitNotice`, `src/features/wizard/draft-status.tsx#symbol:DRAFTS_LIST_PATH`, `src/features/wizard/step-notice.ts#symbol:StepNotice` — save state and notices.
- `src/features/wizard/steps.tsx#symbol:StepTitle`, `src/features/wizard/steps.tsx#symbol:MissingAttachments`, `src/features/wizard/steps.tsx#symbol:ReviewStep` — focus target, missing attachments, review list.
- `src/api/contract.ts#symbol:SavedDraft`, `src/api/contract.ts#symbol:DraftContent`, `src/api/contract.ts#symbol:RequestSubmission`, `src/api/contract.ts#symbol:DRAFT_ID_PATTERN` — the draft contract.
- `src/api/queries.ts#symbol:usePrecheck`, `src/api/queries.ts#symbol:useCreateRequest`, `src/api/queries.ts#symbol:CREATE_REQUEST_KEY`, `src/api/queries.ts#symbol:useUploadAttachment`, `src/api/queries.ts#symbol:storeSavedDraft`, `src/api/queries.ts#symbol:dropSavedDraft` — API calls and the drafts cache.
- `src/domain/precheck.ts#symbol:precheckDraft` — mock precheck rules.
- `src/mocks/engine.ts#symbol:publicAttachment` — uploads are stored with their owner, which the API never returns; `src/mocks/engine.ts#symbol:createDraft` — the mock's per-account drafts, `clientId` and limit.
- `src/features/wizard/wizard-page.test.tsx`, `src/features/wizard/schema.test.ts`, `src/mocks/api.test.ts`, `src/mocks/attachments.test.ts` — draft, submission and upload tests (the upload test runs in the Node environment: jsdom cannot parse multipart).
- `e2e/requester.spec.ts`, `e2e/drafts.spec.ts` — a draft saved to the account and continued after a reload, on another device and after signing out.

## Open Questions

- The mock keeps uploads up to `INLINE_UPLOAD_BYTES` (512 KB) that are images or PDFs as `data:` URLs in its persisted state (they survive a reload); anything else is an object URL for the session only, and a type a browser could run as a page is stored as `application/octet-stream` (`src/mocks/handlers.ts`). A real backend needs a storage decision and a request-size limit that matches nginx: the commented `/api/` proxy in `deploy/nginx.conf` sets `client_max_body_size 12m` for the 10 MB file cap.
- `useLiveSearch` relies on React Router's `UNSAFE_DataRouterContext`; check it when upgrading React Router's major version.
- Two tabs of one browser share one device copy of a draft: the conflict notice protects words both have typed, but the copy itself is last-writer-wins.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
