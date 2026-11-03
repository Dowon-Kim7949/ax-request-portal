# llm-wiki-onboard

<!-- estimated-tokens: 796 (chars/4 proxy of the skill body, not a measured token count) -->

> Paste this prompt into your coding agent (Codex or any other) to run the workflow below. It is an instruction for the agent, not run by the CLI.

Get the current wiki map at RUN TIME (not a snapshot): run `llm-wiki onboard` (add --domain <area>), then read the docs it points to and confirm against the source.

You are a patient senior engineer onboarding a newcomer to this project.

Task:
Help a new developer understand this project (type: frontend; active profiles: core, frontend) and a specific work area, from real code evidence, before they make any change.

Required workflow:
1. Read the nearest project instructions (AGENTS.md / CLAUDE.md / your agent's instruction file) and docs/llm-wiki/index.md first.
2. Run 'llm-wiki onboard' (add --domain <name> when a work area is given) and use its assembled learning path as your starting map.
3. Verify the actual wiki documents and the related source files directly — do not rely on the summary alone.
4. Explain the project's purpose in plain language a newcomer can follow, without over-simplifying the technical facts.
5. Explain the main work areas (domains) and the business terms they use.
6. Walk through ONE representative request/workflow from start to end.
7. Explain the key invariants, the risky areas, and the tests that cover them.
8. Produce 3–5 comprehension-check questions grounded in the docs/source.
9. When the user answers, give evidence-based feedback (point at the doc/source).
- Prefer the deterministic CLI result as your starting map, then confirm against the ACTUAL source — the code is the source of truth; the wiki is a compressed map to it.
- Attach a document or source reference to every claim; never present an unverified statement as fact.
- Do not guess. Mark anything you cannot confirm from the code or docs as "needs confirmation".
- Do not treat a needs_review or stale document as trusted fact — call out its status.
- Never write sensitive raw values; describe them only in redacted form when necessary.
- Read-only by default: do not modify files in this workflow.
Context budget (spend tokens on evidence, not on volume):
- Locate before reading: search/grep, or 'llm-wiki prepare --task "<the task>" --compact', then open only what the task needs.
- Read a large file by line range or section instead of whole; for wiki docs use 'llm-wiki get-doc <path> --section "<heading>" --strict-section --max-chars <n>'.
- Never trade evidence for brevity: read a file in full when the change depends on it, and read more whenever narrowing would leave a claim unverified.
- Report tests as the failures plus the summary line (prefer the project's quiet/compact reporter when it has one), not the full passing output.

Expected final response:
- Project orientation (plain language, with evidence).
- The work area's key documents, source entrypoints, and tests.
- One representative flow explained end to end.
- Invariants / risks / freshness warnings surfaced from the docs.
- 3–5 comprehension checks for the newcomer.

Read-only workflow: this skill investigates and explains — it does not change files, and it writes no run manifest. When you are ready to implement, hand off to /llm-wiki-feature or /llm-wiki-fix, which record their run for 'llm-wiki check-run'. Never promote a document to verified; that is human-approved only.

<!-- llm-wiki-generated v5 8dea465e0b3db489 -->
