// /src/starSystem/projectile.js

import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';

/**
 * A lightweight data holder for a projectile (e.g., Rail Gun tungsten slug).
 * Contains position, velocity, and metadata, managed by ProjectileManager.
 */
export class Projectile {
    /**
     * Creates a new Projectile instance.
     */
    constructor() {
        /** @type {Vector2D} Current position in world coordinates. */
        this.position = new Vector2D(0, 0);
        /** @type {Vector2D} Velocity in units/s. */
        this.velocity = new Vector2D(0, 0);
        /** @type {Vector2D} Position for rendering (trail start). */
        this.originalPosition = new Vector2D(0, 0);
        /** @type {number} Time (in seconds) when projectile expires. */
        this.expirationTime = 0;
        /** @type {number} Index into ProjectileManager.projectileTypes. */
        this.typeIndex = 0;
        /** @type {boolean} Whether the projectile is active. */
        this.isActive = false;
        /** @type {Ship|null} The ship that fired the projectile, or null. */
        this.owner = null;

        if (new.target === Projectile) Object.seal(this);
    }

    /**
     * Resets the projectile for reuse.
     * @param {Vector2D} position - Spawn position.
     * @param {Vector2D} velocity - Initial velocity.
     * @param {Vector2D} originalPosition - Position for rendering.
     * @param {number} typeIndex - Projectile type index.
     * @param {number} expirationTime - Time (in seconds) when projectile expires.
     * @param {Ship|null} owner - The ship that fired the projectile, or null.
     */
    reset(position, velocity, originalPosition, typeIndex, expirationTime, owner) {
        this.position.set(position);
        this.velocity.set(velocity);
        this.originalPosition.set(originalPosition);
        this.expirationTime = expirationTime;
        this.typeIndex = typeIndex;
        this.isActive = true;
        this.owner = owner;
    }
}