---
title: LLM-WIKI README
tags:
  - llm-wiki
  - verified
status: verified
doc_type: wiki_readme
project: ax-request-portal
last_updated: 2026-11-05
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - llm-wiki.config.json
  - .prettierignore
  - CLAUDE.md
evidence:
  - .github/workflows/llm-wiki.yml#L42-L46

related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/project-profile.md
  - docs/llm-wiki/log.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-09
---

# LLM-WIKI README

This directory is shared knowledge for people and coding agents working on `ax-request-portal`. It is maintained with [llm-wiki-governance](https://www.npmjs.com/package/llm-wiki-governance), installed as a dev dependency.

## Operating Rules

- Every wiki document has YAML frontmatter. This repository is public, so documents use `visibility: public` and must never contain secrets, internal hostnames, or real people's names or e-mail addresses.
- Documents created or edited by the CLI or an agent stay `needs_review`. Only a person promotes a document with `npx llm-wiki review --approve <path>`; the tool records who approved but cannot prove it.
- Claims cite their sources: broad ones in `source_files`, precise ones in `evidence` (`path#symbol:Name`, `path#L10-L20`) mirrored in the body's `## Evidence` section. Uncertain points go under `## Open Questions` instead of being guessed.
- Record changes append-only in [log.md](log.md).
- Write the durable conclusion here; keep the story of how it was found in the issue or pull request.

## Commands

- `npx llm-wiki validate --strict --agent claude` — structure, frontmatter and evidence locators (what CI runs).
- `npx llm-wiki impact --since origin/main --strict` — which `verified` documents a diff makes stale (CI fails on them).
- `npx llm-wiki search-docs "<query>"`, `npx llm-wiki get-doc <path> --section "<heading>"` — read only what a task needs.
- `npx llm-wiki init --write --agent claude --refresh` — regenerate the agent skills after changing the governance mode.

Use the short `npx llm-wiki` only after `npm ci`; without the local install it would fetch an unrelated npm package of that name.

## Files the tool manages

`CLAUDE.md` (the adapter block), `.claude/skills/llm-wiki-*`, `.llm-wiki/prompts/` and `llm-wiki.config.json` are written by the CLI and excluded from Prettier so the two do not fight. `.claude/worktrees/` (other checkouts that agent workflows create inside this one) is excluded too, so `npm run verify` checks only this checkout.

## Citing without false alarms

A file listed in `source_files` is watched as a whole: once a document is `verified`, any change to that file makes CI demand a document update. Files that change for unrelated reasons — `package.json` on every dependency bump, workflow files on every GitHub Actions bump — are therefore cited only by line range in `evidence` (for example `package.json#L14-L16` for `engines`). A file cited only by line ranges is compared region by region, so only a change to the cited lines counts.

## Evidence

- `.github/workflows/llm-wiki.yml#L42-L46` — the CI steps: locked CLI version, frontmatter, strict validation, the undocumented-change gate.
- `llm-wiki.config.json` — governance mode and the `impact.source_changed` rule.
- `.prettierignore`, `CLAUDE.md` — tool-managed files and agent worktrees kept out of Prettier; the agent adapter.
