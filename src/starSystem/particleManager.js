// /src/starSystem/particleManager.js

import { Vector2D } from '/src/core/vector2d.js';
import { Particle } from '/src/starSystem/particle.js';
import { removeObjectFromArrayInPlace, TWO_PI, randomBetween, remapClamp, clamp } from '/src/core/utils.js';
import { StarSystem } from '/src/starSystem/starSystem.js';
import { Camera } from '/src/camera/camera.js';

/**
 * Manages active particles in a star system, handling updates, rendering, and lifecycle.
 */
export class ParticleManager {
    /**
     * Creates a new ParticleManager instance.
     * @param {StarSystem} starSystem - The parent star system.
     */
    constructor(starSystem) {
        /** @type {StarSystem} The parent star system. */
        this.starSystem = starSystem;
        /** @type {Particle[]} Array of active Particle objects. */
        this.particles = [];
        /** @type {number} Accumulated time in seconds for expiration checks. */
        this.currentTime = 0;
        /** @type {Vector2D} Temporary vector for screen coordinates. */
        this._scratchScreenPos = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for line endpoints. */
        this._scratchLineEnd = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for velocity. */
        this._scratchVelocity = new Vector2D(0, 0);
    }

    /**
     * Static array of particle types.
     * @type {Array<{
     *   lineWidth?: number,
     *   minLength?: number,
     *   maxLength?: number,
     *   minSpeed?: number,
     *   maxSpeed?: number,
     *   lifetime?: number,
     * }>}
     */
    static particleTypes = [
        // Spark Line (Type 0)
        {
            lineWidth: 1,
            minLength: 5,
            maxLength: 50,
            minSpeed: 100,
            maxSpeed: 500,
            lifetime: 0.5
        },
        // Explosion (Shockwave + Fireball, Type 1)
        {
            minSpeed: 200,
            maxSpeed: 500
        }
    ];

    /**
     * Spawns particles for an explosion, scaling count and properties with radius.
     * @param {Vector2D} position - Explosion center.
     * @param {number} radius - Explosion radius (world units, e.g., 1–300).
     */
    spawnExplosion(position, radius) {
        if (this.particles.length >= 1000) {
            console.warn('Particle limit reached');
            return;
        }

        // Map radius (1–300) to effect intensity
        radius = clamp(radius, 1, 300);
        const t = remapClamp(radius, 1, 300, 0, 1);

        // Spawn Spark Lines (Type 0)
        const sparkType = ParticleManager.particleTypes[0];
        const sparkCount = radius <= 5 ? 0 : Math.floor(remapClamp(t, 0, 1, 3, 40)); // 5–20 sparks
        for (let i = 0; i < sparkCount; i++) {
            const particle = new Particle();
            const speed = remapClamp(t * t * randomBetween(0.75, 1.25), 0, 1, sparkType.minSpeed, sparkType.maxSpeed);
            const angle = randomBetween(0, TWO_PI);
            const velocity = this._scratchVelocity.setFromPolar(speed, angle);
            const length = randomBetween(sparkType.minLength, sparkType.maxLength);
            particle.reset(position, velocity, 0, this.currentTime, sparkType.lifetime * (randomBetween(1.0, 2.0) + t * 2), length);
            this.particles.push(particle);
        }

        // Spawn Explosion (Type 1, Shockwave + Fireball)
        const explosionType = ParticleManager.particleTypes[1];
        const particle = new Particle();
        const shockwaveRadius = remapClamp(t, 0, 1, radius * 2.0, radius * 4.0);
        const velocity = this._scratchVelocity.set(0, 0);
        const speed = randomBetween(explosionType.minSpeed, explosionType.maxSpeed);
        const lifetime = clamp(shockwaveRadius / speed, 0.5, 3);
        particle.reset(position, velocity, 1, this.currentTime, lifetime, shockwaveRadius);
        this.particles.push(particle);
    }

    /**
     * Updates all active particles, moving them and removing expired ones.
     * @param {number} deltaTime - Time step in seconds.
     */
    update(deltaTime) {
        this.currentTime += deltaTime;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (p.startTime + p.lifetime <= this.currentTime) {
                removeObjectFromArrayInPlace(p, this.particles);
                continue;
            }

            // Move particle (only for spark lines, type 0)
            if (p.typeIndex === 0) {
                p.position.addInPlace(this._scratchScreenPos.set(p.velocity).multiplyInPlace(deltaTime));
            }
        }
    }

    /**
     * Draws all active, visible particles (spark lines as fading lines, explosions as expanding circles).
     * @param {CanvasRenderingContext2D} ctx - Canvas context.
     * @param {Camera} camera - Camera for world-to-screen transform.
     */
    draw(ctx, camera) {
        ctx.save();
        ctx.beginPath();

        for (const p of this.particles) {
            const type = ParticleManager.particleTypes[p.typeIndex];
            const age = this.currentTime - p.startTime;
            const t = remapClamp(age, 0, p.lifetime, 0, 1);
            if (t >= 1) continue;

            if (p.typeIndex === 0) {
                // Spark Line: Draw fading line with color transition
                if (!camera.isInView(p.position, p.length)) continue;

                // Compute line endpoint (trail backward)
                const length = p.length * t;
                this._scratchLineEnd.set(p.velocity).normalizeInPlace().multiplyInPlace(-length).addInPlace(p.position);
                camera.worldToScreen(p.position, this._scratchScreenPos);
                camera.worldToScreen(this._scratchLineEnd, this._scratchLineEnd);

                // Color transition: White (t=0) to Yellow (t=0.5) to Red (t=1)
                const r = 255;
                const g = t < 0.5 ? 255 : 255 * (1 - (t - 0.5) * 2);
                const b = t < 0.5 ? 255 * t * 2 : 0;
                const opacity = 1 - t;

                // Create gradient for trail
                const gradient = ctx.createLinearGradient(
                    this._scratchScreenPos.x, this._scratchScreenPos.y,
                    this._scratchLineEnd.x, this._scratchLineEnd.y
                );
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                ctx.strokeStyle = gradient;
                ctx.lineWidth = camera.worldToSize(type.lineWidth);

                ctx.beginPath();
                ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                ctx.lineTo(this._scratchLineEnd.x, this._scratchLineEnd.y);
                ctx.stroke();
            } else {
                // Explosion: Draw shockwave and fireball as expanding circles
                if (!camera.isInView(p.position, p.length)) continue;

                camera.worldToScreen(p.position, this._scratchScreenPos);

                // Color transition: White (t=0) to Yellow (t=0.5) to Red (t=1)
                const r = 255;
                const g = t < 0.5 ? 255 : 255 * (1 - (t - 0.5) * 2);
                const b = t < 0.5 ? 255 * t * 2 : 0;
                const opacity = 1 - t;

                const t2 = clamp(t * 3, 0, 1);
                if (t2 < 1) {
                    // Shockwave: Fast, large, thin ring
                    const shockwaveRadius = camera.worldToSize(t2 * p.length);
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${1 - t2})`;
                    ctx.lineWidth = camera.worldToSize(clamp(t2 * shockwaveRadius * 0.2, 1, 10));
                    ctx.beginPath();
                    ctx.moveTo(this._scratchScreenPos.x + camera.worldToSize(shockwaveRadius), this._scratchScreenPos.y);
                    ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, camera.worldToSize(shockwaveRadius), 0, TWO_PI);
                    ctx.closePath();
                    ctx.stroke();
                }

                // Fireball: Slower, smaller, filled circle
                const fireballRadius = t * p.length * 0.5;
                ctx.beginPath();
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, camera.worldToSize(fireballRadius), 0, TWO_PI);
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.restore();
    }

    /**
     * Clears all particles.
     */
    clear() {
        this.particles.length = 0;
        this.currentTime = 0;
    }
}