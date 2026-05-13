# Development Workflow

## Approach

- Identify the relevant flow, module, or file before editing.
- Prefer existing source files and patterns; avoid introducing parallel subsystems.
- Make the smallest safe change that solves the issue.
- Read `docs/atlas/change-guidance.md` before modifying behaviour or performance-sensitive code.

## Current runtime model

- The app is a static browser game loaded from `index.html`.
- There is no compile/build step for normal runtime.
- `src/core/game.js` is the primary bootstrap module.

## Change process

1. Identify the issue or feature scope.
2. Locate the relevant files and implementation area.
3. Inspect the relevant source code.
4. Update source in place.
5. Validate in a browser by opening or refreshing `index.html`.
6. Run `npm run lint` to catch syntax/style issues.
7. Update docs if structure, behaviour, or conventions change.

## Practical notes

- Keep hot loops lean and avoid per-frame allocations.
- Preserve existing ES module import conventions and root-relative paths.
- If the change involves UI or rendering, verify that canvas state is saved/restored correctly.
- Do not add new dependencies without a strong reason and an explanatory note.

