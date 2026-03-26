# Cosmic Wake

Cosmic Wake is a browser-based space simulation game built with vanilla JavaScript and the HTML5 Canvas. You pilot a small ship through a living miniature galaxy with civilian traffic, pirates, patrol craft, jump gates, planets, asteroid belts, boarding, and ship-to-ship combat.

It currently plays like a sandbox prototype: fly, fight, chase targets, land on planets or asteroids, board disabled ships, and move between star systems while AI ships carry out their own jobs around you.

## What Is In The Game

- Real-time spaceflight with manual controls and context-sensitive autopilots
- Three connected star systems: Sol, Alpha Centauri, and Proxima Centauri
- AI-controlled civilian, pirate, officer, miner, escort, and patrol ships
- Faction relationships that drive hostility, targeting, and combat
- Planet landing, asteroid landing, jump gate traversal, and boarding disabled ships
- A layered HUD with navigation rings, target highlighting, and status text
- A draggable and resizable target camera window for your selected target
- Procedural starfield rendering with worker support when the browser allows it

## Current State

The game is already playable, but it is still in active development. Cargo trading, ship markets, comms, and several other systems are planned rather than fully implemented yet. The current roadmap lives in [`TODO.md`](TODO.md).

## Getting Started

This project has no build step. It should be served as static files from the repository root.

### Run Locally

Use any local static web server. For example:

```powershell
py -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Do not open `index.html` directly with `file://`. The game uses ES modules with `/src/...` imports, so it expects to run from a web server.

### Requirements

- A modern desktop browser with ES module support
- Keyboard controls
- Mouse wheel and mouse input if you want to zoom or move/resize the target camera window

## Starting Situation

- You begin in the Sol System near Earth
- The player ship starts as an `Interceptor`
- An allied escort ship spawns with you and is usually your first target
- Pirates are hostile to the player from the start

## Controls

### Flight And Combat

| Input | Action |
| --- | --- |
| `Arrow Left` / `Arrow Right` | Rotate ship |
| `Arrow Up` | Thrust |
| `Arrow Down` | Apply brakes |
| `Space` | Fire weapons while flying |
| `A` | Attack the current ship target using attack autopilot |
| `F` | Escort / follow the current ship target |
| `U` | Cycle turret mode |
| `d` | Toggle cargo jettison |
| `P` | Toggle cargo retrieval |

Manual arrow-key input cancels the current autopilot and, if you are landed, initiates takeoff.

### Targeting And Interaction

| Input | Action |
| --- | --- |
| `R` | Select or cycle hostile ship targets |
| `T` | Select or cycle neutral ship targets |
| `Y` | Select or cycle allied ship targets |
| `L` | Land on a nearby planet, take off from a planet, or autopilot/cycle to a planet |
| `M` | Land on a nearby asteroid, take off from an asteroid, or autopilot/cycle to an asteroid |
| `J` | Use a jump gate if you are on it, or autopilot/cycle to a jump gate |
| `B` | Board a disabled ship, take off from it, or autopilot/cycle to another disabled ship |
| `C` | Start or stop cargo collection autopilot |

These interaction keys are context-sensitive. If you are already over a valid object, the action happens immediately. Otherwise the same key usually starts an autopilot toward the current or nearest valid target, and repeated presses cycle through candidates.

### Camera And UI

| Input | Action |
| --- | --- |
| `Mouse Wheel` | Zoom main camera |
| `+` / `=` | Zoom in |
| `-` / `_` | Zoom out |
| `Tab` | Cycle the camera to the next ship in the current system |
| `Q` | Snap the camera back to the player ship |
| Drag target window | Move the target camera window |
| Drag window corner handles | Resize the target camera window |
| `H` | Toggle layered HUD rendering |

The target camera appears when your current camera ship has a valid target.

### Debug / Developer Controls

| Input | Action |
| --- | --- |
| `D` | Toggle debug rendering |
| `K` | Instantly damage the current player ship |

## First Session Tips

1. Use `T`, `Y`, or `R` to pick a target and watch the target camera window appear.
2. Use the arrow keys to fly manually, or press `L`, `M`, or `J` to let autopilot handle travel.
3. Press `Space` to fire, or `A` to let the ship run an attack autopilot against the selected target.
4. Once a hostile ship is disabled, press `B` to attempt boarding.
5. Press `C` to start collecting cargo containers floating in space.
6. Use `Tab` to spectate other ships and `Q` to return to your own interceptor.

## Project Structure

If you are here to play or lightly tweak the game, the main files to know are:

- [`index.html`](index.html) for the page shell and canvases
- [`src/core/game.js`](src/core/game.js) for startup, rendering, and input wiring
- [`src/core/galaxy.js`](src/core/galaxy.js) for star systems and world setup
- [`src/pilot/`](src/pilot) and [`src/autopilot/`](src/autopilot) for ship behaviour
- [`src/starSystem/`](src/starSystem) for planets, jump gates, asteroids, projectiles, and particles

For a fuller architecture breakdown, developer-oriented file map, and system notes, see [`AGENTS.md`](AGENTS.md).

## AI System Overview

This section provides a high-level overview of the AI architecture in Cosmic Wake, focusing on how NPC ships are controlled and behave. The system is modular to allow flexible, personality-driven behaviors while reusing common navigation and combat logic. It consists of Pilots (for control), Autopilots (for specific manoeuvres), and Jobs (for goal-oriented lifecycles).

### Pilots: Core Control Layer
Pilots are the primary interface for controlling ships, handling both player input and AI decision-making.

- **Base Pilot**: An abstract class providing a common interface for all ship control. It manages basic inputs like thrust, rotation, and firing.
- **PlayerPilot**: Handles human-controlled ships via browser inputs (keyboard/mouse). It supports manual control but can also use autopilots for assisted navigation.
- **AiPilot**: Base class for AI-controlled ships with built-in reactive behaviors. It uses a state machine to switch between modes like 'Job' (goal pursuit), 'Attack' (combat), 'Flee' (evasion), 'Avoid' (obstacle dodging), and 'Despawning' (removal from game). In the 'Job' state, it delegates to an assigned Job for high-level goals.

AI Pilots come in specialized subclasses that define "personality" through behaviors switching logic:
- **CivilianAiPilot**: Timid and evasive. Prioritizes fleeing from threats early, only fighting if cornered or shields are low. Avoids combat unless necessary.
- **PirateAiPilot**: Aggressive and opportunistic. Less likely to flee (only when hull is critically low), prioritizes capturing cargo/loot over prolonged fights, and breaks off attacks to collect floating cargo.
- **OfficerAiPilot**: Disciplined and protective. Attacks threats aggressively, including disabled ships; less prone to fleeing; focuses on maintaining order by boarding or eliminating hostiles.

These differences in switching logic create varied NPC personalities—e.g., civilians run quickly, pirates chase loot greedily, and officers pursue relentlessly—without tying behaviors to specific ship types.

### Autopilots: Modular Manoeuvres
Behaviors are implemented through chainable Autopilot classes, which handle specific tactical actions or navigation sequences. Autopilots are not full AI controllers but reusable "modules" that compute inputs (e.g., thrust, rotation) to achieve a task.

- **Key Examples**: FlyToTarget (basic navigation), LandOnPlanet (docking), AttackAutopilot (combat pursuit), FleeAutopilot (evasion), TraverseJumpGate (system travel).
- **Chainability**: Autopilots can be sequenced or nested (e.g., approach a target, then orbit and attack).
- **Universal Use**: Any pilot (AI or Player) can activate an autopilot. For players, this enables "assisted" modes like auto-landing; for AI, it provides building blocks for complex actions.

This modularity allows sharing logic across pilots—e.g., a player could use an AttackAutopilot for help in combat, while an AI chains it with FleeAutopilot for hit-and-run tactics.

### Jobs: Goal-Oriented Lifecycles
Jobs define the high-level "purpose" or lifecycle of an AI ship, deciding what the pilot should do next based on the job's internal state. They run within the AiPilot's 'Job' state and configure autopilots to achieve goals.

- **How Jobs Work**:
  - A job evaluates the situation (e.g., scan for targets, check cargo) and sets an appropriate autopilot on the pilot (it doesn't hold the autopilot itself).
  - Jobs manage state machines for multi-step goals, chaining autopilots as needed (e.g., fly to asteroid → mine → return home).
  - The job can interrupt itself to trigger pilot-level reactions (e.g., switch to 'Flee' if threatened) or end when complete (e.g., cargo full).
  - If paused (e.g., for game events), jobs can resume from saved states.

- **Job Types** (Modular and Extensible):
  - **WandererJob**: Travels between planets/systems, simulating traders or explorers.
  - **PirateJob**: Hunts targets, attacks for loot, collects cargo.
  - **OfficerJob**: Patrols, attacks hostiles, boards disabled ships.
  - **MinerJob**: Mines asteroids, returns to base to unload.
  - **EscortJob**: Follows and protects a specific ship.

Jobs are not tied to pilot types, enabling creative combinations (e.g., a PirateAiPilot with a WandererJob could simulate a "pirate trader" that wanders but attacks opportunistically). This keeps the system flexible for new behaviors.

### Why This Architecture?
- **Personality via Pilots**: AiPilot subclasses encapsulate reactive "personality" (e.g., when to flee vs. fight), making NPCs feel distinct without bloating job logic.
- **Reusability via Autopilots**: Modular manoeuvres reduce code duplication—any pilot can use them for tasks like landing or attacking, supporting both AI and player assistance.
- **Goal Flexibility via Jobs**: Jobs handle long-term lifecycles and complex sequences, allowing easy addition of new NPC roles (e.g., a future "TraderJob" for buying/selling) without changing pilot code.
- **Overall Benefits**: The layered design (Pilots → Autopilots → Jobs) creates emergent, believable AI behaviors in a dynamic galaxy, while being extensible for new features like custom missions or player AI companions.

## Notes For Contributors

- The project uses ES modules and is intended to be served as static files
- There is no bundler or build pipeline
- `jsconfig.json` and `eslint.config.mjs` are present for editor and linting support
- The starfield can render via a worker when browser support is available
