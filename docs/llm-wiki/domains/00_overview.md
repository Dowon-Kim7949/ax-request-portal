---
title: Domain Overview
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain_overview
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/domain/lifecycle.ts
  - src/domain/model.ts
  - src/app/router.tsx
evidence:
  - src/domain/lifecycle.ts#L34-L48
  - src/domain/lifecycle.ts#symbol:turnOf
  - src/domain/lifecycle.ts#symbol:STAGES
  - src/domain/lifecycle.ts#symbol:TERMINAL_STATUSES
  - src/domain/model.ts#symbol:RequestStatus
  - src/app/router.tsx#symbol:routes
related:
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/GLOSSARY.md
  - docs/llm-wiki/domains/01_admin.md
  - docs/llm-wiki/domains/02_auth.md
  - docs/llm-wiki/domains/03_dashboard.md
  - docs/llm-wiki/domains/04_detail.md
  - docs/llm-wiki/domains/05_home.md
  - docs/llm-wiki/domains/06_login.md
  - docs/llm-wiki/domains/07_notifications.md
  - docs/llm-wiki/domains/08_requests.md
  - docs/llm-wiki/domains/09_schedule.md
  - docs/llm-wiki/domains/10_settings.md
  - docs/llm-wiki/domains/11_wizard.md
  - docs/llm-wiki/domains/12_work.md
visibility: public
contains_sensitive_info: false
---

# Domain Overview

## The product in one paragraph

A person asks for a change to an internal system in plain language. An AI agent reads the project's code and its LLM-WIKI and writes a feasibility report. A developer decides: ask a question, reject, or let the AI do the work. The AI opens a merge request; the developer reviews it; the requester checks each acceptance criterion; the developer schedules and marks the release. Every step is a lifecycle event, and the UI only offers the events the current user may fire.

## Request lifecycle

Twelve statuses (`RequestStatus`) and thirteen events (`TRANSITIONS` in `src/domain/lifecycle.ts`, the single source of truth for both the UI and the mock server):

| Event | From | To | By |
| --- | --- | --- | --- |
| `startReport` | `submitted` | `reporting` | system |
| `reportReady` | `reporting` | `review` | ai |
| `requestInfo` | `review` | `info_needed` | developer |
| `provideInfo` | `info_needed` | `reporting` (the report is regenerated) | requester |
| `reject` | `review`, `info_needed` | `rejected` | developer |
| `runWork` | `review`, `changes_requested` | `in_progress` | developer |
| `workFinished` | `in_progress` | `code_review` | ai |
| `requestRevision` | `code_review` | `in_progress` | developer |
| `approveMerge` | `code_review` | `verification` | developer |
| `reportIssue` | `verification` | `changes_requested` | requester |
| `confirmResult` | `verification` | `release_scheduled` | requester |
| `markReleased` | `release_scheduled` | `done` | developer |
| `cancel` | `submitted`, `reporting`, `review`, `info_needed` | `cancelled` | requester |

- Terminal statuses: `done`, `rejected`, `cancelled`.
- `turnOf(status)` says whose move it is (requester, developer, ai, none); lists and the home page use it for "your turn".
- `STAGES` folds the statuses into seven progress stages for the stepper; exceptions stay on the stage where they happened.
- Guards: `confirmResult` needs every acceptance criterion passed, `reportIssue` at least one failed.
- Only the ten human events can be sent by the client (`TransitionCommand`); `ai` and `system` events happen on the server (in the template, on a timer in the mock).

## Domains

| Document | Route(s) | Who |
| --- | --- | --- |
| [Auth](02_auth.md) | guards, session, permissions | everyone |
| [Login](06_login.md) | `/login` | anonymous |
| [Home](05_home.md) | `/` | everyone, composed by permission |
| [Request Wizard](11_wizard.md) | `/requests/new` | `request:create` |
| [My Requests](08_requests.md) | `/requests` | `request:read:own` |
| [Request Detail](04_detail.md) | `/requests/:id` | readers of the request |
| [Developer Work](12_work.md) | `/work`, `/work/regression`, developer panels | `request:review`, `regression:view` |
| [Release Schedule](09_schedule.md) | `/schedule` | `schedule:view` |
| [Executive Dashboard](03_dashboard.md) | `/dashboard` | `dashboard:view` |
| [Admin](01_admin.md) | `/admin/projects`, `/admin/users`, `/admin/budget` | `project:manage`, `user:manage`, `budget:manage` |
| [Notifications](07_notifications.md) | `/notifications` | everyone |
| [Settings](10_settings.md) | `/settings` | everyone |

## API Services

All 28 endpoints are declared once in `src/api/contract.ts` and published as `docs/openapi.json`; each domain document lists the ones it uses. Cross-domain cache rule: every mutation that changes a request calls `onRequestChanged`, which replaces that request in the cache and invalidates request lists, the regression queue, notifications, the dashboard and the release schedule. See [Architecture Conventions](../ARCHITECTURE_CONVENTIONS.md).

## Evidence

- `src/domain/lifecycle.ts#L34-L48` — the transition table above.
- `src/domain/lifecycle.ts#symbol:turnOf`, `src/domain/lifecycle.ts#symbol:STAGES`, `src/domain/lifecycle.ts#symbol:TERMINAL_STATUSES` — turn, stage and terminal rules.
- `src/domain/model.ts#symbol:RequestStatus` — the twelve statuses.
- `src/app/router.tsx#symbol:routes` — routes and permissions.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
