# Performance guidelines

This document defines project-specific performance conventions for this JavaScript app.

Agents must follow these rules when modifying hot paths, rendering code, physics, animation, projectiles, particles, vector maths, input processing, and per-frame update loops.

If the task is not performance-sensitive, prefer simple readable code. Do not apply these patterns unnecessarily outside hot paths.

---

## Performance-sensitive areas

Treat these areas as performance-sensitive unless told otherwise:

- Canvas rendering
- Animation loops
- Physics updates
- Collision detection
- Projectile systems
- Particle systems
- Vector maths
- Per-frame input handling
- Entity update loops
- Camera transforms
- Any code called from `requestAnimationFrame`

Before changing these areas:

1. Check for existing scratch variables.
2. Check for object pools.
3. Avoid new per-frame allocations.
4. Prefer in-place operations.
5. Preserve existing loop style.
6. Run relevant tests or manual performance checks.

---

## Allocation avoidance in hot paths

Avoid creating new objects, arrays, vectors, closures, or temporary structures inside hot paths.

Avoid:

```javascript
update(deltaTime) {
  const velocity = new Vector2(this.direction.x, this.direction.y);
  const nextPosition = this.position.add(velocity.multiply(deltaTime));

  this.position = nextPosition;
}
```

Prefer:

```javascript
update(deltaTime) {
  this._scratchVelocity
    .set(this.direction)
    .multiplyInPlace(deltaTime);

  this.position.addInPlace(this._scratchVelocity);
}
```

Rules:

* Do not allocate temporary vectors inside per-frame methods.
* Do not allocate arrays inside render, update, collision, or particle loops.
* Do not create new closures inside loops.
* Do not use `map`, `filter`, `reduce`, `splice`, or spread syntax in hot paths if they allocate.
* Prefer pre-allocated scratch objects.
* Prefer in-place mutation for temporary calculations.
* Keep allocations in setup, constructors, loading, or reset methods where practical.

---

## Scratch variables

Use pre-allocated scratch variables for temporary values in hot paths.

Scratch instance fields should be prefixed with `_scratch`.

Example:

```javascript
// /src/projectiles/projectile.js

export class Projectile {
  constructor() {
    /** @type {Vector2} */
    this.position = new Vector2(0.0, 0.0);

    /** @type {Vector2} */
    this.velocity = new Vector2(0.0, 0.0);

    /** @type {Vector2} */
    this._scratchMovement = new Vector2(0.0, 0.0);

    Object.seal(this);
  }

  /**
   * Updates the projectile position.
   *
   * @param {number} deltaTime - Elapsed time in seconds.
   * @returns {void}
   */
  update(deltaTime) {
    this._scratchMovement
      .copyFrom(this.velocity)
      .scaleInPlace(deltaTime);

    this.position.addInPlace(this._scratchMovement);
  }
}
```

Rules:

* Prefix scratch fields with `_scratch`.
* Allocate scratch objects in the constructor.
* Add JSDoc `/** @type */` for scratch fields.
* Do not expose scratch objects outside the owning class.
* Do not store scratch references in other objects.
* Do not use scratch objects for persistent state.
* Reset scratch objects before reuse if required.
* If the object is sealed, initialise all scratch fields before `Object.seal(this)`.

---

## Shared scratch variables

Prefer instance scratch variables over shared module-level scratch variables.

Instance scratch variables are safer because they avoid accidental cross-object interference.

Acceptable:

```javascript
this._scratchDirection = new Vector2(0.0, 0.0);
this._scratchOffset = new Vector2(0.0, 0.0);
```

Use module-level scratch variables only when:

* The function is clearly not re-entrant.
* The scratch object is not exposed.
* The code path is performance-critical.
* The convention already exists in that module.

If using module-level scratch variables, document the non-reentrant behaviour.

```javascript
/** @type {Vector2} */
const _scratchProjectedPoint = new Vector2(0.0, 0.0);
```

---

## In-place vector operations

Prefer in-place vector operations in hot paths.

Preferred methods:

```javascript
addInPlace()
subtractInPlace()
multiplyInPlace()
normaliseInPlace()
set()
```

Avoid allocation-returning vector operations in hot paths:

```javascript
const movement = velocity.multiply(deltaTime);
const nextPosition = position.add(movement);
```

Prefer:

```javascript
this._scratchMovement
  .set(velocity)
  .multiplyInPlace(deltaTime);

position.addInPlace(this._scratchMovement);
```

Rules:

* Use allocation-returning vector operations only outside hot paths, or where clarity is more important than performance.
* In hot paths, prefer `set`, and `*InPlace` methods.
* Do not mutate input parameters unless the method name or JSDoc clearly states that it mutates them.
* If a method mutates its receiver, its name should usually end with `InPlace`.

Example JSDoc:

```javascript
/**
 * Adds another vector to this vector.
 *
 * Mutates this vector.
 *
 * @param {Vector2} other - Vector to add.
 * @returns {Vector2} This vector.
 */
addInPlace(other) {
  this.x += other.x;
  this.y += other.y;
  return this;
}
```

---

## Float literals

Use explicit float-style numeric literals in maths-heavy code.

Preferred:

```javascript
const speed = 0.0;
const alpha = 1.0;
const half = 0.5;
```

Avoid:

```javascript
const speed = 0;
const alpha = 1;
```

Rules:

* Use `0.0` and `1.0` in vector maths, rendering, physics, interpolation, and animation code.
* Use normal integer literals for counts, indexes, lengths, and IDs unless the existing file uses float-style literals consistently.
* Preserve the style of the surrounding file where it is already consistent.

Examples:

```javascript
this.position.set(0.0, 0.0);
this.opacity = 1.0;
this.rotation = 0.0;
```

For indexes:

```javascript
for (let i = 0; i < particles.length; i++) {
  particles[i].update(deltaTime);
}
```

---

## Loop style

Prefer simple `for` loops in hot paths.

Preferred:

```javascript
for (let i = 0; i < particles.length; i++) {
  particles[i].update(deltaTime);
}
```

Avoid in hot paths:

```javascript
particles.forEach((particle) => {
  particle.update(deltaTime);
});
```

Also avoid allocation-heavy patterns in hot paths:

```javascript
const activeParticles = particles.filter((particle) => particle.isActive);
```

Prefer:

```javascript
for (let i = 0; i < particles.length; i++) {
  const particle = particles[i];

  if (!particle.isActive) {
    continue;
  }

  particle.update(deltaTime);
}
```

Rules:

* Use `for` loops for per-frame arrays.
* Avoid `forEach`, `map`, `filter`, `reduce`, spread, and destructuring in hot paths if they allocate or obscure control flow.
* Cache `length` only if the surrounding code already uses that style or profiling shows benefit.

Optional project-specific style:

```javascript
const length = testArray.length;
for (let i = 0; i < length; i++) {
  // ...
}
```

---

## Object pooling

Use object pools for high-churn objects such as:

* Projectiles
* Particles
* Damage numbers
* Temporary effects
* Collision contacts
* Render commands
* Short-lived vectors in very hot systems

Object pooling is preferred when objects are created and destroyed frequently during gameplay or animation.

Example:

```javascript
export class ProjectilePool {
  constructor() {
    /** @type {Projectile[]} */
    this._availableProjectiles = [];

    /** @type {Projectile[]} */
    this._activeProjectiles = [];

    Object.seal(this);
  }

  /**
   * Gets a projectile from the pool.
   *
   * @returns {Projectile} Projectile instance.
   */
  acquire() {
    const projectile = this._availableProjectiles.pop() ?? new Projectile();

    projectile.reset();
    this._activeProjectiles.push(projectile);

    return projectile;
  }

  /**
   * Returns a projectile to the pool.
   *
   * @param {Projectile} projectile - Projectile to release.
   * @returns {void}
   */
  release(projectile) {
    projectile.reset();

    const index = this._activeProjectiles.indexOf(projectile);

    if (index !== -1) {
      removeAtIndexInPlace(index, this._activeProjectiles);
    }

    this._availableProjectiles.push(projectile);
  }
}
```

Rules:

* Use pools for high-frequency create/destroy objects.
* Reset pooled objects before reuse.
* Do not keep references to released pooled objects.
* Avoid releasing the same object twice.
* Keep pool ownership clear.
* Prefer one pool per object type.
* Do not use pooling for low-frequency objects where it adds unnecessary complexity.

---

## Pooled object reset pattern

Pooled objects should expose a `reset` method.

Example:

```javascript
export class Particle {
  constructor() {
    /** @type {boolean} */
    this.isActive = false;

    /** @type {Vector2} */
    this.position = new Vector2(0.0, 0.0);

    /** @type {Vector2} */
    this.velocity = new Vector2(0.0, 0.0);

    /** @type {number} */
    this.lifeSeconds = 0.0;

    /** @type {number} */
    this.maxLifeSeconds = 0.0;

    Object.seal(this);
  }

  /**
   * Resets the particle before reuse.
   *
   * @returns {void}
   */
  reset() {
    this.isActive = false;
    this.position.set(0.0, 0.0);
    this.velocity.set(0.0, 0.0);
    this.lifeSeconds = 0.0;
    this.maxLifeSeconds = 0.0;
  }
}
```

Rules:

* `reset` must restore all mutable fields.
* `reset` must not allocate where avoidable.
* `reset` should not leave stale references to other objects.
* `reset` should be called before reusing an object.
* If an object is pooled, document it in the class JSDoc or module doc.

---

## Hot path comments

Performance-sensitive code should include short comments explaining non-obvious choices.

Example:

```javascript
// Intentionally uses a for loop and scratch vector to avoid per-frame allocations.
for (let i = 0; i < this._activeParticles.length; i++) {
  const particle = this._activeParticles[i];
  particle.update(deltaTime);
}
```

Do not add noisy comments for obvious code.

---

## When not to optimise

Do not apply performance patterns everywhere.

Prefer straightforward readable code when:

* The code is not called often.
* The object is not created frequently.
* The code is setup, configuration, loading, or UI-only.
* The performance benefit is unclear.
* The optimisation would make the code harder to maintain.

Before adding pooling or scratch objects outside known hot paths, explain why the code is performance-sensitive.

---

## Agent checklist

Before changing performance-sensitive code, confirm:

* Is this code called per frame or many times per frame?
* Did I avoid new allocations in the hot path?
* Did I reuse existing scratch variables where available?
* If I added scratch variables, did I initialise them in the constructor?
* If the object is sealed, did I initialise scratch fields before `Object.seal(this)`?
* Did I use in-place vector operations?
* Did I avoid `map`, `filter`, `reduce`, `forEach`, `splice`, spread, and closure allocation in hot paths?
* Did I preserve existing loop style?
* If projectiles, particles, or temporary effects are involved, did I check for an existing object pool?
* Did I reset pooled objects fully before reuse?
* Did I avoid retaining references to released pooled objects?
* Did I run relevant tests or manual performance checks?