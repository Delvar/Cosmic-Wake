## High Priority / Foundational

- [ ] **Ship Spec** <a id="ship-spec">[↩](#ship-spec)</a> Establish a single, data-driven spec so that cargo capacity directly drives overall ship scale, while engines, reactor, fuel, crew spaces, etc. scale proportionally and remain visually/mechanically believable. This prevents arbitrary sizes and ensures new ships (e.g. future freighters or fighters) feel part of the same universe. [Ship Design Specification](docs/TODO-Details/ship-design-spec.md)
- [ ] **Apply Ship Spec** Rebuild/redesign every ship inline with the Ship Spec.
- [ ] **Trading system design** - Decide what the economy is based on. A standard credit system may not fit the setting, so explore alternatives such as barter, water-based trade, or fuel as a primary unit of value.
- [ ] **Refactor ship-to-ship docking system** <a id="refactor-ship-to-ship-docking-system">[↩](#refactor-ship-to-ship-docking-system)</a> Currently docking is one-sided and fragile. Refactor so that when two ships dock, both receive a shared `DockingContext` object. This will:
  - Allow controlled docking with friendly ships for cargo/fuel/crew transfer.
  - Prevent multiple ships docking to the same target (limit to 1).
  - Enable staying docked after boarding a disabled ship (for repairs, shield sharing, crew transfer, etc.).
  - When two AI ships dock, designate a clear "manager" ship that controls all actions to prevent conflicting behaviour (e.g. fuel ping-ponging).
  - Keep player in primary control in most cases.
  - Related To: [Fix Docking with disabled ship](#fix-Docking-with-disabled-ship)

## Core Cargo Systems

- [X] **Cargo types** - Define the global cargo catalogue (for example: metals, food, medical supplies, fuel) and give each type a base price plus a price range.
- [X] **Cargo on ships** - Add ship cargo storage, including per-ship cargo capacity and a structured way to track cargo in each hold.
- [X] **Cargo in system** - Create an in-system cargo manager to store, update, and render floating cargo containers, similar to the projectile manager.
- [X] **Cargo container auto-pickup** - Enable automatic pickup of cargo containers when the ship passes over them in the system. Player-facing: Ships collect cargo by flying over containers. Supporting systems: Cargo manager collision/proximity detection with ships, capacity checks before transfer, partial cargo handling for excess, despawn collected containers.
- [X] **Cargo pickup** - When a ship with available cargo space passes over a cargo pod or crate, move as much cargo as possible into the hold and leave any excess behind.
- [X] **Cargo jettisoning from ships** - Allow the player and AI to eject cargo into space.
- [X] **Cargo jettisoning from destroyed ships** - Any cargo onboard gets jettisoned as it explodes.
- [X] **Cargo mining** - When mining, add extracted raw materials such as ore and rock directly to the ship's cargo hold.
- [ ] **Cargo capture when boarding** - During boarding, allow the player and AI to seize cargo and transfer it between ships.

## Economy & Trading

- [ ] **Cargo planet pricing** - Make cargo prices vary by planet and change over time.
- [ ] **Cargo market on planet** - While landed, allow the player and AI to buy and sell cargo through a planetary market.
- [ ] **Cargo Quick Sell** - Add a simple 'sell all cargo' option for AI and players which simply empties cargo.

## AI Behaviours

- [X] **Cargo AI pickup** - Update AI ships so they can collect cargo found in space.
- [X] **Random cargo on civilian ships** - Add a small amount of random cargo to all civilian ships when they spawn to make them more interesting and provide trading opportunities.
- [X] **Civilian cargo jettison during flee** - When civilian ships are under attack and begin to flee, add a chance they will jettison all cargo to lighten the load and escape faster.
- [X] **Pirate opportunistic cargo collection** - When pirates are attacking other ships and no one is attacking them back, and there's cargo in the area, give them a high chance to stop attacking and collect the cargo instead.
- [X] **Civilian opportunistic cargo pickup** - Civilians in smaller/faster ships with free cargo room may attempt to pickup cargo in the system if it's not too far away.
- [X] **Pirate targeting behaviour** - Pirates only attack ships with cargo, they prioritise ships with the most cargo.
- [ ] **AI trading** - Create a trader AI that travels between planets, buying and selling cargo for profit.
- [ ] **Pirate cargo selling behaviour** - If pirates are full of cargo, they will jump out of system and land on a planet to sell their stolen commodities.
- [ ] **Enable AI Mining Control** Update Mining AI to start/stop mining, mine until cargo is full then head to planet to sell.
- [ ] **Enable AI Repair Control** Add to basic AI Pilots the ability to repair hull via docking when landed.
- [ ] **Fix WandererJob route/landing bug** - WandererJob currently shuttles between systems without landing on planets; rewrite route selection and state transitions to ensure planet landing behaviors.


## User Interface
- [X] **Planet landing services window** - When the player lands on a planet, open a services window with options for at least the cargo market and ship market.
- [ ] **Planet cargo market UI** - Build the landed cargo trading interface so the player can inspect local prices, buy cargo, and sell cargo from the ship hold.
- [ ] **Planet ship market UI** - Build a ship market interface for viewing available ships, comparing stats, and purchasing or swapping ships while landed.
- [ ] **Boarding action window** - When boarding another ship, present a dedicated window with actions to capture the ship, take cargo, repair it, or destroy it.
- [ ] **Boarding action outcomes** - Back the boarding window with actual boarding rules, validation, and consequences for each option, including ownership transfer and cargo movement.
- [ ] **Ship communications window** - Add a communications window for interacting with other ships and stations during flight.
- [ ] **Distress and surrender comms actions** - Support communication actions for begging for help when out of fuel or damaged, and for surrendering to pirates or planetary defence forces.
- [ ] **Comms response system** - Create the response logic so ships and factions can react differently to hails, distress calls, demands, and surrender attempts.
- [ ] **Controls button on HUD** - Add an always-available on-screen button that opens a controls reference window without interrupting normal play flow.
- [ ] **Controls reference window** - Build a popup that lists all player inputs, grouped by context such as flight, combat, landing, targeting, and menus.
- [ ] **Input action documentation source** - Centralize the control definitions so the controls window can be generated from data instead of duplicating hard-coded key descriptions.
- [ ] **Debug option registry** - Replace the single global debug toggle with a named set of debug options so each overlay or helper can be enabled independently.
- [ ] **Debug window UI** - Add a debug panel with tick boxes for each debug option, allowing the player to toggle individual debug visuals and diagnostics on and off.
- [ ] **Granular debug checks in code** - Update existing debug rendering and logic paths so they check for specific debug options rather than only checking whether debug mode is globally enabled.
- [ ] **Expanded debug display design** - Define a more comprehensive debug display layout so current and future debug information can be shown in a readable way instead of all appearing in one place.
- [X] **Cargo pickup HUD notifications** - Add fading, scrolling notification list to HUD (right/left side) for cargo pickups: show cargo type + quantity per entry; flash on pickup, fade alpha over time; new entries push older up; max lines/height drops oldest. Player-facing: Clear feedback on collections. Supporting: Event from cargo system to HeadsUpDisplay, render queue with timers/positions.
- [X] **Extended ship UI logging** - Expand the ship UI log to include notifications for other events like landing on planets/asteroids, taking off, entering autopilot modes, combat engagements, and system jumps.
- [ ] **Unified DOM UI base class** - Unify the DOM GUI elements (Docking UI, Targeting, UILog) into a single DomUi base class supporting resizing, dragging, closing, and opening.
- [ ] **Self-destruct confirmation window** - Add a dedicated self-destruct window with a prominent activation control and a clear confirmation step.
- [ ] **Self-destruct countdown flow** - Implement the armed self-destruct timer, audiovisual warning state, and final ship explosion sequence after activation.

## Animations & Polish

- [ ] **Refactor ship animations** Currently all ship animations (takeoff, landing, jumping, etc.) are stored directly on the `Ship` class with many scratch variables and mixed state. Refactor into separate, lightweight animation classes (e.g. `TakeoffAnimation`, `LandingAnimation`, `JumpOutAnimation`) that are assigned to the ship when the animation starts and automatically removed when complete. This will clean up the `Ship` class, improve maintainability, and keep animation logic encapsulated.
- [ ] **Fix takeoff animation jerking** if during takeoff animation the target changes the ship jerks immediately to point at the target, should not change direction until animation is finished.


## Bug Fixes

- [ ] **Fix Docking with disabled ship** <a id="fix-Docking-with-disabled-ship">[↩](#fix-Docking-with-disabled-ship)</a> When boarding a ship, another ship can also board the same ship and captures it and it starts moving off, first limit the number of ships that can dock to 1, also check if the docked ship is now not disabled, is moving etc so undock automatically. Related To: [Refactor ship-to-ship docking system](#refactor-ship-to-ship-docking-system)

