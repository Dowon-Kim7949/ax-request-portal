---
name: llm-wiki-fix
description: Fix a bug grounded in the project's LLM-WIKI, then update the wiki (needs_review).
estimated-tokens: 1297 # chars/4 proxy of the skill body, not a measured token count
---

Get the current wiki map at RUN TIME (not a snapshot): run `llm-wiki prepare --task "<the task>" --compact` (or `llm-wiki onboard --domain <area>`), then read the docs it points to and confirm against the source.

You are a senior engineer working in an LLM-WIKI-enabled project.

Task:
Run a post-wiki bug fix workflow. The project type is frontend. Active profiles: core, frontend.

Goal:
Read docs/llm-wiki/index.md first. Inspect actual source files before making claims or code changes. Make the requested code change with the smallest safe scope, grounded in the wiki and verified against the actual source. Update every affected LLM-WIKI document in the same task, so the wiki keeps telling the truth about the code.

Hard lines (never cross these):
Documentation language: write all LLM-WIKI document content — prose, headings, summaries, review notes, and the log.md entry — in English. Keep technical identifiers (paths, code symbols, JSON keys, frontmatter fields, status values, CLI commands, and evidence locators) unchanged.
- If the docs conflict with the code, or the scope grows beyond what was asked, STOP and confirm with a human before implementing. When the scope is unclear, scope it first with 'llm-wiki prepare --task "<the task>"' (or the /llm-wiki-prepare skill).
- Keep CLI-created or agent-edited wiki documents as status: needs_review; do not promote any document to verified — verified is human-approved only.
- Never write sensitive raw values into documents, logs, or reports.
Context budget (spend tokens on evidence, not on volume):
- Locate before reading: search/grep, or 'llm-wiki prepare --task "<the task>" --compact', then open only what the task needs.
- Read a large file by line range or section instead of whole; for wiki docs use 'llm-wiki get-doc <path> --section "<heading>" --strict-section --max-chars <n>'.
- Never trade evidence for brevity: read a file in full when the change depends on it, and read more whenever narrowing would leave a claim unverified.
- Report tests as the failures plus the summary line (prefer the project's quiet/compact reporter when it has one), not the full passing output.
Governance budget (standard — protect the knowledge that outlives this change):
- Update the wiki when the change moves a domain concept, an architectural boundary, a public contract, or a recorded constraint, or implements a requirement document (link its source and tests in that document's evidence). Skip the doc work for a local refactor that leaves all of those intact, and say you skipped it.
- Inspect only the documents this change affects — scope them with 'llm-wiki impact --since <ref>' or 'llm-wiki prepare --task "<the task>" --compact'. A repository-wide audit is a separate explicit action.
- Keep the source_files and evidence anchors of the documents you touch accurate; leave the rest alone.
- Generated for governance mode standard; 'llm-wiki mode' shows the current one, and 'llm-wiki init --write --skills --refresh' regenerates this workflow after a change.

Exit criteria (done means all of these):
- The requested change is implemented and verified against the actual source.
- Every affected LLM-WIKI document is updated in the same task.
- Append docs/llm-wiki/log.md in append-only style with changed files, evidence, caveats, and review notes.
- Relevant tests ran, or the reason they were not run is stated exactly.

How you work between those lines — reading order, planning depth, edit sequence — is your call; the goal and the exit criteria are the contract.

When a domain document mentions API usage, include this API Services inventory:
- API service name.
- Endpoint or client module.
- HTTP method or call signature.
- Request params or payload.
- Response shape.
- Auth, session, token, or cookie dependency.
- Error handling.
- Retry or timeout behavior.
- Cache or state update behavior.
- Related UI or domain workflow.
- `source_files` evidence, plus optional `evidence` references for specific files, lines, symbols, sections, or routes; mirror precise references in the body `## Evidence` section.

Expected final response:
- Changed files.
- Source evidence inspected.
- Tests run and results.
- Wiki docs updated.
- Remaining review items or caveats.

Completion contract (Gate 26 — enables 'llm-wiki check-run'): after finishing, write .llm-wiki/runs/run-fix-<timestamp>.json with fields: task="fix", changedSource[] (source files you edited), touchedDocs[] (docs/llm-wiki/* you updated), logAppended (bool), validated {ran, result}, testEvidence {red, green} (test name/summary failing before your change, passing after — red -> green; no secrets). Then run 'llm-wiki check-run' to confirm each changed source is referenced by a touched doc, the log was appended, and validate passed. Keep the manifest small: those fields are the whole contract and check-run reads no others — an optional summary is fine at two sentences or less, and you should never paste diffs, file contents, logs, or test output into it (the wiki and docs/llm-wiki/log.md are where the narrative belongs). This records what the run did — it never replaces human review and never promotes a document to verified.

<!-- llm-wiki-generated v5 26832c40f2bda6f0 -->
