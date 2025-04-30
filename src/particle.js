// particle.js

import { Vector2D } from './vector2d.js';

/**
 * A lightweight data holder for a particle (e.g., spark line, explosion).
 * Contains position, velocity, and metadata, managed by ParticleManager.
 */
export class Particle {
    /**
     * Creates a new Particle instance.
     */
    constructor() {
        /** @type {Vector2D} Current position in world coordinates. */
        this.position = new Vector2D(0, 0);
        /** @type {Vector2D} Velocity in units/s (for spark lines) or expansion speed (for explosions). */
        this.velocity = new Vector2D(0, 0);
        /** @type {number} Time (in seconds) when particle expires. */
        this.expirationTime = 0;
        /** @type {number} Index into ParticleManager.particleTypes. */
        this.typeIndex = 0;
        /** @type {boolean} Whether the particle is active. */
        this.isActive = false;
        /** @type {number} Length of spark line (world units), or initial radius for explosions. */
        this.length = 0;
    }

    /**
     * Resets the particle for reuse.
     * @param {Vector2D} position - Spawn position.
     * @param {Vector2D} velocity - Initial velocity or expansion speed.
     * @param {number} typeIndex - Particle type index.
     * @param {number} expirationTime - Time (in seconds) when particle expires.
     * @param {number} length - Length for spark lines or initial radius for explosions.
     */
    reset(position, velocity, typeIndex, expirationTime, length) {
        this.position.set(position);
        this.velocity.set(velocity);
        this.expirationTime = expirationTime;
        this.typeIndex = typeIndex;
        this.isActive = true;
        this.length = length;
    }
}