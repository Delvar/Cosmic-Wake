# App structure

## High-level layout

```text
.
├── package.json
├── index.html
├── jsconfig.json
├── src/
│   ├── autopilot/
│   ├── camera/
│   ├── core/
│   ├── job/
│   ├── pilot/
│   ├── ship/
│   ├── starSystem/
│   ├── ui/
│   └── weapon/
├── docs/
│   ├── atlas/
│   └── TODO-Details/
├── POC/
└── TODO.md
```

## Entry points

- `index.html`: main browser shell and runtime entry.
- `src/core/game.js`: game bootstrap, main loop, rendering, and update coordination.

## Main source folders

- `src/autopilot/`: autopilot behaviours and navigation logic.
- `src/camera/`: camera control, starfield rendering, and HUD placement.
- `src/core/`: core game systems, utility classes, and shared state.
- `src/job/`: job-based AI behaviour and high-level ship tasks.
- `src/pilot/`: player and AI pilot implementations.
- `src/ship/`: ship definitions, ship behaviour, and ship-related systems.
- `src/starSystem/`: galaxy/world objects, system creation, and environment updates.
- `src/ui/`: HUD and UI overlays.
- `src/weapon/`: weapons, projectiles, and combat logic.

## Notes for future changes

- The runtime is static; there is no bundler or production build step for the main app.
- `jsconfig.json` is editor support for the current source layout, not a build configuration.
- `POC/` is experimental code separate from the main game.
- Use the existing folder categories instead of creating parallel modules.

## Common change locations

- Game loop: `src/core/game.js`, `src/core/`
- World generation: `src/core/galaxy.js`, `src/starSystem/`
- Ship behaviour: `src/ship/`, `src/pilot/`, `src/job/`
- Autopilot: `src/autopilot/`
- Combat: `src/weapon/`, `src/ship/`
- Camera/UI: `src/camera/`, `src/ui/`
- Shared utilities: `src/core/`
