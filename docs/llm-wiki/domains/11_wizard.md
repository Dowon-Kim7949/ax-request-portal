---
title: Request Wizard
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-04
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/wizard
  - src/domain/precheck.ts
evidence:
  - src/features/wizard/schema.ts#symbol:STEPS
  - src/features/wizard/schema.ts#symbol:firstInvalidStep
  - src/features/wizard/schema.ts#symbol:toDraft
  - src/features/wizard/schema.ts#symbol:parseChecklist
  - src/features/wizard/wizard-page.tsx#symbol:WizardPage
  - src/features/wizard/wizard-page.tsx#symbol:loadDraft
  - src/features/wizard/steps.tsx#symbol:StepTitle
  - src/api/queries.ts#symbol:usePrecheck
  - src/api/queries.ts#symbol:useCreateRequest
  - src/api/queries.ts#symbol:useUploadAttachment
  - src/domain/precheck.ts#symbol:precheckDraft
related:
  - docs/llm-wiki/domains/04_detail.md
  - docs/llm-wiki/domains/08_requests.md
  - docs/llm-wiki/WCAG.md
visibility: public
contains_sensitive_info: false
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

- Every change is saved to `localStorage` under `ax-request-portal:draft:<userId>` (per user). A full storage quota is ignored.
- `loadDraft` checks only the shape (`DraftShape`, a separate schema with `.partial()`), not the validation schema. `WizardSchema.partial()` still enforces `min`/`refine` on present keys, so a normal half-written draft (an empty description) would fail and be thrown away silently. Missing keys are filled from `EMPTY_VALUES` and an empty criteria list becomes one blank row.
- A restored draft shows a toast with a "discard" action, except when it is empty. A successful submission clears it.

## Focus

A layout effect on step change scrolls to the top and focuses the step heading (`StepTitle`, `tabIndex=-1`) before paint. A passive effect ran after the user had started typing in the first field and stole focus mid-input.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `usePrecheck` | `POST /requests/precheck` | `RequestDraft` → `{ issues: PrecheckIssue[] }` | Runs once on entering the review step. Issues are advice shown next to their fields (also on earlier steps); they never block submission. Failure shows an inline note, no toast. Submit is disabled while it runs. |
| `useUploadAttachment` | `POST /attachments` (multipart) | `File` → `Attachment` | Files upload one by one; over 10 MB is rejected client-side with a toast. Only attachment ids are submitted. |
| `useCreateRequest` | `POST /requests` (201) | `RequestDraft` (project, type, title, targets, current/desired behaviour, 1–5 acceptance criteria — or, for `checklist`, `checklistSource` and 1–30 `checklist` items — out of scope, attachment ids, desired date and its reason) → `WorkRequest` | Success: `onRequestChanged`, clear draft, toast, navigate to `/requests/:id` with replace. Failure: toast with the server message. The server turns each finding into one acceptance criterion (`[number] fixed-when`, or the finding when that is empty). |

`toDraft` trims strings, turns empty values into `undefined`, drops empty criteria and finding rows, sends findings only for `checklist` (and no criteria then) and omits the date reason when there is no date. The precheck also flags a repeated finding number and a finding without "fixed when". The mock precheck (`precheckDraft`) is deterministic, recognises Korean and English text and answers in the request language; it also books a small light-model cost.

## Accessibility

Progress bar with `aria-valuenow`; project and type pickers are radio groups; target pickers are `aria-pressed` toggles; precheck results are a polite live region; Enter advances instead of submitting before the review step.

## Evidence

- `src/features/wizard/schema.ts#symbol:STEPS`, `src/features/wizard/schema.ts#symbol:firstInvalidStep`, `src/features/wizard/schema.ts#symbol:toDraft` — steps, deep-link guard, payload mapping.
- `src/features/wizard/wizard-page.tsx#symbol:WizardPage`, `src/features/wizard/wizard-page.tsx#symbol:loadDraft` — URL state and draft restore.
- `src/features/wizard/steps.tsx#symbol:StepTitle` — focus target.
- `src/api/queries.ts#symbol:usePrecheck`, `src/api/queries.ts#symbol:useCreateRequest`, `src/api/queries.ts#symbol:useUploadAttachment` — API calls.
- `src/domain/precheck.ts#symbol:precheckDraft` — mock precheck rules.

## Open Questions

- The mock keeps small uploads as `data:` URLs in its persisted state (they survive a reload) and larger ones as object URLs that last for the session only (`src/mocks/handlers.ts`, `INLINE_UPLOAD_BYTES`). A real backend needs a storage decision and a request-size limit that matches nginx: the commented `/api/` proxy in `deploy/nginx.conf` sets `client_max_body_size 12m` for the 10 MB file cap.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
