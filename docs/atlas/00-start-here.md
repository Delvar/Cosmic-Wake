# Codebase atlas

This folder helps developers and AI agents understand the app before changing code.

Start here:

1. Read system-overview.md for what the app does.
2. Read app-structure.md for where things live.
3. Read change-guidance.md before editing.
4. Read testing.md before changing behaviour.
5. Read hazards.md before touching fragile or unusual areas.
6. Check flows/ for user journeys.
7. Check modules/ for implementation areas.

When making a change:

1. Identify the relevant flow or module.
2. Read the relevant docs.
3. Inspect the actual source files.
4. Make the smallest safe change.
5. Run the relevant tests.
6. Update docs if the behaviour or structure changed.

Important:

- The source code is the source of truth.
- These docs are here to reduce blind exploration, not replace reading code.
- If these docs are wrong or stale, update them or flag the issue in the PR.

## Coding conventions

Before editing code, read:

- coding-conventions.md

This file defines project-specific JavaScript, JSDoc, import, naming, state machine, object sealing, and canvas rendering conventions.

## Project planning

For roadmap, backlog, feature tracking, and known future work, read:

- ../../TODO.md
- project-planning.md

`TODO.md` uses priority sections, checkbox items, bold task names, anchors, links to detail documents, nested requirement bullets, and related-task references.

Use TODO.md to understand planned work, but do not treat every TODO item as authorised scope for the current task.

When working on a TODO item:

1. Read the full TODO item.
2. Read any linked detail document.
3. Treat nested bullets as acceptance criteria.
4. Check related-task links.
5. Preserve anchors, links, and existing formatting.