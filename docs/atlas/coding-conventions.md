# Coding conventions

This document defines project-specific coding conventions for this JavaScript app.

Agents must follow these conventions when creating or modifying code.

If existing code conflicts with this document, prefer this document unless the task explicitly says to preserve the existing local pattern. If unsure, ask or flag the conflict in the change summary.

---

## File headers

Each source file should start with a path header using this format:

```javascript
// /src/folder/file.js
```

Example:

```javascript
// /src/camera/camera.js
```

Rules:

* Use the repo-root-relative path.
* Use forward slashes.
* Keep the header as the first line of the file.
* Update the header if the file is moved.

---

## JSDoc standards

Use JSDoc for classes, public methods, important private methods, and exported functions.

### Class comments

Use a short description above each class.

```javascript
/**
 * Controls camera movement and viewport transforms.
 */
export class Camera {
  // ...
}
```

### Method comments

Document purpose, parameters, return values, and important side effects.

```javascript
/**
 * Moves the camera by the supplied world-space offset.
 *
 * @param {number} deltaX - Horizontal movement in world units.
 * @param {number} deltaY - Vertical movement in world units.
 * @returns {void}
 */
move(deltaX, deltaY) {
  // ...
}
```

### Return values

Use `@returns` for methods that return a value.

```javascript
/**
 * Gets whether the camera can zoom in further.
 *
 * @returns {boolean} True when zooming in is allowed.
 */
canZoomIn() {
  return this.zoom < this.maxZoom;
}
```

Use `@returns {void}` when documenting methods that intentionally return nothing.

### Inline property types

Use inline `/** @type */` comments for important instance properties, especially where type inference is unclear.

```javascript
/** @type {HTMLCanvasElement} */
this.canvas = canvas;

/** @type {CanvasRenderingContext2D} */
this.ctx = canvas.getContext('2d');

/** @type {number} */
this.zoom = 1;
```

### Private members

Private or internal methods should still be documented when they contain non-trivial logic.

```javascript
/**
 * Calculates the clamped zoom level.
 *
 * @private
 * @param {number} requestedZoom - Requested zoom level.
 * @returns {number} Clamped zoom level.
 */
_clampZoom(requestedZoom) {
  // ...
}
```

---

## Import rules

Use root-based absolute import paths from `/src`.

Preferred:

```javascript
import { Camera } from '/src/camera/camera.js';
import { InputController } from '/src/input/input-controller.js';
```

Avoid relative traversal for project modules:

```javascript
import { Camera } from '../../camera/camera.js';
```

Rules:

* Use `/src/...` imports for app source modules.
* Include the `.js` extension.
* Keep imports grouped at the top of the file.
* Prefer named exports and named imports.
* Avoid default exports unless the existing module already uses them.
* Do not introduce barrel files unless explicitly requested.

---

## Naming conventions

Use clear, descriptive names.

### Booleans

Boolean values and methods should use prefixes such as:

* `is`
* `has`
* `can`
* `should`
* `was`
* `will`

Examples:

```javascript
const isVisible = true;
const hasFocus = false;
const canMove = this.canMoveTo(targetX, targetY);
const shouldRenderDebugOverlay = this.isDebugEnabled;
```

Avoid vague boolean names:

```javascript
const visible = true;
const movement = false;
```

### Private members

Use a leading underscore for private or internal fields and methods.

```javascript
this._isDragging = false;

_handlePointerDown(event) {
  // ...
}
```

### Classes

Use `PascalCase` for classes.

```javascript
class CameraController {
  // ...
}
```

### Functions and methods

Use `camelCase` for functions and methods.

```javascript
updateCameraPosition() {
  // ...
}
```

### Constants

Use `UPPER_SNAKE_CASE` for module-level constants.

```javascript
const MAX_ZOOM = 4;
const DEFAULT_TILE_SIZE = 32;
```

### UK English

Use UK English spelling in names, comments, and documentation.

Preferred:

```javascript
colour
centre
initialise
normalise
behaviour
```

Avoid US spelling unless required by a browser API, third-party library, or existing external contract:

```javascript
color
center
initialize
normalize
behavior
```

Exception:

```javascript
ctx.fillStyle = colour;
```

Browser and Canvas APIs keep their standard names.

---

## State machine pattern

Use a `this.stateHandlers` object to define state-specific behaviour.

Preferred pattern:

```javascript
this.stateHandlers = {
  idle: {
    enter: () => this._enterIdle(),
    update: (deltaTime) => this._updateIdle(deltaTime),
    exit: () => this._exitIdle(),
  },
  dragging: {
    enter: () => this._enterDragging(),
    update: (deltaTime) => this._updateDragging(deltaTime),
    exit: () => this._exitDragging(),
  },
};
```

State transitions should go through a dedicated method.

```javascript
/**
 * Changes the current state.
 *
 * @param {string} nextState - State to activate.
 * @returns {void}
 */
_setState(nextState) {
  if (this.state === nextState) {
    return;
  }

  this.stateHandlers[this.state]?.exit?.();
  this.state = nextState;
  this.stateHandlers[this.state]?.enter?.();
}
```

Rules:

* Keep state names explicit.
* Do not spread state logic across unrelated conditionals.
* Prefer state handler methods over large `if` or `switch` blocks.
* Keep transition logic centralised.
* Document non-obvious state transitions.

---

## Object sealing

Use `Object.seal(this)` in base classes where the object shape should remain fixed after construction.

Example:

```javascript
class BaseController {
  constructor() {
    /** @type {boolean} */
    this.isEnabled = true;

    Object.seal(this);
  }
}
```

Rules:

* Initialise all expected instance properties before calling `Object.seal(this)`.
* Call `Object.seal(this)` at the end of the constructor.
* Do not add new instance properties after sealing.
* When extending a sealed base class, ensure subclass fields are initialised before the object is sealed.
* Do not remove `Object.seal(this)` to work around missing property initialisation. Add the missing property in the constructor instead.

If a subclass needs additional properties, check the project’s base class pattern before editing. If the base class seals too early, flag it rather than applying a workaround.

---

## Canvas rendering patterns

Canvas rendering must preserve context state.

Use `ctx.save()` and `ctx.restore()` around rendering operations that change context state.

Preferred:

```javascript
render(ctx) {
  ctx.save();

  ctx.translate(this.x, this.y);
  ctx.rotate(this.rotation);
  ctx.globalAlpha = this.opacity;

  ctx.drawImage(this.image, 0, 0);

  ctx.restore();
}
```

Avoid:

```javascript
render(ctx) {
  ctx.translate(this.x, this.y);
  ctx.rotate(this.rotation);
  ctx.globalAlpha = this.opacity;

  ctx.drawImage(this.image, 0, 0);
}
```

Rules:

* Pair every `ctx.save()` with a matching `ctx.restore()`.
* Use `try/finally` if rendering logic can throw or return early.
* Avoid leaking transforms, alpha, clipping, shadows, line width, fonts, or fill styles into later rendering.
* Keep rendering methods focused on drawing, not state transitions or input handling.

Use this pattern when early returns are possible:

```javascript
render(ctx) {
  ctx.save();

  try {
    if (!this.isVisible) {
      return;
    }

    ctx.translate(this.x, this.y);
    this._renderBody(ctx);
  } finally {
    ctx.restore();
  }
}
```

---

## Code organisation rules

Prefer:

* Small focused classes.
* Small focused methods.
* Existing abstractions.
* Explicit state transitions.
* Clear rendering boundaries.
* Tests or manual verification notes for behavioural changes.

Avoid:

* Duplicating existing utilities.
* Adding new patterns for one-off changes.
* Mixing rendering, input, state transitions, and persistence in one method.
* Broad rewrites during bug fixes.
* Silent behaviour changes during refactors.

---

## Agent checklist

Before changing code, confirm:

* Have I checked for existing components, utilities, or services?
* Am I using `/src/...` imports?
* Have I followed the JSDoc conventions?
* Are booleans named with `is`, `has`, `can`, `should`, `was`, or `will`?
* Are private/internal members prefixed with `_`?
* Have I used UK English unless an external API requires otherwise?
* If using state, have I followed the `this.stateHandlers` pattern?
* If touching sealed objects, are all properties initialised before `Object.seal(this)`?
* If rendering to canvas, have I used `ctx.save()` and `ctx.restore()` safely?
* Have I avoided removing or weakening tests?