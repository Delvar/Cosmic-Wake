# Agent instructions

Before making code changes, read:

1. docs/atlas/00-start-here.md
2. docs/atlas/app-structure.md
3. docs/atlas/coding-conventions.md
4. docs/atlas/performance-guidelines.md
5. docs/atlas/project-planning.md
6. docs/atlas/change-guidance.md
7. docs/atlas/testing.md
8. docs/atlas/hazards.md

For roadmap, feature tracking, and open work, also check:

- TODO.md

If the task relates to a specific user flow, read the matching document under docs/atlas/flows/.

If the task relates to a specific module, read the matching document under docs/atlas/modules/.

Rules:

- Do not remove, skip, or weaken failing tests.
- Do not add dependencies without explaining why existing dependencies are insufficient.
- Prefer existing patterns over creating parallel patterns.
- Keep changes small and focused.
- If docs and code disagree, treat the code as source of truth and mention that the docs may be stale.
- Update relevant atlas docs when changing behaviors, app structure, testing approach, or important implementation patterns.
- Before editing, provide a short plan listing files likely to change, tests to run, and risks.

## Planning rules

- Treat TODO.md as the roadmap and feature tracker.
- Preserve the existing TODO.md structure, including priority sections, bold task names, anchors, links, and nested bullets.
- Use `[X]` for completed tasks to match the current file style.
- Do not implement TODO.md items unless explicitly asked.
- When working on a TODO item, read the full item, including nested bullets and linked detail documents.
- Treat nested bullets as acceptance criteria.
- Preserve `Related To` links and check related tasks when relevant.
- Do not mark a task complete unless the headline, description, nested bullets, and linked detail requirements are complete.
- Do not delete, rename, reorder, or broadly rewrite TODO.md unless explicitly asked.
- If a task reveals follow-up work, propose a new TODO.md item rather than silently expanding scope.