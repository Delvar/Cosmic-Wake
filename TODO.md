# Cargo and Trading Roadmap

## Core Cargo Systems

- [X] **Cargo types** - Define the global cargo catalogue (for example: metals, food, medical supplies, fuel) and give each type a base price plus a price range.
- [X] **Cargo on ships** - Add ship cargo storage, including per-ship cargo capacity and a structured way to track cargo in each hold.
- [X] **Cargo in system** - Create an in-system cargo manager to store, update, and render floating cargo containers, similar to the projectile manager.

## Economy Design

- [ ] **Trading system design** - Decide what the economy is based on. A standard credit system may not fit the setting, so explore alternatives such as barter, water-based trade, or fuel as a primary unit of value.
- [ ] **Cargo planet pricing** - Make cargo prices vary by planet and change over time.
- [ ] **Cargo market on planet** - While landed, allow the player and AI to buy and sell cargo through a planetary market.

## Cargo Interactions

- [ ] **Cargo pickup** - When a ship with available cargo space passes over a cargo pod or crate, move as much cargo as possible into the hold and leave any excess behind.
- [ ] **Cargo jettisoning from ships** - Allow the player and AI to eject cargo into space.
- [ ] **Cargo capture when boarding** - During boarding, allow the player and AI to seize cargo and transfer it between ships.
- [ ] **Cargo mining** - When mining, add extracted raw materials such as ore and rock directly to the ship's cargo hold.

## AI Behaviours

- [ ] **Cargo AI pickup** - Update AI ships so they can collect cargo found in space.
- [ ] **AI trading** - Create a trader AI that travels between planets, buying and selling cargo for profit.

## Interface and Interaction Windows

- [ ] **Controls button on HUD** - Add an always-available on-screen button that opens a controls reference window without interrupting normal play flow.
- [ ] **Controls reference window** - Build a popup that lists all player inputs, grouped by context such as flight, combat, landing, targeting, and menus.
- [ ] **Input action documentation source** - Centralize the control definitions so the controls window can be generated from data instead of duplicating hard-coded key descriptions.
- [ ] **Debug option registry** - Replace the single global debug toggle with a named set of debug options so each overlay or helper can be enabled independently.
- [ ] **Debug window UI** - Add a debug panel with tick boxes for each debug option, allowing the player to toggle individual debug visuals and diagnostics on and off.
- [ ] **Granular debug checks in code** - Update existing debug rendering and logic paths so they check for specific debug options rather than only checking whether debug mode is globally enabled.
- [ ] **Expanded debug display design** - Define a more comprehensive debug display layout so current and future debug information can be shown in a readable way instead of all appearing in one place.
- [ ] **Planet landing services window** - When the player lands on a planet, open a services window with options for at least the cargo market and ship market.
- [ ] **Planet cargo market UI** - Build the landed cargo trading interface so the player can inspect local prices, buy cargo, and sell cargo from the ship hold.
- [ ] **Planet ship market UI** - Build a ship market interface for viewing available ships, comparing stats, and purchasing or swapping ships while landed.
- [ ] **Boarding action window** - When boarding another ship, present a dedicated window with actions to capture the ship, take cargo, repair it, or destroy it.
- [ ] **Boarding action outcomes** - Back the boarding window with actual boarding rules, validation, and consequences for each option, including ownership transfer and cargo movement.
- [ ] **Ship communications window** - Add a communications window for interacting with other ships and stations during flight.
- [ ] **Distress and surrender comms actions** - Support communication actions for begging for help when out of fuel or damaged, and for surrendering to pirates or planetary defence forces.
- [ ] **Comms response system** - Create the response logic so ships and factions can react differently to hails, distress calls, demands, and surrender attempts.
- [ ] **Self-destruct confirmation window** - Add a dedicated self-destruct window with a prominent activation control and a clear confirmation step.
- [ ] **Self-destruct countdown flow** - Implement the armed self-destruct timer, audiovisual warning state, and final ship explosion sequence after activation.
