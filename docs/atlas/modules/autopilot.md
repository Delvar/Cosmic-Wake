# Module: Autopilot

## Responsibility

This module defines ship navigation and combat steering behaviors.
It controls how ships move, approach targets, land, avoid threats, and execute attack patterns.

Autopilots are responsible for:

- running discrete movement or combat behaviours
- validating targets and starting only when valid
- managing active/completed/error state
- chaining sub-autopilots for multi-phase tasks
- exposing status strings for HUD/debug display

## Main files

- `src/autopilot/autopilot.js`
- `src/autopilot/attackAutopilot.js`
- `src/autopilot/flyToTargetAutopilot.js`
- `src/autopilot/landOnPlanetAutopilot.js`
- `src/autopilot/traverseJumpGateAutopilot.js`
- `src/autopilot/fleeAutopilot.js`
- `src/autopilot/avoidAutopilot.js`
- `src/autopilot/escortAutopilot.js`
- `src/autopilot/boardShipAutopilot.js`
- `src/autopilot/inRangeAttackAutopilot.js`
- `src/autopilot/flybyAttackAutopilot.js`
- `src/autopilot/orbitAttackAutopilot.js`
- `src/autopilot/landOnAsteroidAutopilot.js`
- `src/autopilot/landOnPlanetDespawnAutopilot.js`
- `src/autopilot/cargoCollectorAutopilot.js`

## Existing patterns

- `Autopilot` is a base class.
  - Subclasses extend it and often override `start()`, `update()`, and `stop()`.
  - The base class provides `active`, `completed`, `error`, and `subAutopilot` fields.
- Autopilots are state machines.
  - Most subclasses define `this.stateHandlers = { ... }`.
  - `update(deltaTime, gameManager)` delegates to the current state handler.
- `start()` is used for setup and validation.
  - It should set `active = true`, `completed = false`, and clear errors.
  - It should validate the target before proceeding.
- `stop()` cleans up.
  - It should stop any `subAutopilot`, deactivate itself, and reset ship thrust/brakes.
- Sub-autopilot composition is common.
  - Multi-step tasks use a `subAutopilot` for a phase such as approach, attack pattern, or landing.
  - `getStatus()` shows nested sub-autopilot status when active.
- Base autopilot helper methods are shared.
  - `validateTarget()` uses `isValidTarget()` and target-specific rules.
  - `applyThrustLogic()` uses velocity error, hysteresis, and target angle to manage thrust.
  - `handleFiring()` is used by combat-oriented autopilots.
- The `AttackAutopilot` family chooses patterns based on ship speed and delegates behaviour to pattern-specific subclasses.
- Autopilots are expected to work with `AiPilot` and `Job`.
  - Jobs set autorelying autopilots rather than moving ships directly.

## Things to avoid

- Avoid implementing mission decision logic here.
  - Autopilots should execute movement and combat, not choose which target or job.
- Avoid leaving `subAutopilot` active when the parent autopilot stops.
- Avoid calling `update()` on inactive autopilots.
- Avoid starting an autopilot without validating `target`.
- Avoid mutating ship state outside the autopilot contract.
  - Use ship methods like `applyThrust()`, `setTargetAngle()`, and `fireTurrets()`.
- Avoid assuming every autopilot has the same state names.
  - Add handlers for any new state.
- Avoid bypassing the base `stop()` cleanup behaviour.

## Tests

- There are no dedicated automated tests for the autopilot module in this repository.
- If tests are added, the highest-value coverage is:
  - base `Autopilot` lifecycle and validation
  - `AttackAutopilot` pattern selection and sub-autopilot transitions
  - `LandOnPlanetAutopilot` start/update/stop sequence
  - `FlyToTargetAutopilot` distance and completion handling
  - error paths when a target becomes invalid or unreachable

## Change guidance

When editing the autopilot module:

1. Read `src/autopilot/autopilot.js` first.
2. Keep autopilots focused on execution, not job selection.
3. Preserve `start()` validation and `stop()` cleanup.
4. Use the state-handler pattern already present in the module.
5. Use `subAutopilot` for multi-stage behaviors rather than trying to handle all phases in one state method.
6. Do not change `getStatus()` semantics without checking how `AiPilot` and the HUD consume it.
7. Update `docs/atlas/modules/job.md` if changes affect job/autopilot integration.

## Open questions

- Should `Autopilot` expose a shared `fail()` helper for uniform error handling?
- Would a small `SubAutopilotManager` helper reduce repeated chaining boilerplate?
- Is the current `active/completed/error` state model sufficient, or should completion and error be separated more explicitly?
- Should `getStatus()` be simplified to avoid type-based target name heuristics?
