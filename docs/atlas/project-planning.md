# Project planning and agent guidance

This document explains how project planning, roadmap tracking, and AI assistant workflows are handled in this repo.

Agents must read this file before working on roadmap items, feature requests, TODO items, or multi-step changes.

---

## Planning sources

The primary planning file is:

- `TODO.md`

Use `TODO.md` for:

- Roadmap items
- Foundational design work
- Feature tracking
- Completed feature history
- Known bugs
- Refactoring candidates
- Technical debt notes
- Follow-up work
- Links to detailed design documents

Some TODO items may link to additional detail documents under:

- `docs/TODO-Details/`

Use linked detail documents as supporting context when working on that TODO item.

---

## TODO.md format

`TODO.md` is organised into roadmap sections.

Example sections:

```markdown
## High Priority / Foundational

## Core Cargo Systems
```

Each section contains task items using checkbox syntax:

```markdown
- [ ] **Task name** Task description.
- [X] **Completed task name** Completed task description.
```

Task items may also include:

* Inline anchors
* Return links
* Markdown links to detail documents
* Nested bullet points
* Related task references
* Backlinks to other TODO items

Example:

```markdown
- [ ] **Ship Spec** <a id="ship-spec">[↩](#ship-spec)</a> Establish a single, data-driven spec so that cargo capacity directly drives overall ship scale. [Ship Design Specification](docs/TODO-Details/ship-design-spec.md)
```

Agents must preserve this structure unless explicitly asked to reorganise it.

---

## Checkbox conventions

This repo currently uses:

```markdown
- [ ] Incomplete task
- [X] Completed task
```

Use `[X]` for completed tasks, matching the existing style.

Do not switch the file to lowercase `[x]` unless explicitly asked.

---

## Task naming conventions

Task names are bolded at the start of each TODO item.

Use this format:

```markdown
- [ ] **Task name** Task description.
```

Examples:

```markdown
- [ ] **Trading system design** Decide what the economy is based on.
- [X] **Cargo types** Define the global cargo catalogue.
```

Rules:

* Keep task names short and specific.
* Keep the task name in bold.
* Put the longer explanation after the bold task name.
* Preserve existing wording unless the task is being intentionally edited.
* Do not rename tasks casually, because anchors and references may depend on the name.

---

## Anchors and internal links

Some TODO items use explicit HTML anchors:

```markdown
<a id="ship-spec">[↩](#ship-spec)</a>
```

Agents must preserve anchors when editing existing TODO items.

Do not remove or rewrite anchors unless explicitly asked.

When adding a new task that may be referenced by other tasks, add a stable anchor using kebab-case:

```markdown
- [ ] **Refactor example system** <a id="refactor-example-system">[↩](#refactor-example-system)</a> Description.
```

Anchor rules:

* Use lowercase.
* Use hyphens between words.
* Keep anchors stable after creation.
* If renaming a task, preserve the old anchor unless explicitly asked to update references.
* Check existing `Related To` links before changing anchors.

---

## Links to detail documents

Some TODO items link to detailed design documents.

Example:

```markdown
[Ship Design Specification](docs/TODO-Details/ship-design-spec.md)
```

When working on a TODO item with a linked detail document:

1. Read the linked document before planning changes.
2. Treat the linked document as supporting context.
3. If the implementation changes the plan, update the detail document if appropriate.
4. If the linked document and code disagree, treat code as source of truth and flag the mismatch.
5. Do not delete links to detail documents unless explicitly asked.

When adding a large or foundational TODO item, consider creating a detail document under:

```text
docs/TODO-Details/
```

Use a clear kebab-case filename:

```text
docs/TODO-Details/ship-design-spec.md
docs/TODO-Details/trading-system-design.md
docs/TODO-Details/docking-system-refactor.md
```

---

## Nested bullet requirements

Some TODO items include nested bullets that describe scope, requirements, or design constraints.

Example:

```markdown
- [ ] **Refactor ship-to-ship docking system** Description. This will:
  - Allow controlled docking with friendly ships for cargo/fuel/crew transfer.
  - Prevent multiple ships docking to the same target.
  - Enable staying docked after boarding a disabled ship.
```

Agents must treat nested bullets as part of the task scope.

When working on such a task:

1. Read every nested bullet.
2. Convert the bullets into acceptance criteria.
3. Do not implement only the headline if nested requirements remain unresolved.
4. If only part of the task is being implemented, state which bullets are in scope and which are out of scope.
5. Do not delete nested bullets unless the work is complete or explicitly requested.

---

## Related task references

Some TODO items reference other TODO items.

Example:

```markdown
Related To: [Fix Docking with disabled ship](#fix-Docking-with-disabled-ship)
```

Agents must preserve related links.

When working on a related task:

1. Read the linked task.
2. Check whether the current change affects the related task.
3. Mention any relationship in the plan or summary.
4. Do not merge related tasks unless explicitly asked.

If a related link appears broken, flag it rather than guessing.

---

## How agents should use TODO.md

Before starting a feature, bug fix, refactor, or design task:

1. Search `TODO.md` for the task name or related terms.
2. Identify the relevant section.
3. Read the full TODO item, including nested bullets.
4. Open any linked detail documents.
5. Check for related TODO references.
6. Read the relevant atlas docs.
7. Inspect the relevant source files.
8. Propose a short implementation plan before editing code.

Do not implement unrelated TODO items while working on a task.

---

## Scope rules

Agents must not treat every incomplete TODO item as authorised work.

A TODO item is only in scope when:

* The user explicitly asks for it.
* The current task clearly refers to it.
* The user asks the agent to work from TODO.md.
* The user asks for planning, design, or analysis around that item.

If nearby TODO items seem related, mention them as possible follow-up work instead of silently expanding the scope.

---

## Updating TODO.md

Agents may update `TODO.md` when:

* A TODO item is completed.
* A sub-task is completed.
* A task needs a new clarification note.
* A new follow-up item is discovered.
* A linked detail document is added.
* A task should reference another related task.
* The user explicitly asks for roadmap updates.

Agents must not:

* Delete TODO items unless explicitly asked.
* Reorder sections broadly unless explicitly asked.
* Rewrite roadmap wording broadly unless explicitly asked.
* Rename tasks casually.
* Remove anchors casually.
* Remove links to detail documents casually.
* Mark a task complete unless the implementation actually satisfies the described scope.
* Mark a parent task complete if nested bullets remain unresolved.

---

## Marking tasks complete

Before changing:

```markdown
- [ ] **Task name**
```

to:

```markdown
- [X] **Task name**
```

Confirm that:

1. The task headline is complete.
2. The task description is complete.
3. All nested bullets are complete.
4. Linked detail document requirements are complete or no longer relevant.
5. Tests or manual checks have been run where applicable.
6. Any related atlas docs have been updated.

If only part of a task is done, do not mark the whole task complete.

Instead, add a short note or split the remaining work into a follow-up item.

Example:

```markdown
- [ ] **Refactor ship-to-ship docking system** Shared `DockingContext` added for player docking. AI-to-AI manager behaviour still needs implementation.
```

Or:

```markdown
- [ ] **Refactor ship-to-ship docking system** Refactor so that when two ships dock, both receive a shared `DockingContext` object.
  - [X] Add shared `DockingContext`.
  - [X] Prevent multiple ships docking to the same target.
  - [ ] Add AI-to-AI manager ship behaviour.
  - [ ] Keep player in primary control in most cases.
```

Only use nested checkboxes if the existing section already supports that level of tracking or the user asks for it.

---

## Adding new TODO items

When adding a new TODO item, use this format:

```markdown
- [ ] **Task name** Short description of the goal, context, and expected outcome.
```

For larger tasks, include nested bullets:

```markdown
- [ ] **Task name** Short description.
  - Requirement one.
  - Requirement two.
  - Requirement three.
  - Related To: [Other task](#other-task)
```

For large design tasks, add a detail document:

```markdown
- [ ] **Trading system design** Decide what the economy is based on. [Trading System Design](docs/TODO-Details/trading-system-design.md)
```

Use detail documents when the TODO item requires:

* Design exploration
* Multiple alternatives
* Acceptance criteria
* Diagrams
* Cross-system impact
* Long explanations
* Future implementation phases

---

## Recommended TODO item detail document format

For documents under `docs/TODO-Details/`, use:

```markdown
# <Task title>

## Goal

## Background

## Current behaviour

## Proposed behaviour

## Requirements

## Non-goals

## Related files

## Related TODO items

## Implementation notes

## Tests/checks

## Open questions
```

Keep detail documents focused on one task or closely related group of tasks.

---

## Agent workflow for TODO items

When asked to work on a TODO item, follow this workflow:

1. Identify the exact TODO item.
2. Read the full item, including nested bullets.
3. Read linked detail documents.
4. Read related TODO items.
5. Identify relevant atlas docs.
6. Identify likely source files.
7. Identify tests or manual checks.
8. Produce a short plan.
9. Make the smallest useful change.
10. Run relevant checks.
11. Update TODO.md only if appropriate.
12. Summarise what changed and what remains.

---

## Planning output format

Before making non-trivial changes, agents should produce:

```markdown
## Plan

TODO item:
-

Goal:
-

Relevant docs:
-

Likely files:
-

Acceptance criteria from TODO.md:
-

Tests/checks to run:
-

Risks:
-

Out of scope:
-
```

For TODO items with nested bullets, list the acceptance criteria explicitly.

Example:

```markdown
Acceptance criteria from TODO.md:

- Both docked ships receive a shared DockingContext.
- Only one ship can dock to the same target.
- Docking can persist after boarding a disabled ship.
- AI-to-AI docking has one manager ship.
- Player remains in primary control in most cases.
```

---

## Change summary format

After making changes, agents should summarise:

```markdown
## Summary

TODO item:
-

Changed:
-

Completed acceptance criteria:
-

Not completed:
-

Tests/checks run:
-

TODO.md updates:
-

Atlas docs updated:
-

Risks or follow-up:
-
```

---

## Handling completed sections

Completed items such as:

```markdown
- [X] **Cargo types** Define the global cargo catalogue.
```

are useful historical context.

Agents may read completed items to understand implemented systems, but must not reopen or rewrite them unless explicitly asked.

If changing behaviour related to a completed item:

1. Treat the completed item as historical context.
2. Inspect the current code.
3. Update atlas docs if the current behaviour changes.
4. Do not change `[X]` back to `[ ]` unless explicitly asked.

---

## Handling uncertainty

If something is unclear, agents should write:

```markdown
Needs human confirmation:
-
```

Use this when:

* A TODO item is ambiguous.
* A related link appears broken.
* The TODO item and source code disagree.
* The TODO item and linked detail document disagree.
* Existing patterns conflict.
* The task appears broader than requested.
* Some nested bullets are not clearly implemented.
* A change may affect architecture, performance, or gameplay balance.

Do not invent certainty.

---

## Agent behaviour rules

Agents should:

* Keep changes focused.
* Preserve the existing TODO.md structure.
* Preserve anchors and links.
* Follow `coding-conventions.md`.
* Follow `performance-guidelines.md` for hot paths.
* Follow `testing.md` when changing behaviour.
* Check `hazards.md` before touching fragile areas.
* Update atlas docs when behaviour, structure, or conventions change.
* Mark uncertainty clearly.

Agents should not:

* Rewrite large areas without explicit instruction.
* Implement unrelated TODO items.
* Add dependencies without approval.
* Remove tests to make a change pass.
* Hide failing tests or errors.
* Convert a small bug fix into a broad refactor.
* Delete roadmap items casually.
* Treat generated or unreviewed docs as more reliable than source code.

---

## Tool guidance for AI assistants

Agents may use tools to:

* Search the codebase.
* Read relevant files.
* Read TODO.md.
* Read linked TODO detail documents.
* Run tests.
* Run linting.
* Run builds.
* Inspect git diffs.
* Generate or update docs.
* Create small implementation patches.

Agents should prefer this order:

1. Read `AGENTS.md`.
2. Read `docs/atlas/00-start-here.md`.
3. Read `docs/atlas/project-planning.md`.
4. Read the relevant TODO.md item.
5. Read linked detail docs.
6. Read relevant atlas docs.
7. Search for existing patterns.
8. Read relevant source files.
9. Inspect related tests.
10. Make a small plan.
11. Edit code.
12. Run checks.
13. Review the diff.
14. Summarise what changed.

Agents must be careful with tools that:

* Delete files.
* Rewrite many files.
* Modify build config.
* Modify package dependencies.
* Modify lock files.
* Modify CI/CD.
* Touch authentication or permissions.
* Touch generated assets.
* Touch performance-sensitive rendering or update loops.

Use destructive or broad tools only when explicitly requested.