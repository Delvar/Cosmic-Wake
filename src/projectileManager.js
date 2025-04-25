// projectileManager.js

import { Vector2D } from './vector2d.js';
import { Projectile } from './projectile.js';
import { removeObjectFromArrayInPlace, TWO_PI } from './utils.js';

/**
 * Manages active projectiles in a star system, handling updates, rendering, collisions, and lifecycle.
 */
export class ProjectileManager {
    /**
     * Creates a new ProjectileManager instance.
     * @param {StarSystem} starSystem - The parent star system for hit detection.
     */
    constructor(starSystem) {
        /** @type {StarSystem} The parent star system. */
        this.starSystem = starSystem;
        /** @type {Projectile[]} Array of active Projectile objects. */
        this.projectiles = [];
        /** @type {number} Accumulated time in seconds for expiration checks. */
        this.currentTime = 0;
        /** @type {Vector2D} Temporary vector for collision distance calculation. */
        this._scratchDistance = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for line endpoint calculation. */
        this._scratchLineEnd = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for line start in screen coordinates. */
        this._scratchLineStart = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for line end in screen coordinates. */
        this._scratchLineEnd = new Vector2D(0, 0);
    }

    /**
     * Static array of projectile types.
     * @type {Array<{speed: number, damage: number, maxAge: number, radius: number}>}
     */
    static projectileTypes = [
        { speed: 1000, damage: 15, maxAge: 3, radius: 2 } // Rail Gun tungsten slug
    ];

    /**
     * Spawns a new projectile.
     * @param {Vector2D} position - Spawn position.
     * @param {Vector2D} velocity - Initial velocity.
     * @param {number} typeIndex - Projectile type index.
     * @param {Ship|null} owner - The ship that fired the projectile, or null.
     */
    spawn(position, velocity, typeIndex, owner) {
        const type = ProjectileManager.projectileTypes[typeIndex];
        if (!type) {
            console.warn(`Invalid projectile type: ${typeIndex}`);
            return;
        }
        if (this.projectiles.length >= 1000) {
            console.warn('Projectile limit reached');
            return;
        }

        const projectile = new Projectile();
        projectile.reset(position, velocity, position, typeIndex, this.currentTime + type.maxAge, owner);
        this.projectiles.push(projectile);
    }

    /**
     * Updates all active projectiles, moving them, checking collisions, and removing expired or hit ones.
     * @param {number} deltaTime - Time step in seconds.
     */
    update(deltaTime) {
        this.currentTime += deltaTime;
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (p.expirationTime <= this.currentTime) {
                removeObjectFromArrayInPlace(p, this.projectiles);
                continue;
            }

            // Move projectile
            p.position.addInPlace(this._scratchDistance.set(p.velocity).multiplyInPlace(deltaTime));

            // Check collisions with ships
            const type = ProjectileManager.projectileTypes[p.typeIndex];
            for (const ship of this.starSystem.ships) {
                if (ship === p.owner) continue;
                this._scratchDistance.set(p.position).subtractInPlace(ship.position);
                const distanceSq = this._scratchDistance.squareMagnitude();
                const collisionRadius = type.radius + ship.radius;
                if (distanceSq <= collisionRadius * collisionRadius) {
                    ship.triggerShieldEffect(p.position);
                    removeObjectFromArrayInPlace(p, this.projectiles);
                    break;
                }
            }
        }
    }

    /**
     * Draws all active, visible projectiles as white lines (100 units long, trailing backward),
     * fading from solid at position to transparent at the back.
     * @param {CanvasRenderingContext2D} ctx - Canvas context.
     * @param {Camera} camera - Camera for world-to-screen transform.
     */
    draw(ctx, camera) {
        ctx.save();
        ctx.beginPath();

        for (const p of this.projectiles) {
            if (!camera.isInView(p.position, 100)) continue;

            // Set line width based on projectile type and camera scale
            const type = ProjectileManager.projectileTypes[p.typeIndex];
            ctx.lineWidth = camera.worldToSize(type.radius);

            // Compute line endpoint (100 units toward originalPosition)
            this._scratchLineEnd.set(p.originalPosition).subtractInPlace(p.position);
            const distSq = this._scratchLineEnd.squareMagnitude();
            if (distSq > 0) {
                const scale = Math.min(100 / Math.sqrt(distSq), 1);
                this._scratchLineEnd.multiplyInPlace(scale).addInPlace(p.position);
            } else {
                this._scratchLineEnd.set(p.position);
            }

            // Convert to screen coordinates
            camera.worldToScreen(p.position, this._scratchLineStart);
            camera.worldToScreen(this._scratchLineEnd, this._scratchLineEnd);

            // Create gradient for fading effect
            const gradient = ctx.createLinearGradient(
                this._scratchLineStart.x, this._scratchLineStart.y,
                this._scratchLineEnd.x, this._scratchLineEnd.y
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.strokeStyle = gradient;

            ctx.moveTo(this._scratchLineStart.x, this._scratchLineStart.y);
            ctx.lineTo(this._scratchLineEnd.x, this._scratchLineEnd.y);
            ctx.stroke();
            ctx.beginPath();
        }

        ctx.restore();
    }

    /**
     * Clears all projectiles.
     */
    clear() {
        this.projectiles.length = 0;
        this.currentTime = 0;
    }
}