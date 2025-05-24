// /src/core/gameObject.js

import { Vector2D } from '/src/core/vector2d.js';

/**
 * Checks if a target is still valid (not despawned and exists in the galaxy).
 * @param {GameObject} source - The source game object to validate.
 * @param {GameObject} target - The target game object to validate.
 * @returns {boolean} True if the target is valid, false otherwise.
 */
export function isValidTarget(source, target) {
    if (source === target) return false;
    if (!source || !target) return false;
    if (!(source instanceof GameObject) || !(target instanceof GameObject)) return false;
    if (source.isDespawned() || target.isDespawned()) return false;
    if (source.starSystem !== target.starSystem) return false;
    return true;
}

/**
 * Represents a base game object with position and despawn functionality.
 */
export class GameObject {
    /**
     * Creates a new GameObject instance.
     * @param {Vector2D} position - The position of the object in world coordinates.
     * @param {StarSystem} starSystem - The star system the object belongs to.
     */
    constructor(position, starSystem) {
        this.position = position.clone();
        this.radius = 0;
        this.velocity = new Vector2D(0, 0);
        this.starSystem = starSystem;
        this.despawned = false;
        this.debug = false;
    }

    /**
     * Marks the object as despawned, removing it from active gameplay.
     */
    despawn() {
        this.despawned = true;
        this.position.set(0, 0);
        this.debug = false;
        if (this.starSystem) {
            this.starSystem.removeGameObject(this);
        }
        this.starSystem = null;
    }

    /**
     * Checks if the object has been despawned.
     * @returns {boolean} True if the object is despawned, false otherwise.
     */
    isDespawned() {
        return this.despawned;
    }

    /**
     * Checks if the point is within the GameObject's radius.
     * @param {Vector2D} point - The position in world coordinates.
     * @returns {boolean} True if the GameObject overlaps point, false otherwise.
     */
    overlapsPoint(point) {
        const dx = this.position.x - point.x;
        const dy = this.position.y - point.y;
        return (dx * dx + dy * dy) < (this.radius * this.radius);
    }
}