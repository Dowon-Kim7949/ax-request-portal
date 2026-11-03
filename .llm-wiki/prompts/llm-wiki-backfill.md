# llm-wiki-backfill

<!-- estimated-tokens: 1727 (chars/4 proxy of the skill body, not a measured token count) -->

> Paste this prompt into your coding agent (Codex or any other) to run the workflow below. It is an instruction for the agent, not run by the CLI.

Get the current wiki map at RUN TIME (not a snapshot): run `llm-wiki prepare --task "<the task>" --compact` (or `llm-wiki onboard --domain <area>`), then read the docs it points to and confirm against the source.

You are a senior engineer reconstructing an LLM-WIKI from the repository as it stands today, so this project can be handed to someone else.

Task:
Recover as many EVIDENCE-BACKED facts about this project as possible, and clearly identify what cannot be recovered. The project type is frontend. Active profiles: core, frontend. Governance mode: standard.
Preconditions: run 'llm-wiki backfill' first and use its inventory, coverage, evidence ledger, and readiness report as your starting map. 'llm-wiki backfill --write' creates the missing document stubs; this workflow fills them.

What this task IS and IS NOT:
- It IS: recover what the repository can prove, and name what it cannot.
- It is NOT: produce a complete and convincing story about the project. A plausible history that nobody can verify is worse than an admitted gap, because the next developer will act on it.

Evidence ladder (prefer the higher source; never let a lower one contradict a higher one):
1. current source code — what the system does today
2. tests — the behavior somebody committed to
3. configuration and manifests — how it is built, wired, and deployed
4. existing wiki documents — a compressed map, not an authority
5. ADRs / decision records — the only real source for WHY
6. git commit messages — intent where the author recorded it
7. git diff / history — what changed and when, not why
8. locally available issue/PR metadata — context where present, if any

Label every claim you write with one of three confidence levels, and keep them apart:
- verified: read directly from the current source, tests, or configuration. Cite the file (and symbol or line range) in source_files / evidence.
- inferred: derived from directory boundaries, naming, or history. Write it as inferred, in the sentence itself ("inferred from commit history"), never as plain fact.
- unknown: the repository cannot answer it. Say so in the document, and leave it as an open review item.

Documentation language: write all LLM-WIKI document content — prose, headings, summaries, review notes, and the log.md entry — in English. Keep technical identifiers (paths, code symbols, JSON keys, frontmatter fields, status values, CLI commands, and evidence locators) unchanged.
1. Read docs/llm-wiki/index.md and the 'llm-wiki backfill' report first, then work the gaps it names.
2. Establish CURRENT behavior before anything historical: entrypoints, architecture, data flow, external integrations, public contracts, configuration, and the business rules the code actually enforces.
3. Rebuild the source mapping as you go: broad evidence in source_files, precise references in the frontmatter evidence entries, mirrored in the body ## Evidence section. A document with no source mapping is not finished.
4. For each domain the report lists as a source boundary with no document, describe what the code in it does. The boundary is evidence; the business MEANING of the domain is not — mark it inferred unless a test, a contract, or a document confirms it.
5. Then, and only then, attempt history. Look for ADRs, decision records, and commit messages that recorded a rationale. Where one exists, cite the commit or the document. Where none exists, write "Decision reason: unknown" and stop — do NOT reconstruct a rationale from file layout, naming, dependency choices, or commit subjects.
6. Never present the ABSENCE of evidence as evidence. "No ADR exists for this" is a fact; "this was probably chosen for performance" is an invention.
7. Cover the handoff areas the report and the profile documents ask for, ONLY where evidence exists: purpose, technology stack, local setup, build/run, deployment, directory and architecture overview, important source locations, core domain concepts, major data flows, external integrations, API usage, state management, important business rules, operational constraints, known issues, technical debt, recorded decisions, and open items. Where a section has no evidence, keep the section and record it as unknown rather than deleting it or filling it in.
8. Produce an explicit "Unknown / needs human confirmation" list — the questions only the outgoing maintainer can answer. This list is a deliverable, not a failure.
9. Never write sensitive raw values into documents or reports; describe them only in redacted form when necessary.
10. Keep every created or edited wiki document at status: needs_review.
11. Do not promote anything to verified — verified is human-approved only, and a reconstructed document is precisely the kind that needs a human to read it.
12. Append docs/llm-wiki/log.md in append-only style with the documents touched, the evidence used, what stayed inferred, and what stayed unknown.
13. Finish by running 'llm-wiki backfill' again (add --strict for the pre-handoff gate) and report which readiness checks are now complete and which are not.
Context budget (spend tokens on evidence, not on volume):
- Locate before reading: search/grep, or 'llm-wiki prepare --task "<the task>" --compact', then open only what the task needs.
- Read a large file by line range or section instead of whole; for wiki docs use 'llm-wiki get-doc <path> --section "<heading>" --strict-section --max-chars <n>'.
- Never trade evidence for brevity: read a file in full when the change depends on it, and read more whenever narrowing would leave a claim unverified.
- Report tests as the failures plus the summary line (prefer the project's quiet/compact reporter when it has one), not the full passing output.

Expected final response:
- Documents created or filled, with the confidence label distribution.
- Source evidence inspected, and the source mappings rebuilt.
- What stayed INFERRED, and on what basis.
- What stayed UNKNOWN, as questions for the outgoing maintainer.
- The readiness checks still incomplete, and why each one cannot be closed by writing text.

Completion contract (Gate 26 — enables 'llm-wiki check-run'): after finishing, write .llm-wiki/runs/run-backfill-<timestamp>.json with fields: task="backfill", changedSource[] (source files you edited), touchedDocs[] (docs/llm-wiki/* you updated), logAppended (bool), validated {ran, result}. Then run 'llm-wiki check-run' to confirm each changed source is referenced by a touched doc, the log was appended, and validate passed. Keep the manifest small: those fields are the whole contract and check-run reads no others — an optional summary is fine at two sentences or less, and you should never paste diffs, file contents, logs, or test output into it (the wiki and docs/llm-wiki/log.md are where the narrative belongs). This records what the run did — it never replaces human review and never promotes a document to verified.

<!-- llm-wiki-generated v5 f3020c13f71933c3 -->
