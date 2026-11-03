# llm-wiki-bootstrap

<!-- estimated-tokens: 1515 (chars/4 proxy of the skill body, not a measured token count) -->

> Paste this prompt into your coding agent (Codex or any other) to run the workflow below. It is an instruction for the agent, not run by the CLI.

Project domain map (read the relevant one(s) FIRST before editing):
- Admin — docs/llm-wiki/domains/01_admin.md
- Auth — docs/llm-wiki/domains/02_auth.md
- Dashboard — docs/llm-wiki/domains/03_dashboard.md
- Detail — docs/llm-wiki/domains/04_detail.md
- Home — docs/llm-wiki/domains/05_home.md
- Login — docs/llm-wiki/domains/06_login.md
- Notifications — docs/llm-wiki/domains/07_notifications.md
- Requests — docs/llm-wiki/domains/08_requests.md
- Schedule — docs/llm-wiki/domains/09_schedule.md
- Settings — docs/llm-wiki/domains/10_settings.md
- Wizard — docs/llm-wiki/domains/11_wizard.md
- Work — docs/llm-wiki/domains/12_work.md

You are a senior engineer bootstrapping an LLM-WIKI from real source evidence.

Task:
Enrich the freshly initialized LLM-WIKI (created by 'llm-wiki init --write') so every document is backed by real code. The project type is frontend. Active profiles: core, frontend.
Preconditions: this runs after init has generated docs/llm-wiki/index.md, the core/profile documents, and (when detected) docs/llm-wiki/domains/*.md.

Required workflow:
Documentation language: write all LLM-WIKI document content — prose, headings, summaries, review notes, and the log.md entry — in English. Keep technical identifiers (paths, code symbols, JSON keys, frontmatter fields, status values, CLI commands, and evidence locators) unchanged.
1. Read the nearest AGENTS.md (or your agent's instruction file) and docs/llm-wiki/index.md first.
2. Review the init-generated documents and their source_files to see what still needs grounding.
3. Investigate the actual code, config, routing, public APIs, data models, and key workflows before making any claim.
Frontend evidence focus:
- Inspect routes, pages, components, state management, API clients, accessibility behavior, and end-to-end user workflows.
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
4. Replace placeholder content with descriptions backed by real source evidence. Do not guess — leave anything uncertain as an explicit review item instead of inventing detail.
5. For backend/fullstack projects, also enrich the related docs/llm-wiki/domains/*.md documents.
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
6. Tidy the related frontmatter entries and local Markdown links between related documents.
7. Record broad evidence in source_files and precise evidence in the frontmatter evidence entries, mirrored in the body ## Evidence section.
8. Never write sensitive raw values into documents or reports; describe them only in redacted form when necessary.
9. Keep every created or edited wiki document at status: needs_review.
10. Do not promote anything to verified — verified is human-approved only.
11. Append docs/llm-wiki/log.md in append-only style with the changed files, evidence, caveats, and remaining review items.
12. When finished, run the appropriate validate / audit / stats checks and summarize the results, and call out the areas with thin or missing evidence and the items a human must review before verified.

Expected final response:
- Changed wiki docs (and any domain docs enriched).
- Source evidence inspected.
- validate / audit / stats run and results.
- Areas with thin or missing evidence, and items a human must review before verified.

Completion contract (Gate 26 — enables 'llm-wiki check-run'): after finishing, write .llm-wiki/runs/run-bootstrap-<timestamp>.json with fields: task="bootstrap", changedSource[] (source files you edited), touchedDocs[] (docs/llm-wiki/* you updated), logAppended (bool), validated {ran, result}. Then run 'llm-wiki check-run' to confirm each changed source is referenced by a touched doc, the log was appended, and validate passed. Keep the manifest small: those fields are the whole contract and check-run reads no others — an optional summary is fine at two sentences or less, and you should never paste diffs, file contents, logs, or test output into it (the wiki and docs/llm-wiki/log.md are where the narrative belongs). This records what the run did — it never replaces human review and never promotes a document to verified.

<!-- llm-wiki-generated v5 75626119517c7f92 -->
