# Module: Core

## Responsibility

The core module provides the game engine foundation and shared primitives used across the app.
It owns base gameplay objects, math utilities, faction logic, commodity definitions, galaxy creation, and the main game loop.

This module is the lowest-level application layer and is responsible for:

- standard game object behaviour and lifecycle (`GameObject`, `isValidTarget`)
- common vector math and allocation-safe operations (`Vector2D`)
- shared utility functions for clamping, interpolation, angle normalization, and draw helpers
- faction relationship state and manager logic
- commodity metadata and pricing helpers
- galaxy initialization and system/stellar object creation
- the overarching `Game` loop, render orchestration, and fixed-timestep update strategy

## Main files

- `src/core/game.js`
- `src/core/gameObject.js`
- `src/core/vector2d.js`
- `src/core/utils.js`
- `src/core/faction.js`
- `src/core/commodity.js`
- `src/core/galaxy.js`

## Existing patterns

- `Game` is the app-level loop manager.
  - It owns the main and target cameras, HUDs, starfield, and frame timing.
  - It uses an accumulator to run fixed-step game updates and separate render passes.
- `GameObject` is the shared base class for world entities.
  - It centralises position, velocity, despawn state, and debug logging.
- `Vector2D` is intentionally allocation-safe.
  - Most operations throw unless the in-place variation is used.
  - The codebase relies on scratch vectors for hot loops.
- Utility functions are primitive and focused.
  - `utils.js` provides pure helpers like `clamp`, `lerp`, `normaliseAngle`, and `drawLightGlow`.
- Lightweight domain models exist in core.
  - `Faction` and `FactionManager` are simple relationship graphs.
  - `CommodityType` and `Commodities` are static game data definitions.
- Galaxy creation is procedural/seeded but fixed in `createGalaxy()`.
  - It builds star systems, planets, asteroid belts, and hyperlane links.

## Things to avoid

- Avoid adding gameplay-specific decisions or AI logic here.
  - Core should stay generic and reusable for game state, not mission behaviour.
- Avoid allocating temporary vectors in hot code paths.
  - Prefer `Vector2D` in-place methods and shared scratch objects.
- Avoid coupling core utilities to UI or DOM concerns.
  - `core/` is not the place for screen/UI rendering logic.
- Avoid changing the `Game` loop without understanding `GameManager`, camera updates, and render order.
- Avoid adding new module-specific data objects to `core/` unless they are broadly reusable across the app.

## Tests

- There are no dedicated automated tests for the core module in this repository.
- If tests are added, priority cases are:
  - `Vector2D` in-place operations and angle/distance helpers
  - `GameObject` lifecycle and `isValidTarget()`
  - `FactionManager` relationship symmetry and lookups
  - `getCommodityPrice()` interpolation behaviour
  - `createGalaxy()` initialization and star system linking
  - `Game` frame timing and update/render separation

## Change guidance

When editing core:

1. Verify the intended consumers of core functionality by checking imports across `src/`.
2. Keep core utilities small, pure, and deterministic.
3. Preserve allocation-safe patterns in `Vector2D`.
4. Prefer adding new helper functions only when they are used in multiple subsystems.
5. Avoid adding app-specific state to `Game` unless it belongs to the global loop manager.
6. Update module docs if any core behaviour or lifecycle expectations change.

## Open questions

- Should galaxy creation be moved out of `core/` into a dedicated world-generation module?
- Would an explicit `Engine` or `Loop` abstraction improve testability for `Game`?
- Should `Vector2D` expose a small set of allocation-safe constructors for common cases?
- Is `FactionManager` sufficient long-term, or will faction state need a more robust data model?
