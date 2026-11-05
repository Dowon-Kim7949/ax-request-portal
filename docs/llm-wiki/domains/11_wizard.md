---
title: Request Wizard
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-05
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/wizard
  - src/domain/precheck.ts
  - src/stores/draft.ts
evidence:
  - src/features/wizard/schema.ts#symbol:STEPS
  - src/features/wizard/schema.ts#symbol:firstInvalidStep
  - src/features/wizard/schema.ts#symbol:toDraft
  - src/features/wizard/schema.ts#symbol:parseChecklist
  - src/features/wizard/schema.ts#symbol:restoreDraft
  - src/features/wizard/schema.ts#symbol:saveDraft
  - src/features/wizard/schema.ts#symbol:hasWrittenContent
  - src/features/wizard/schema.ts#symbol:missingAttachmentIds
  - src/features/wizard/schema.ts#symbol:DRAFT_SAVE_DELAY_MS
  - src/features/wizard/wizard-page.tsx#symbol:WizardPage
  - src/features/wizard/wizard-page.tsx#symbol:WizardForm
  - src/features/wizard/steps.tsx#symbol:StepTitle
  - src/features/wizard/steps.tsx#symbol:MissingAttachments
  - src/features/wizard/steps.tsx#symbol:ReviewStep
  - src/stores/draft.ts#symbol:draftKey
  - src/api/queries.ts#symbol:usePrecheck
  - src/api/queries.ts#symbol:useCreateRequest
  - src/api/queries.ts#symbol:CREATE_REQUEST_KEY
  - src/api/queries.ts#symbol:useUploadAttachment
  - src/domain/precheck.ts#symbol:precheckDraft
  - src/mocks/engine.ts#symbol:publicAttachment
  - src/features/wizard/wizard-page.test.tsx
  - src/features/wizard/schema.test.ts
  - src/mocks/attachments.test.ts
related:
  - docs/llm-wiki/domains/04_detail.md
  - docs/llm-wiki/domains/08_requests.md
  - docs/llm-wiki/WCAG.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Request Wizard

## Responsibility

Filing a new work request at `/requests/new` (`request:create`): seven steps, a local draft, a non-blocking precheck and submission. Everything after submission belongs to [Request Detail](04_detail.md). The route sets `handle.focus`, which hides the phone tab bar; the action bar is fixed at the bottom on phones and inline from `md` up.

## Steps and URL

- `STEPS`: `project`, `type`, `targets`, `describe`, `criteria`, `extra`, `review`. The current step is `?step=N` in the URL (non-integers become 0, values are clamped). `?project=<id>` without a step starts at step 1 with the project chosen.
- Choosing a project or a type advances immediately.
- For the `checklist` type (findings from an audit or inspection) the `criteria` step lists findings instead of acceptance criteria: an optional source, then up to `CHECKLIST_ITEMS_MAX` (30) items of number, clause, finding and "fixed when". Rows can be imported from a pasted table (`parseChecklist`: tab- or `|`-separated, 4 / 3 / 2 / 1 columns, a header row skipped); importing keeps the rows already typed. The step's validation is a `superRefine` on the whole schema: findings for `checklist`, acceptance criteria for every other type.
- `firstInvalidStep` computes the first step whose fields are not yet valid; a deep link further than that is sent back. An unknown or inactive `?project=` clears the project and returns to step 0.
- "Next" validates only the current step's fields (`form.trigger(current.fields)`). "Back" uses history when there is an entry, otherwise it replaces the step; on step 0 it closes to home.

## Draft

- The draft lives in `localStorage` under `draftKey(userId)` = `ax-request-portal:draft:<userId>` (per user; `src/stores/draft.ts`, kept apart from the wizard so signing out can delete it). Signing out on purpose deletes it; a session expiry keeps it ([Auth](02_auth.md)).
- Changes are saved after typing pauses for `DRAFT_SAVE_DELAY_MS` (300 ms), and at once when the tab is hidden (`visibilitychange`), on `pagehide` and when the wizard unmounts, because a phone may discard a hidden tab without warning. Nothing is written after the request is created or after a sign-out on purpose (`ended.reason === 'signedOut'`), so a pending save cannot bring the draft back.
- `saveDraft` returns `saved`, `withoutAttachments` (the quota was full, so the draft was kept without its attachments — demo uploads are `data:` URLs) or `failed`. Each of the two failures shows one non-blocking warning toast per visit.
- `restoreDraft` checks only the shape (`DraftShape`, a separate schema with `.partial()`), not the validation schema. `WizardSchema.partial()` still enforces `min`/`refine` on present keys, so a normal half-written draft (an empty description) would fail and be thrown away silently. Missing keys are filled from `EMPTY_VALUES`, an empty criteria list becomes one blank row, and each attachment is checked against the contract's `Attachment` (its URL must pass `FileUrl`): one that fails is dropped and named in a warning toast; the rest of the draft is kept.
- A restored draft shows a toast with a "discard" action, except when it is empty.

## Submission

- `useCreateRequest` takes `onCreated` / `onFailed` at hook level, so they run even when the wizard was left while the request was on its way. `onCreated` stops further draft writes, deletes the draft and shows the success toast; only the move to `/requests/:id` (with replace) is per call.
- Submissions carry `CREATE_REQUEST_KEY`. A wizard opened while an earlier submission is still on its way shows a spinner ("Sending the request you submitted earlier…") and opens the form only when it has finished, so the old draft cannot be submitted twice.
- When the server cannot find attachments (expired, removed or someone else's upload), it answers `400` with `issues[].path = attachmentIds.<index>` (`attachmentNotFound`). `missingAttachmentIds` maps them back to ids: the toast names the files and offers a way to the attachment step, and `MissingAttachments` (an alert inside the wizard) lists them on the attachment and review steps, where each missing file is outlined until it is removed.

## Leaving

- With something written (`hasWrittenContent`: title, descriptions, other targets, criteria, findings, out of scope, attachments or a desired date — not just a service, type or screen pick), leaving for another path opens a sheet (`useBlocker`) whose text follows the last save: kept as a draft, kept without attachments, or not saved. The pending save is flushed first. Reload or tab close asks through `beforeunload`.
- It does not ask after a successful submission, while a submission is on its way (the hook finishes the job), or when another tab signed in as someone else (the new person must not continue another person's request).

## Focus

A layout effect on step change scrolls to the top and focuses the step heading (`StepTitle`, `tabIndex=-1`) before paint. A passive effect ran after the user had started typing in the first field and stole focus mid-input.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `usePrecheck` | `POST /requests/precheck` | `RequestDraft` → `{ issues: PrecheckIssue[] }` | Runs on entering the review step; each run clears the previous advice first. Issues are advice shown next to their fields (also on earlier steps); they never block submission. Failure shows an inline note with a "check again" button, no toast. Submit is disabled while it runs. |
| `useUploadAttachment` | `POST /attachments` (multipart, 120 s time limit) | `File` → `Attachment` | Files upload one by one; over 10 MB is rejected client-side with a toast. Only attachment ids are submitted, and only the uploader may attach an upload. |
| `useCreateRequest` | `POST /requests` (201) | `RequestDraft` (project, type, title, targets, current/desired behaviour, 1–5 acceptance criteria — or, for `checklist`, `checklistSource` and 1–30 `checklist` items — out of scope, attachment ids, desired date and its reason) → `WorkRequest` | Success: `onRequestChanged`, then the hook-level handling above. Failure: toast with the server message, or the missing-attachment handling. The server turns each finding into one acceptance criterion (`[number] fixed-when`, or the finding when that is empty). |

The desired-date input's minimum is today on the head-office business calendar (`hqToday`); a person whose clock differs sees the "dates follow head office" hint under it ([Glossary](../GLOSSARY.md)). If the project list cannot be loaded, the project step shows a compact `LoadFailed` with a retry, and a `?project=` preset is kept instead of cleared.

`toDraft` trims strings, turns empty values into `undefined`, drops empty criteria and finding rows, sends findings only for `checklist` (and no criteria then) and omits the date reason when there is no date. The precheck also flags a repeated finding number and a finding without "fixed when". The mock precheck (`precheckDraft`) is deterministic, recognises Korean and English text and answers in the request language; it also books a small light-model cost.

## Accessibility

Progress bar with `aria-valuenow`; project and type pickers are radio groups; target pickers are `aria-pressed` toggles; precheck results are a polite live region; Enter advances instead of submitting before the review step. The review summary is a `<dl>` whose groups hold only `<dt>` and `<dd>`: each row's edit button sits inside its `<dd>`.

## Evidence

- `src/features/wizard/schema.ts#symbol:STEPS`, `src/features/wizard/schema.ts#symbol:firstInvalidStep`, `src/features/wizard/schema.ts#symbol:toDraft` — steps, deep-link guard, payload mapping.
- `src/features/wizard/schema.ts#symbol:restoreDraft`, `src/features/wizard/schema.ts#symbol:saveDraft`, `src/features/wizard/schema.ts#symbol:DRAFT_SAVE_DELAY_MS`, `src/stores/draft.ts#symbol:draftKey` — draft storage.
- `src/features/wizard/schema.ts#symbol:hasWrittenContent`, `src/features/wizard/schema.ts#symbol:missingAttachmentIds` — leave confirmation and missing attachments.
- `src/features/wizard/wizard-page.tsx#symbol:WizardPage`, `src/features/wizard/wizard-page.tsx#symbol:WizardForm` — URL state, waiting for an earlier submission, draft saving, leave confirmation.
- `src/features/wizard/steps.tsx#symbol:StepTitle`, `src/features/wizard/steps.tsx#symbol:MissingAttachments`, `src/features/wizard/steps.tsx#symbol:ReviewStep` — focus target, missing attachments, review list.
- `src/api/queries.ts#symbol:usePrecheck`, `src/api/queries.ts#symbol:useCreateRequest`, `src/api/queries.ts#symbol:CREATE_REQUEST_KEY`, `src/api/queries.ts#symbol:useUploadAttachment` — API calls.
- `src/domain/precheck.ts#symbol:precheckDraft` — mock precheck rules.
- `src/mocks/engine.ts#symbol:publicAttachment` — uploads are stored with their owner, which the API never returns.
- `src/features/wizard/wizard-page.test.tsx`, `src/features/wizard/schema.test.ts`, `src/mocks/attachments.test.ts` — draft, submission and upload tests (the upload test runs in the Node environment: jsdom cannot parse multipart).

## Open Questions

- The mock keeps uploads up to `INLINE_UPLOAD_BYTES` (512 KB) that are images or PDFs as `data:` URLs in its persisted state (they survive a reload); anything else is an object URL for the session only, and a type a browser could run as a page is stored as `application/octet-stream` (`src/mocks/handlers.ts`). A real backend needs a storage decision and a request-size limit that matches nginx: the commented `/api/` proxy in `deploy/nginx.conf` sets `client_max_body_size 12m` for the 10 MB file cap.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
