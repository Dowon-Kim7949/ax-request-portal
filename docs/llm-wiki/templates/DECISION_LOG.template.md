---
title: Decision Log.template
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: template
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: llm-wiki-cli
wiki_block_version: v1
source_files:

evidence:

related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/log.md
visibility: public
contains_sensitive_info: false
---

# ADR-NNNN: Decision Title

Copy this template to `docs/llm-wiki/decisions/ADR-NNNN-<short-slug>.md` for each architecture decision. Set `title` and `doc_type: decision` in the copy's frontmatter and keep `status: needs_review` until a human reviews it.

## Decision Status

- Proposed | Accepted | Superseded by ADR-NNNN — the decision's own state, separate from the document's review `status`.

## Context

- The problem, the forces, and the constraints that made a decision necessary. Link the requirements it serves.

## Decision

- Concise summary: describe what was decided, stated so a reader can check code against it.

## Alternatives Considered

- Each option that was rejected, and why.

## Consequences

- What becomes easier, what becomes harder, and what must now stay true.

## Evidence

- Planned knowledge: an ADR may cite no source while the decision is not implemented. Approving it (`verified`) records that the decision was accepted, not that code follows it.
- When code implements the decision, list the implementing files in frontmatter `evidence` (for example `src/<module>.ts`) and here; drift and impact then flag the ADR when that code changes.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.

