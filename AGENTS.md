# Cosmic Wake - Project Documentation

Cosmic Wake is a space simulation game built with vanilla JavaScript and Canvas. It features a procedurally-generated galaxy with multiple star systems, ships with AI pilots, faction relationships, and dynamic combat and trading mechanics.
- The code uses UK English spellings (e.g., "optimise", "behaviour", "colour", "manoeuvre").

## Specialization

- Understand the project’s core architecture: game loop, star systems, ships, AI pilots, jobs, autopilots, weapons, effects, UI.
- Prefer working within the existing file structure (e.g., `game.js`, `ship.js`, `pilot.js`, `galaxy.js`, etc.).
- Recommend and implement changes that follow project patterns (e.g., in-place vector math, object pooling, state machines, scratch vectors as instance properties).
- Prioritise performance by minimising allocations (scratch variables, object pools, in-place vector edits) to avoid garbage collection stalls.

## Performance Guidelines

- Avoid heap allocations in hot paths: reuse objects, arrays, and vectors.
- Use **instance scratch vectors** (prefixed `_scratch*`, created in constructor) for all temporary math. Use clear purpose names (e.g. `_scratchThrustVector`).
- Favour **in-place vector operations** (`addInPlace`, `subtractInPlace`, `multiplyInPlace`, etc.) over new `Vector2D` instances.
- Pre-allocate all scratch vectors in constructor.
- Use object pools for frequently spawned entities (particles, projectiles, asteroids).
- Keep update/render loops lean and allocation-free per frame.
- Use float literals consistently (e.g. `0.0`, `1.0`).
- In loops prefer `for (let i = 0.0; i < length; i++)`.

## Coding Conventions

- Every file must begin with a file path comment from the project root:
  ```javascript
  // /src/ship/ship.js
  ```
- Imports must use root-based paths:
  ```javascript
  import { Camera } from '/src/camera/camera.js';
  ```
- Every class and public method must have a clear JSDoc comment explaining intent, parameters, and return values.

### JSDoc Standards

To ensure consistent documentation across all files, follow these guidelines when creating or updating JSDocs:
- **File Header**: Every file must begin with a full path comment (e.g., `// /src/folder/file.js`) followed by a blank line.
- **Imports**: All imports must use root-based full paths (e.g., `import { Class } from '/src/folder/class.js';`).
- **Class and Method Comments**: 
  - Every class and public method requires a clear JSDoc comment.
  - Include a brief description explaining intent and behaviors.
  - Use @param {Type} name - Description for each parameter.
  - Always include @returns {Type} - Description, even if it's @returns {void} for methods that return nothing.
  - Add other tags (e.g., @private for private methods) as needed.
- **Properties**: Use inline /** @type {Type} Description */ comments for class properties.
- **Updates**: When updating JSDocs, ensure descriptions are accurate and detailed without changing code logic. Prefer in-place updates to maintain performance patterns.

Example for a method:
```javascript
   /**
    * Updates the UI based on context.
    * @param {Context} context - The context to use.
    * @returns {void}
    */
   update(context) { ... }
```

- Boolean properties and methods must use `is*`/`has*`/`can*` prefix (e.g. `isThrusting`, `hasCargo`, `canLand`).
- Private methods and scratch properties prefixed with `_`.
- Use state machine pattern with `this.stateHandlers` object mapping states to bound handler methods.
- Use `Object.seal(this)` in base class constructors only when `new.target === Class` (allowing inheritance):
  ```javascript
  if (new.target === Shield) Object.seal(this);
  ```
- Follow exact patterns from `ship.js`: scratch vectors, in-place ops, `Colour` class, `remapClamp`/`lerp`/`normalizeAngle` from utils, `ctx.save/restore` in draw methods.

## Core Architecture

### 1. Game Loop & Rendering

- **File:** `game.js`
- **Class:** `Game`
- Manages the main game loop, canvas rendering, and frame updates
- Coordinates between StarSystem, camera, HUD, and star field
- Handles player input and target selection
- Renders game world, HUD, and target view

### 2. Galaxy & Star Systems

- **File:** `galaxy.js`
- **Function:** `createGalaxy()`
- Creates three star systems: Sol, Alpha Centauri, Proxima Centauri
- Initialises planets, jump gates, asteroid belts, and hyperlanes
- Sets up faction relationships between systems

### 3. Star System Management

- **File:** `starSystem.js`
- **Class:** `StarSystem`
- Container for planets, ships, jump gates, and asteroid belts
- Manages ship spawning with AI population limits
- Coordinates projectile, particle, and asteroid updates

---

## Game Objects

### Ships

- **Files:** `ship.js`, `shipTypes.js`
- **Base Class:** `Ship extends GameObject`
- **Subclasses:** Shuttle, HeavyShuttle, StarBarge, Freighter, Arrow, Boxwing, Interceptor, Fighter
- **Properties:** position, velocity, health, faction, autopilot, trail
- **States:** Flying, Landed, JumpingOut, JumpingIn, Disabled
- **Features:** bounding box, feature points (engines, turrets, lights)

### Celestial Bodies

- **File:** `celestialBody.js`
- **Classes:** Star, Planet, JumpGate
- Render as coloured circles with optional rings and labels
- Planets support landing mechanics and docking

### Asteroids

- **File:** `asteroidBelt.js`
- **Class:** Asteroid
- Interactive objects that can be mined or collided with
- Rendered as polygon shapes with rotation

---

## AI & Piloting

### Pilots

- **File:** `pilot.js`
- **Base Class:** `Pilot` (abstract)
- **Player Pilot:** `PlayerPilot` - human-controlled via input
- **AI Pilots:** `AiPilot` - base class with state machine
  - **Subtypes:** CivilianAiPilot, PirateAiPilot, OfficerAiPilot

### Jobs

- **File:** `job.js`
- **Base Class:** `Job` - defines interface for ship behaviours
- **Implementations:**
  - `WandererJob` - civilian ships travel between planets and systems
  - `OfficerJob` - patrol and attack hostile ships
  - `EscortJob` - follow and defend another ship
  - `MinerJob` - mine asteroids and return to home planet

### Autopilots

- **Files:** `autopilot.js`, `attackAutopilot.js`
- **Base Class:** `Autopilot` - tactical navigation and manoeuvres
- **Navigation Modes:**
  - FlyToTarget, LandOnPlanet, LandOnAsteroid, TraverseJumpGate, Escort, Follow
- **Combat Modes:**
  - AttackAutopilot, OrbitAttackAutopilot
- **Evasion Modes:**
  - FleeAutopilot, AvoidAutopilot
- **States:** Approaching, Attacking, Orbiting, Complete, etc.

---

## Combat & Weapons

### Weapons

- **File:** `weapon.js`
- **Class:** `Weapon`
- Fires projectiles with cooldown and spread
- Integrated with ship turrets and fixed weapons

### Turrets

- **File:** `turret.js`
- **Class:** `Turret`
- Auto-aiming turrets that track and fire on hostile targets
- Mounted on specific feature points of ships

### Projectiles

- **File:** `projectile.js`, `projectileManager.js`
- **Class:** `Projectile` - lightweight data holder
- **Manager:** `ProjectileManager`
  - Spawns, updates, and renders projectiles
  - Handles collision detection with ships
  - Draws projectiles as fading white lines with gradient

---

## Visual Effects

### Particles

- **Files:** `particle.js`, `particleManager.js`
- **Class:** `Particle` - spark lines and explosions
- **Manager:** `ParticleManager`
  - Spawns explosion particles scaled by radius
  - Manages particle lifetime and updating

### Trails

- **File:** `trail.js`
- **Class:** `Trail`
- Renders ship engine trails as tapering ribbon
- Uses ring buffer for efficient point management
- Fades with age and width decay

### Star Field

- **Files:** `starField.js`, `starFieldWorker.js`
- **Class:** `StarField`
- Procedurally generates infinite star field
- Uses web worker (`StarFieldWorker`) for off-thread generation
- Tessellates on grid cells for visibility culling

---

## Camera & UI

### Camera

- **File:** `camera.js`
- **Classes:** `Camera`, `TargetCamera`
- World-to-screen coordinate transformation
- Zoom and pan controls
- Follows player ship or tracks targets

### Heads-Up Display

- **File:** `headsUpDisplay.js`
- **Class:** `HeadsUpDisplay`
- Renders HUD elements: compass, velocity, status, faction icons
- Displays current job/autopilot status

### Factions & Relationships

- **File:** `faction.js`
- **Enum:** `FactionRelationship` - Allied, Neutral, Hostile
- **Classes:** `Faction`, `FactionManager`
- Manages faction-to-faction relationships (symmetric)
- Affects hostility, targeting, and NPC interactions

---

## Utilities

### Vector2D

- **File:** `vector2d.js`
- **Class:** `Vector2D`
- 2D vector math with in-place operations for performance
- **Methods:** magnitude, distance, normalize, lerp, dot product
- **Aliases:** width/height for use as dimensions

### Math & Utils

- **File:** `utils.js`
- **Constants:** TWO_PI, HALF_PI
- **Functions:** remapClamp(), clamp(), randomBetween(), normalizeAngle()
- **Array operations:** removeObjectFromArrayInPlace()

### Colour

- **File:** `colour.js`
- **Class:** `Colour`
- RGBA colour representation with static colour constants
- **Methods:** toRGB(), toRGBA(), interpolation

### Game Object

- **File:** `gameObject.js`
- **Base Class:** `GameObject`
- Base for all world objects (Ship, CelestialBody, Asteroid)
- **Properties:** position, velocity, radius, star system, faction
- Collision detection helpers

### Ship Name Generator

- **File:** `shipNameGenerator.js`
- **Class:** `ShipNameGenerator`
- Generates faction-appropriate ship names from word lists
- **Supports:** Positive, Negative, Neutral, and Fun name styles

---

## Data Flow

### Key State Machines

#### Ship States

- **Flying:** Active in space
- **Landed:** Docked at celestial body
- **JumpingOut:** Animation leaving via jump gate
- **JumpingIn:** Animation entering via jump gate
- **Disabled:** Non-functional, can be boarded

#### Pilot States (AiPilot)

- **Job:** Executing assigned job
- **Flee:** Running from threat
- **Avoid:** Manoeuvring around obstacle
- **Attack:** Combat engagement
- **Despawning:** Landing and disappearing

#### Job States (example: WandererJob)

- **Starting:** Initial setup, taking off
- **Planning:** Calculating route
- **Travelling:** Moving toward target
- **Waiting:** Docked, waiting before next leg
- **Failed:** Unable to proceed

#### Autopilot States (example: AttackAutopilot)

- **Approaching:** Moving to attack range
- **Attacking:** In range, firing on target
- **Orbiting:** Maintaining orbital distance
- **Complete:** Success or failure

---

## Performance Considerations

- **Object Pooling:** Projectiles and Particles reuse objects
- **Ring Buffers:** Trails use efficient circular buffers
- **Spatial Culling:** Star field uses grid cells for visibility
- **Web Workers:** Star field generation off-thread
- **In-Place Math:** Vector operations minimise allocations
- **Scratch Vectors:** Temporary vectors reused across frames

---

## Build & Deployment

- **Module System:** ES6 modules (import/export)
- **Entry Point:** `index.html` loads game via `<script>` tag
- **Configuration:** `jsconfig.json` for IDE support
- **Linting:** `eslint.config.mjs` (only lint on request)
- **Deployment:** Static files (no build step required)

---

## Project Planning

### TODO Roadmap
- **File:** `TODO.md`
- Tracks planned gameplay systems, UI work, and other roadmap items that have not been implemented yet
- Use it to record feature ideas as actionable tasks with enough detail to guide future implementation
- Prefer adding entries that describe both the player-facing feature and any supporting system work needed behind it

---

## Tools & Behaviour (for Cosmic Wake Dev Agent)

### Tools

Prefer using these tools (in order):
1. **File Editor** (open/modify files)
2. **Search**
Avoid using unnecessary / unrelated tools; do not perform a post-edit lint or formatting step unless explicitly asked.

### Behaviour

- Keep responses short, focused, and actionable.
- When reviewing or editing existing code: if it does not fully match these standards, notify the user and ask if they want it updated. If already editing the file for other reasons, silently bring it up to standard and mention the changes made at the end.
- When the user raises an idea, feature, or change: acknowledge it, discuss trade-offs/clarifications, and only implement once we agree on the approach.
- When proposing code changes: show exact diffs or file edits using the required 4-backtick format.
- If something is unclear, ask a clarifying question before implementing.
- If asked for “what just happened” or “how to run”, be explicit about commands for Windows/VS Code.
- Example prompts:
  - “Fix the AI pilot never leaving orbit after combat in `pilot.js`.”
  - “Add a new ship type with two turrets and a custom name pattern.”
  - “Explain how `ProjectileManager` detects collisions.”
  - “Update JSDoc Comments for `ProjectileManager`.”