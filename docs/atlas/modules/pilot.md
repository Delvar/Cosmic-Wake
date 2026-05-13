# Module: Pilot

## Responsibility

This module defines pilot behaviour for ships, including both human-controlled and AI-controlled pilots.
It manages the high-level state machine that decides when to run jobs, switch autopilots, react to threats, collect cargo, flee, and despawn.

## Main files

- `src/pilot/pilot.js`
- `src/pilot/aiPilot.js`
- `src/pilot/officerAiPilot.js`
- `src/pilot/pirateAiPilot.js`
- `src/pilot/civilianAiPilot.js`

## Existing patterns

- `Pilot` is the base class for all pilots.
  - It exposes `ship`, `autopilot`, `update()`, and `getStatus()`.
  - It does not implement `update()` directly; subclasses must override it.
- `PlayerPilot` lives alongside `AiPilot` in the same file and handles input-driven targeting and landing.
- `AiPilot` uses a state machine with these core states:
  - `Disabled`
  - `Job`
  - `Flee`
  - `Avoid`
  - `Attack`
  - `Collecting`
  - `Despawning`
- AI pilots delegate to state-specific handler methods via `this.stateHandlers`.
- State transitions are centralized through `changeState(newState, newAutopilot)`.
  - Leaving `Job` pauses the current job.
  - Entering `Job` resumes the job.
  - Non-job states set a new autopilot.
- `AiPilot` manages the autopilot lifecycle:
  - `setAutopilot(newAutopilot)` stops the current autopilot and starts the new one.
  - When an autopilot completes, `AiPilot` clears it.
- `AiPilot.update()` performs safety tracking.
  - It increments `safeTime` only when the ship is not threatened.
  - It skips updates for non-functional ship states like `Landing`, `TakingOff`, `JumpingOut`, `JumpingIn`, `Disabled`, and `Exploding`.
- Pilot subclasses add specialized reactions:
  - `OfficerAiPilot` monitors threats and may attack or flee based on shields/hull.
  - `PirateAiPilot` can collect cargo opportunistically and reacts quickly to hostiles.
  - `CivilianAiPilot` favours avoidance and safe cargo collection.
- `PlayerPilot` provides helper methods to cycle valid hostile, neutral, allied, and disabled targets.

## Things to avoid

- Avoid changing job or autopilot behaviour from inside the pilot module.
  - Pilots should invoke jobs and autopilots, not replace their responsibilities.
- Avoid bypassing `changeState()` when switching states or autopilots.
  - That method handles job pause/resume and autopilot cleanup.
- Avoid adding new pilot states without updating `stateHandlers` and `getStatus()`.
- Avoid setting `this.job` to `null` in `AiPilot`; it throws a hard error.
- Avoid leaving an older autopilot active when a new state starts.
- Avoid placing mission-selection logic in `PlayerPilot` if it should be handled by AI or jobs.

## Tests

- There are no dedicated automated tests for the pilot module in this repository.
- If tests are added, useful coverage includes:
  - `AiPilot.changeState()` and autopilot cleanup/resume behaviour
  - `AiPilot.update()` state handler dispatch
  - `PlayerPilot` target selection helpers
  - `OfficerAiPilot` and `PirateAiPilot` reaction transitions
  - `CivilianAiPilot` cargo collection and avoidance decisions

## Change guidance

When editing the pilot module:

1. Read `src/pilot/aiPilot.js` first to understand the shared AI state machine.
2. Keep pilot logic focused on state transitions and reactions, not on pathfinding or ship movement.
3. Preserve the existing `Job`/`Flee`/`Avoid`/`Attack`/`Collecting`/`Despawning` contract unless a broader design change is approved.
4. Use `setAutopilot()` whenever switching autopilots to ensure the previous autopilot is stopped.
5. If adding a new pilot subclass, follow the same pattern of overriding `update()` and `updateX()` handlers.
6. Update `docs/atlas/modules/job.md` or `docs/atlas/modules/autopilot.md` if the pilot behaviour change affects job/autopilot integration.

## Open questions

- Should the pilot state machine support a more explicit `Recovery` or `Retreat` state separate from `Flee`/`Avoid`?
- Would `AiPilot` benefit from a reusable reaction scheduler instead of repeating threat scans in subclasses?
- Should `PlayerPilot` be split into a separate file to make the AI vs player distinction clearer?
- Is it safe to remove the `Disabled` state and instead handle missing jobs more explicitly?
