---
name: fix-lint-issues
description: "Use when: there are lint errors from get_errors tool, npm run lint reports issues, after code edits, or to automatically fix lint issues. Automatically detects, fixes (via eslint --fix and precise edits), and verifies lint compliance in the Cosmic Wake project while strictly following all atlas documents, coding conventions, and UK English spelling."
---

# Fix Lint Issues

## Purpose
This skill defines a strict, file-by-file lint-fixing workflow for the Cosmic Wake JavaScript codebase. It acts as an expert lint-fixing agent that starts with `npm run lint:fix`, then processes **one file at a time**, fixing *only* the lint problems reported for that specific file in the current scoped `npm run lint` output. Special focus on unused parameters (prefix with `_`), updating matching JSDoc `@param` tags with exact names and specific types (e.g. `number` for `deltaTime`, `GameManager` for `gameManager`; never generic `Object`), maintaining `lint.report.md` with precise rules for updates (newest-first log entries at top, accurate counters, Last updated line). All changes must be minimal, follow atlas documents, coding-conventions.md, use UK English spelling, and never alter game behaviour.

## Core Task
Run `npm run lint`, identify the current errors/warnings, then **work through one file at a time**:
- Fix **only** the lint problems reported for that specific file in the current `npm run lint` output.
- Never perform global search/replace or broad pattern changes.
- For unused parameters (especially in `update(deltaTime, gameManager)` style methods and state handlers), prefix them with `_` (e.g. `_deltaTime`, `_gameManager`) to satisfy `@typescript-eslint/no-unused-vars`.
- Update the matching JSDoc `@param` tags so the names exactly match the final parameter names.
- Use the correct specific types (e.g. `number` for deltaTime, `GameManager` for gameManager). Never use generic `Object` types unless the rule absolutely requires it.
- Keep all changes small, focused, and consistent with existing patterns in the codebase.
- Use UK English spelling.
- Once the file is fixed and no more lint problems are reported, continue onto the next file, continue until all files are fixed or all errors you are able to fix safely are fixed.

## Trigger Phrases
- automatically fix lint issues
- resolve eslint errors
- fix lint report
- clean up linting
- run lint:fix
- fix one file at a time

## Prerequisites
Before starting:
- Read: docs/atlas/00-start-here.md, docs/atlas/app-structure.md, docs/atlas/coding-conventions.md, docs/atlas/performance-guidelines.md, docs/atlas/project-planning.md, docs/atlas/change-guidance.md, docs/atlas/testing.md, docs/atlas/hazards.md.
- Review TODO.md (do not implement items unless explicitly asked; preserve its structure).
- Prefer existing patterns over creating parallel ones; make smallest safe changes only.

## Maintenance Rules for lint.report.md
After fixing each file (or logical batch), update `lint.report.md` as follows:
- Add or update a "Last updated: YYYY-MM-DD" line at the very top.
- Increment the correct counters in the **Summary** section (be accurate - do not guess).
- Add a new bullet at the **top** of the **Fix Log** (newest first).
- Use this exact format for each log entry:
  `- `filename`: description of what was fixed (list the specific lint rules addressed, e.g. "fixed jsdoc/check-param-names, jsdoc/require-param, and @typescript-eslint/no-unused-vars by renaming parameters to _deltaTime, _gameManager and updating JSDoc").`
- Never delete, reorder, or broadly rewrite historical entries.
- Only count fixes that were actually performed during this lint-cleanup task.

## Workflow for every file
1. Run `npm run lint -- --files <filename>` to see the exact current issues for that file only.
2. Loop over the issues one by one.
3. Read the relevant sections of the file.
4. Make the minimal edits needed to clear the reported issues for that file only.
5. Fix as many problems as you can looping back to step 2 before moving forwards.
6. Run lint again on that file to verify it is now clean.
7. Update `lint.report.md` following the rules above.
8. Only then move to the next file that still has errors.

Start every session by running `npm run lint:fix` on the whole project to automatically fix simple issues and give overview of files needing manual work. Then proceed file-by-file.

## Additional Rules
- Do not remove, skip, or weaken failing tests.
- Prefer existing patterns over new ones.
- If docs and code disagree, treat code as source of truth and note that docs may be stale.
- Update relevant atlas docs *only* if you actually change behaviour, structure, or important implementation patterns.
- Follow all rules from AGENTS.md, change-guidance.md, hazards.md, performance-guidelines.md, coding-conventions.md (e.g. JSDoc with specific types, UK English).
- Never perform global changes; scope strictly to reported lint output per file.
- For state handlers or update methods, ensure parameter renaming does not break functionality.

## Quality Checks (Acceptance Criteria)
- All reported lint errors for processed files eliminated; full `npm run lint` eventually reaches exit code 0.
- JSDoc updated to match parameter names and use precise types (e.g. `{number}`, `{GameManager}`).
- `lint.report.md` updated correctly with newest entries at top, accurate counters, preserved history.
- Code strictly matches coding-conventions.md (file headers, JSDoc, no-var, stylistic rules, etc.).
- UK English spelling in names, comments, documentation.
- Changes small, focused, incremental; no game behaviour changes, no performance regressions, no new dependencies.
- All tool calls follow exact JSON schemas; no codeblocks for edits in responses; absolute paths used.
- Manual verification in browser (`index.html`) for any UI/game impacting files.

## Tools Integration Notes
- **Terminal:** Always use `run_in_terminal` tool with `explanation`, `goal`, `mode: "sync"` (for lint commands). Start with `npm run lint:fix`.
- **Errors:** Use `get_errors()` after every edit pass; prefer scoped lint via terminal for precision.
- **Editing:** Strictly prefer `replace_string_in_file` (with 3-5+ lines context before AND after target). Ensure oldString is unique and exact (including whitespace). Use absolute file paths only. Group changes by file.
- **Exploration:** Use `grep_search`, `semantic_search`, or subagent "Explore" (with thoroughness) only for context on the *current file's* reported issues. Never broad searches.
- **Memory:** Record common lint patterns (e.g. parameter handling) in `/memories/repo/` if they emerge repeatedly.
- Follow editFileInstructions, notebookInstructions (if applicable), outputFormatting strictly. Do not mention guidelines in responses.

## Example Usage Prompts
- "/fix-lint-issues"
- "Resolve all remaining lint errors following the new file-by-file workflow"
- "The get_errors tool shows issues in src/pilot/pilot.js, please fix following the skill"

This skill enforces the precise, disciplined one-file-at-a-time process while packaging knowledge of the project's ESLint setup (flat config in eslint.config.mjs, stylistic plugin, JSDoc rules, @typescript-eslint/no-unused-vars with _ prefix support), atlas workflow, and lint.report.md maintenance.

---