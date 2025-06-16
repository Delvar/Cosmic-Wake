// /src/weapon/weapon.js

import { Vector2D } from '/src/core/vector2d.js';
import { normalizeAngle } from '/src/core/utils.js';
import { ProjectileManager } from '/src/starSystem/projectileManager.js';
import { Ship } from '/src/ship/ship.js';

/**
 * A weapon that fires projectiles (e.g., Rail Gun) with a cooldown.
 */
export class Weapon {
    /**
     * Creates a new Weapon instance.
     * @param {number} projectileTypeIndex - Index into ProjectileManager.projectileTypes.
     * @param {number} [cooldown=0.5] - Seconds between shots (default: 0.5).
     */
    constructor(projectileTypeIndex, cooldown = 0.5) {
        /** @type {number} Index into ProjectileManager.projectileTypes. */
        this.projectileTypeIndex = projectileTypeIndex;
        /** @type {number} Seconds between shots. */
        this.cooldown = cooldown;
        /** @type {number} Accumulated time in seconds for cooldown checks. */
        this.currentTime = 0.0;
        /** @type {number} Time when next shot is allowed. */
        this.nextFireTime = 0.0;
        /** @type {Vector2D} Temporary vector for position calculation. */
        this._scratchPosition = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Temporary vector for velocity calculation. */
        this._scratchVelocity = new Vector2D(0.0, 0.0);

        if (new.target === Weapon) Object.seal(this);
    }

    /**
     * Updates the weapon's internal time for cooldown checks.
     * @param {number} deltaTime - Time step in seconds.
     */
    update(deltaTime) {
        this.currentTime += deltaTime;
    }

    /**
     * Fires a projectile from turret position and direction.
     * @param {Ship} ship - The ship firing the weapon.
     * @param {ProjectileManager} projectileManager - Manager to spawn projectiles.
     * @param {Vector2D} [position = null] - World-space firing position.
     * @param {number} [direction = 0] - Firing direction (radians).
     * @returns {boolean} True if fired, false if on cooldown or invalid type.
     */
    fire(ship, projectileManager, position = null, direction = 0.0) {
        if (this.currentTime < this.nextFireTime) return false;

        const type = ProjectileManager.projectileTypes[this.projectileTypeIndex];
        if (!type) {
            console.warn(`Invalid projectile type: ${this.projectileTypeIndex}`);
            return false;
        }

        if (!position) {
            // Spawn position: offset from ship center by radius + 5 units along angle
            const muzzleOffset = ship.radius + 5.0;
            direction = direction == 0.0 ? ship.angle : direction;
            this._scratchPosition.setFromPolar(muzzleOffset, direction).addInPlace(ship.position);
        } else {
            // Spawn position: provided turret barrel position
            this._scratchPosition.set(position);
        }

        // Velocity: ship velocity + projectile speed in turret direction
        const angle = normalizeAngle(direction === null ? ship.angle : direction);
        this._scratchVelocity.setFromPolar(type.speed, angle).addInPlace(ship.velocity);

        projectileManager.spawn(this._scratchPosition, this._scratchVelocity, this.projectileTypeIndex, ship);
        this.nextFireTime = this.currentTime + this.cooldown;
        return true;
    }

    /**
     * Returns true if the weapon is read to fire
     * @returns {boolean} True if it is ready to fired, false if on cooldown. 
     */
    canFire() {
        return (this.currentTime < this.nextFireTime);
    }
}