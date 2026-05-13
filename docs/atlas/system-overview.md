# System overview

## Purpose

Cosmic Wake is a vanilla browser JavaScript game that simulates procedural star systems, ship AI, combat, and exploration.

## Users

- Players running the game in a modern browser.
- Developers extending game systems, AI, rendering, and in-browser logic.

## Main capabilities

- Procedural galaxy and star system generation.
- AI-driven ship behaviour with pilots, jobs, and autopilots.
- Combat and projectile systems with weapons, turrets, and factions.
- Canvas-based rendering for starfields, ships, HUD, and visual effects.

## Tech stack

- Runtime: Browser JavaScript with ES modules.
- Framework: None.
- Build tool: None. The app runs directly from `index.html`.
- Package manager: npm, used only for dev dependencies and linting.
- Entry point: `index.html` loads `src/core/game.js` as an ES module.
- Main source folders: `src/` containing `autopilot/`, `camera/`, `core/`, `job/`, `pilot/`, `ship/`, `starSystem/`, `ui/`, and `weapon/`.

## Important commands

- `npm run lint`

## Notes

- The source code is the source of truth; docs should be updated if implementation changes.
- This repo has no runtime build or bundling step in the main app flow.
- `POC/` contains experimental proof-of-concept files outside the main game source.
