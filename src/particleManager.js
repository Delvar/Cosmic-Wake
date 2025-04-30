// particleManager.js

import { Vector2D } from './vector2d.js';
import { Particle } from './particle.js';
import { removeObjectFromArrayInPlace, TWO_PI, randomBetween, remapClamp, clamp } from './utils.js';

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
     *   shockwaveSpeed?: number,
     *   fireballSpeed?: number,
     * }>}
     */
    static particleTypes = [
        // Spark Line (Type 0)
        {
            lineWidth: 1,
            minLength: 10,
            maxLength: 50,
            minSpeed: 200,
            maxSpeed: 500,
            lifetime: 1
        },
        // Explosion (Shockwave + Fireball, Type 1)
        {
            shockwaveSpeed: 200,
            fireballSpeed: 100,
            lifetime: 0.5
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
        const sparkCount = radius <= 5 ? 0 : Math.floor(remapClamp(t, 0, 1, 1, 20)); // 5–20 sparks
        for (let i = 0; i < sparkCount; i++) {
            const particle = new Particle();
            const speed = remapClamp(t, 0, 1, sparkType.minSpeed, sparkType.maxSpeed);
            const angle = randomBetween(0, TWO_PI);
            const velocity = this._scratchVelocity.setFromPolar(speed, angle);
            const length = randomBetween(sparkType.minLength, sparkType.maxLength);
            particle.reset(position, velocity, 0, this.currentTime + sparkType.lifetime, length);
            this.particles.push(particle);
        }

        // Spawn Explosion (Type 1, Shockwave + Fireball)
        const explosionType = ParticleManager.particleTypes[1];
        const particle = new Particle();
        const shockwaveRadius = remapClamp(t, 0, 1, radius * 2.0, radius * 4.0);
        const velocity = this._scratchVelocity.set(0, 0);
        particle.reset(position, velocity, 1, this.currentTime + explosionType.lifetime, shockwaveRadius);
        this.particles.push(particle);

        if (this.starSystem.debug) {
            console.log(`Spawned ${sparkCount} spark lines and 1 explosion at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}), radius: ${radius.toFixed(2)}`);
        }
    }

    /**
     * Updates all active particles, moving them and removing expired ones.
     * @param {number} deltaTime - Time step in seconds.
     */
    update(deltaTime) {
        this.currentTime += deltaTime;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (p.expirationTime <= this.currentTime) {
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
            const age = this.currentTime - (p.expirationTime - type.lifetime);
            const t = remapClamp(age, 0, type.lifetime, 0, 1);
            if (t >= 1) continue;

            if (p.typeIndex === 0) {
                // Spark Line: Draw fading line with color transition
                if (!camera.isInView(p.position, p.length)) continue;

                // Compute line endpoint (trail backward)
                this._scratchLineEnd.set(p.velocity).multiplyInPlace(-p.length / Math.max(p.velocity.magnitude(), 1)).addInPlace(p.position);
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

                ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                ctx.lineTo(this._scratchLineEnd.x, this._scratchLineEnd.y);
                ctx.stroke();
                ctx.beginPath();
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
                    const shockwaveRadius = t2 * p.length;
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${1 - t2})`;
                    ctx.lineWidth = camera.worldToSize(1.0 + (t2 * shockwaveRadius * 0.2));
                    ctx.moveTo(this._scratchScreenPos.x + shockwaveRadius, this._scratchScreenPos.y);
                    ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, camera.worldToSize(shockwaveRadius), 0, TWO_PI);
                    ctx.stroke();
                }

                // Fireball: Slower, smaller, filled circle
                const fireballRadius = t * p.length * 0.5;
                ctx.beginPath();
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, camera.worldToSize(fireballRadius), 0, TWO_PI);
                ctx.fill();
                ctx.beginPath();
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