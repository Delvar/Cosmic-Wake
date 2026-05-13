# Known hazards

This file records fragile, surprising, or easy-to-break parts of the app.

## General hazards

- Do not add dependencies without a clear need; the current runtime is static and dependency-free.
- Do not change core performance patterns unless necessary.
- Avoid heap allocations in hot loops.
- Do not rewrite large areas of the app for a small bug fix.
- The source code is the source of truth; if docs and code differ, update docs.

## App-specific hazards

### Performance-sensitive loops

Area:

- `src/core/game.js` (main loop)
- `src/starSystem/starSystem.js` (system updates)
- `src/starSystem/projectileManager.js` (projectile updates)
- `src/camera/starField.js` (rendering)

Problem:

- Update and render loops are sensitive to allocations.
- New objects, arrays, or vectors per frame can cause frame drops.

Guidance:

- Reuse scratch objects and in-place operations.
- Preserve existing allocation-free patterns in update/render paths.

Tests/checks:

- Verify affected flows in the browser and watch for stuttering.

### State machine conventions

Area:

- `src/pilot/pilot.js`
- `src/job/job.js`

Problem:

- AI state machines depend on consistent handler binding and transitions.
- Silent breaks can occur when handler names or bindings change.

Guidance:

- Preserve the `this.stateHandlers[state]` conventions.
- Test affected AI behaviours manually.

Tests/checks:

- Playtest ship jobs, autopilots, and pilot transitions.

### Star field worker and rendering

Area:

- `src/camera/starFieldWorker.js`
- `src/camera/starField.js`

Problem:

- Star field generation uses worker communication and grid culling.
- Breaking the worker protocol can cause rendering failures or hangs.

Guidance:

- Avoid changing worker interfaces unless necessary.
- Keep star field grid and culling logic intact.

Tests/checks:

- Confirm star field rendering at different zoom levels.

### Vector math and canvas state

Area:

- `src/core/vector2d.js`
- `src/ship/ship.js`
- `src/ui/headsUpDisplay.js`

Problem:

- Vector math relies on pre-allocated scratch vectors and in-place math.
- Canvas drawing requires balanced `save()`/`restore()` calls.

Guidance:

- Use pre-allocated scratch vectors and reuse them.
- Wrap canvas draw operations with `ctx.save()` / `ctx.restore()`.

Tests/checks:

- Visual inspection for rendering glitches and unexpected behaviour after changes.
