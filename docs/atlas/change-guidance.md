# Change guidance

## General approach

When making a change:

1. Understand the current behaviour by reading the relevant source files and docs.
2. Find the smallest relevant area of code, such as a single class or method.
3. Reuse existing classes, systems, and utilities; avoid creating parallel implementations.
4. Avoid broad rewrites; make incremental, safe changes.
5. Add or update tests when behaviour changes (if tests exist).
6. Run the game locally to verify changes and check for performance regressions.

## Preferred patterns

Use existing patterns for:

- Class structure and inheritance (e.g., extending `GameObject` or `Ship`).
- Naming conventions (e.g., `is*`, `has*`, `can*` for booleans; `_` for private).
- State machines with `this.stateHandlers`.
- Vector math (in-place operations, scratch vectors).
- Rendering (Canvas context save/restore, colour usage).
- JSDoc comments and file headers.

If existing code is inconsistent, follow the clearest and most recent pattern, such as those in `ship.js`.

## Adding a new class or system

Before adding a new class or system:

1. Check whether a similar class or system already exists in the relevant `src/` folder.
2. Keep the new addition focused on a single responsibility.
3. Keep business logic out of generic utility classes; use dedicated modules.
4. Add JSDoc comments and follow performance guidelines (e.g., scratch vectors).

## Adding game logic or behaviour

Before adding new game logic or behaviour:

1. Check existing files in the relevant `src/` folder (e.g., `autopilot/`, `job/`, `pilot/`).
2. Reuse existing helpers and patterns if they fit.
3. Handle edge cases like invalid states or performance-sensitive paths.
4. Avoid adding allocations in hot loops; use object pools and in-place operations.

## Refactoring

Refactors should be small and behaviour-preserving.

Do not combine a broad refactor with a feature change unless explicitly asked.

For refactors:

1. Confirm the game runs correctly before starting.
2. Make a small change, such as renaming or extracting a method.
3. Run the game again to verify.
4. Keep public behaviour and performance unchanged.