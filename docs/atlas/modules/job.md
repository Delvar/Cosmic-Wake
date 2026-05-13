# Module: Job

## Responsibility

This module defines high-level AI ship roles and mission behaviour. It provides:

- A shared `Job` base class for long-lived ship missions.
- Specialized job implementations for wandering, mining, piracy, escorting, and officer patrol.
- Coordination between `AiPilot`, `Autopilot`, and ship state to execute multi-step behaviours.
- Job lifecycle handling including state transitions, pause/resume, and failure.

## Main files

- `src/job/job.js`
- `src/job/wandererJob.js`
- `src/job/minerJob.js`
- `src/job/pirateJob.js`
- `src/job/officerJob.js`
- `src/job/escortJob.js`

## Existing patterns

- Jobs are implemented as state machines.
  - Each subclass defines `this.stateHandlers = { ... }`.
  - `update(deltaTime, gameManager)` delegates to the current state handler.
- Jobs do not directly move ships.
  - They choose goals and set `pilot.autopilot` or call `pilot.changeState(...)`.
- The base `Job` class handles shared behaviour:
  - `pause()` / `resume()`
  - `debugLog()` for conditional debug output
  - `getStatus()` for HUD/status strings
- Jobs are assigned and run through AI pilots.
  - `src/pilot/aiPilot.js` calls `job.update(...)` in the `Job` state.
  - `src/pilot/aiPilot.js` also manages autopilot completion and transition back to jobs.
- Some jobs clear autopilot when paused or when their current task completes.
- `src/core/game.js` is the primary place where job instances are created for ships.

## Things to avoid

- Avoid putting low-level movement control inside a job.
  - Jobs should select goals and let autopilots handle travel and combat movement.
- Avoid assuming `ship.dockingContext` exists when the ship is landed.
  - Many job subclasses explicitly check this before takeoff or landing logic.
- Avoid changing `Job` semantics without checking `src/pilot/aiPilot.js` and the pilot lifecycle.
- Avoid creating state names that are not handled in `stateHandlers`.
- Avoid mutating `pilot.autopilot` or `ship.target` outside the existing job/pilot contract unless the change is intentional and local.

## Tests

- There are no dedicated automated tests for the job module in this repository.
- If tests are added, the most valuable cases are:
  - base `Job` pause/resume behaviour
  - state transitions and handler delegation
  - job-to-pilot integration and autopilot lifecycle
  - failure and fallback paths

## Change guidance

When editing the job module:

1. Read `src/pilot/aiPilot.js` first to understand how jobs are driven.
2. Keep jobs focused on high-level mission decisions, not movement.
3. Follow the existing state-machine pattern:
   - `stateHandlers`
   - `update()` delegates to the handler
   - state-specific methods return quickly and set the next state
4. Preserve `pause()` / `resume()` behaviour for job continuity.
5. Add new job types only after checking whether an existing job can be extended.
6. If a change introduces new behaviour, update this module doc and any relevant flow docs.

## Open questions

- Should the `Job` base class expose a more explicit `fail()` helper instead of subclass no-op `Failed` state handlers?
- Would it be beneficial to share a common autopilot completion helper across jobs?
- Is the current `debugLog()` pattern consistent enough, or should job logging be centralized?
- Should `src/ship/shipNameGenerator.js` be updated when adding new job types so ship naming stays in sync?
