# Module: Star System

## Responsibility

The starSystem module models the game universe at the star-system level.
It owns the spatial containers for stars, planets, asteroid belts, jump gates, ships, cargo containers, projectiles, and particles.

This module coordinates:

- star system composition and initialization
- star system boundary object management (`ships`, `planets`, `stars`, `jumpGates`, `asteroids`)
- hyperlane and jump gate linking
- procedural asteroid belt generation, rendering, and caching
- dynamic in-system managers for projectiles, particles, and cargo containers
- selection helpers for random valid system targets

## Main files

- `src/starSystem/starSystem.js`
- `src/starSystem/celestialBody.js`
- `src/starSystem/asteroidBelt.js`
- `src/starSystem/cargoContainerManager.js`
- `src/starSystem/cargoContainer.js`
- `src/starSystem/projectileManager.js`
- `src/starSystem/particleManager.js`

## Existing patterns

- `StarSystem` is the domain container.
  - It owns collections of objects and managers for the current system.
  - It exposes `addGameObject()`/`removeGameObject()` to keep collections synchronized.
  - It initializes jump gates from hyperlane connections and links target gates separately.
- Celestial bodies are lightweight renderable game objects.
  - `CelestialBody` extends `GameObject`, and `Planet`, `Star`, `JumpGate` are represented through it.
  - Planetary rings and visual presentation are handled in the body class.
- Asteroid belts are procedural and cache-heavy.
  - `AsteroidBelt` stores precomputed shapes and sparse cell caches for background rendering.
  - It keeps a separate `interactiveAsteroids` list for gameplay objects.
- Managers live inside star systems.
  - `CargoContainerManager`, `ProjectileManager`, and `ParticleManager` handle lifecycle, update, and draw concerns for transient objects.
- The module is spatially-focused.
  - It models in-system object relationships, not high-level mission logic.

## Things to avoid

- Avoid moving business or AI decisions into starSystem.
  - Star system code should not decide how ships choose targets or when they jump.
- Avoid adding UI logic here.
  - Rendering helpers are okay, but DOM/UI state belongs elsewhere.
- Avoid mutating star system collections directly.
  - Use `addGameObject()`, `removeGameObject()`, or manager APIs to keep state consistent.
- Avoid adding non-system-specific data to this module.
  - `starSystem/` should remain focused on the spatial universe layer.
- Avoid bypassing `linkTargetGates()` after hyperlane setup.
  - The jump gate network expects linked source/target gates.

## Tests

- There are no dedicated automated tests for the starSystem module in this repository.
- If tests are added, priority cases are:
  - `StarSystem` object add/remove and star system initialization
  - hyperlane/jump gate linking and target gate consistency
  - `AsteroidBelt` generation, caching, and `getRandomAsteroid()`
  - cargo container lifecycle and collision detection with ships
  - `ProjectileManager` and `ParticleManager` update/render behavior

## Change guidance

When editing the starSystem module:

1. Focus on universe state and object containment.
2. Keep orbital and belt generation separate from ship and AI decision logic.
3. Preserve collection synchronization between star system arrays and manager state.
4. Use scratch vectors for rendering calculations to avoid allocations.
5. Update this module doc if the system object model or manager boundaries change.

## Open questions

- Should star system managers be extracted into a shared `systemManagers/` subfolder?
- Would `Hyperlane` and jump gate setup be clearer if moved to a dedicated graph module?
- Is the current distinction between background asteroid generation and interactive asteroids the best long-term split?
- Should system-level random selection helpers be made more generic or reused by other managers?
