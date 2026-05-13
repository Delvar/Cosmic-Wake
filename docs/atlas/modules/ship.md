# Module: Ship

## Responsibility

The ship module models spaceship state, physics, combat, cargo, landing, docking, and cooldown systems.
It is the core game object for vessels and coordinates:

- ship state machine and updates (`Flying`, `Landing`, `Landed`, `TakingOff`, `JumpingOut`, `JumpingIn`, `Disabled`, `Exploding`)
- movement, thrust, rotation, and target tracking
- docking and landing interactions via `DockingContext`
- shield and hull health management
- cargo storage, pickup, and jettison behaviour
- weapon mounts, turrets, and firing modes
- ship visuals and particle trails
- pilot/autopilot integration through `pilot` and `target`

## Main files

- `src/ship/ship.js`
- `src/ship/dockingContext.js`
- `src/ship/shield.js`
- `src/ship/trail.js`
- `src/ship/shipNameGenerator.js`
- `src/ship/shipTypes.js`

## Existing patterns

- `Ship` is a state-driven game object.
  - It stores a `state` string and a `stateHandlers` map.
  - `update(deltaTime)` delegates to the current handler.
- Movement uses a combination of ship physics and autopilot commands.
  - Ship methods expose `applyThrust()`, `applyBrakes()`, `setTargetAngle()`, and velocity smoothing.
- Docking and landed behaviour is centralized in `DockingContext`.
  - `DockingContext` exposes valid actions like `takeOff()`, `repairHull()`, `startMining()`, and `capture()`.
- Shields are modelled separately in `Shield`.
  - The ship owns one shield instance and forwards shield updates and damage handling.
- Cargo is stored as a map by commodity type.
  - `cargoUsed`, `cargoAvailable`, `addCargo()`, and `removeCargo()` are computed accessors.
- Ship visuals and effects rely on `Trail`, `featurePoints`, and color properties.
- Ship creation uses helper modules for names and types.
  - `shipNameGenerator.js` maps job classes to ship naming conventions.
- Performance-sensitive code uses scratch `Vector2D` objects.
  - This avoids allocations inside the main update loop.
- Weapon behaviour is exposed through turret arrays and fixed weapon arrays.

## Things to avoid

- Avoid putting AI decision logic into the ship module.
  - Jobs and pilots should make decisions and set `ship.target` or `pilot.autopilot`.
- Avoid accessing `ship.dockingContext` without null/state checks.
  - Docking is only valid in landed/boarded contexts.
- Avoid changing ship state directly without using the provided state transition methods.
  - The state machine ensures consistent updates and animation handling.
- Avoid adding new ship behaviour that duplicates `DockingContext`, `Shield`, or `Trail` responsibilities.
- Avoid mutating `cargo` directly instead of using `addCargo()`/`removeCargo()`.
- Avoid creating ships without setting `pilot` or `faction` correctly.

## Tests

- There are no dedicated automated tests for the ship module in this repository.
- If tests are added, priority cases are:
  - ship state transitions and update handler dispatch
  - docking/landing takeoff flow and `DockingContext` actions
  - shield damage/recharge and collapse behaviour
  - cargo storage and pickup limits
  - `isValidAttackTarget()` and relationship logic

## Change guidance

When editing the ship module:

1. Read `src/ship/ship.js` first, as it is the central class for ship behaviour.
2. Keep ship code focused on physical state and gameplay mechanics.
3. Use `DockingContext` for landed interactions, not ad hoc landed checks.
4. Preserve the scratch-vector pattern for hot code in the update loop.
5. Update the corresponding pilot or autopilot docs if the ship state machine or target model changes.
6. If adding new ship properties, prefer derived accessors like `cargoUsed` rather than extra stored totals.

## Open questions

- Should `Ship` expose more explicit lifecycle hooks for landing, takeoff, and jumping?
- Would a smaller dedicated `Cargo` helper improve storage and transfer logic?
- Is the current `DockingContext` separation sufficient, or should landing and boarding be split further?
- Should ship visual configuration (`featurePoints`, `trail`) be moved to a separate ship-type factory module?
