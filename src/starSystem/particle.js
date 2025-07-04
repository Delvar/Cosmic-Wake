// /src/starSystem/particle.js

import { Vector2D } from '/src/core/vector2d.js';

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
        this.position = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Velocity in units/s (for spark lines) or expansion speed (for explosions). */
        this.velocity = new Vector2D(0.0, 0.0);
        /** @type {number} Time (in seconds) when particle started. */
        this.startTime = 0.0;
        /** @type {number} Time (in seconds) how long the particle will live. */
        this.lifetime = 0.0;
        /** @type {number} Index into ParticleManager.particleTypes. */
        this.typeIndex = 0.0;
        /** @type {boolean} Whether the particle is active. */
        this.isActive = false;
        /** @type {number} Length of spark line (world units), or initial radius for explosions. */
        this.length = 0.0;

        if (new.target === Particle) Object.seal(this);
    }

    /**
     * Resets the particle for reuse.
     * @param {Vector2D} position - Spawn position.
     * @param {Vector2D} velocity - Initial velocity or expansion speed.
     * @param {number} typeIndex - Particle type index.
     * @param {number} startTime - Time (in seconds) when particle started.
     * @param {number} startTime - Time (in seconds) how long the particle will live.
     * @param {number} length - Length for spark lines or initial radius for explosions.
     */
    reset(position, velocity, typeIndex, startTime, lifetime, length) {
        this.position.set(position);
        this.velocity.set(velocity);
        this.startTime = startTime;
        this.lifetime = lifetime;
        this.typeIndex = typeIndex;
        this.isActive = true;
        this.length = length;
    }
}