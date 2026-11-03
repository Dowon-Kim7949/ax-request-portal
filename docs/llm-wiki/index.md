---
title: LLM-WIKI Index
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: wiki_index
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - llm-wiki.config.json
evidence:

related:
  - docs/llm-wiki/README.md
  - docs/llm-wiki/project-profile.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/GLOSSARY.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/profiles/frontend.md
  - docs/llm-wiki/COMPONENT_INVENTORY.md
  - docs/llm-wiki/WCAG.md
  - docs/llm-wiki/E2E_WORKFLOWS.md
  - docs/llm-wiki/log.md
visibility: public
contains_sensitive_info: false
---

# LLM-WIKI Index

The entry point to this project's LLM-WIKI: what an agent should know about `ax-request-portal` that it cannot cheaply re-derive from the code. Every claim cites its source files.

## Status

- Every document is `needs_review` until a person approves it with `npx llm-wiki review --approve <path>`. Agents never approve their own edits.
- Governance mode is `standard`, and `impact.source_changed` is an error (`llm-wiki.config.json`): once a document is `verified`, a pull request that changes a source file it cites must update the document too, or CI fails (`.github/workflows/llm-wiki.yml`).

## Recommended Read Order

1. [Project Profile](project-profile.md) — what this is, stack, commands.
2. [Domain Overview](domains/00_overview.md) — the request lifecycle and the map of domains.
3. [Architecture Conventions](ARCHITECTURE_CONVENTIONS.md) — module layout, contract, cache, mock mode, config, i18n, build.
4. The domain document for the area you will change.
5. Before UI work: [Frontend Profile](profiles/frontend.md), [Component Inventory](COMPONENT_INVENTORY.md), [Accessibility](WCAG.md).
6. Before touching tests: [E2E Workflows](E2E_WORKFLOWS.md).

## Map

| Area | Documents |
| --- | --- |
| Product | [Domain Features](DOMAIN_FEATURES.md), [Glossary](GLOSSARY.md) |
| Identity | [Auth](domains/02_auth.md), [Login](domains/06_login.md) |
| Requester | [Home](domains/05_home.md), [Request Wizard](domains/11_wizard.md), [My Requests](domains/08_requests.md), [Request Detail](domains/04_detail.md) |
| Developer | [Developer Work](domains/12_work.md), [Release Schedule](domains/09_schedule.md) |
| Executive and admin | [Executive Dashboard](domains/03_dashboard.md), [Admin](domains/01_admin.md) |
| Operator | [AI Operations](domains/13_ops.md) |
| Everyone | [Notifications](domains/07_notifications.md), [Settings](domains/10_settings.md) |
| Front-end rules | [Frontend Profile](profiles/frontend.md), [Component Inventory](COMPONENT_INVENTORY.md), [Accessibility](WCAG.md), [E2E Workflows](E2E_WORKFLOWS.md) |
| Wiki itself | [README](README.md), [Change Log](log.md) |
