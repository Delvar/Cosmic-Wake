# Cosmic Wake - Project Documentation

Cosmic Wake is a space simulation game built with vanilla JavaScript and Canvas. It features a procedurally-generated galaxy with multiple star systems, ships with AI pilots, faction relationships, and dynamic combat and trading mechanics.

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
- Initializes planets, jump gates, asteroid belts, and hyperlanes
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
- Render as colored circles with optional rings and labels
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
- **Base Class:** `Job` - defines interface for ship behaviors
- **Implementations:**
  - `WandererJob` - civilian ships travel between planets and systems
  - `OfficerJob` - patrol and attack hostile ships
  - `EscortJob` - follow and defend another ship
  - `MinerJob` - mine asteroids and return to home planet

### Autopilots
- **Files:** `autopilot.js`, `attackAutopilot.js`
- **Base Class:** `Autopilot` - tactical navigation and maneuvers
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
- RGBA color representation with static color constants
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
- **Avoid:** Maneuvering around obstacle
- **Attack:** Combat engagement
- **Despawning:** Landing and disappearing

#### Job States (example: WandererJob)
- **Starting:** Initial setup, taking off
- **Planning:** Calculating route
- **Traveling:** Moving toward target
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
- **In-Place Math:** Vector operations minimize allocations
- **Scratch Vectors:** Temporary vectors reused across frames

---

## Testing Infrastructure

### Test Bench
- **File:** `TestAsteroidPerformance.html`
- Benchmarks asteroid rendering methods (JS, Canvas SaveRestore, Path2D, etc.)
- Compares FPS across different draw strategies
- Reference for optimization targets

---

## Build & Deployment

- **Module System:** ES6 modules (import/export)
- **Entry Point:** `index.html` loads game via `<script>` tag
- **Configuration:** `jsconfig.json` for IDE support
- **Linting:** `eslint.config.mjs`
- **Deployment:** Static files (no build step required)