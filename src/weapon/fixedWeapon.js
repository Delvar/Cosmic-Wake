// /src/weapon/fixedWeapon.js

import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';
import { ProjectileManager } from '/src/starSystem/projectileManager.js';
import { Weapon } from '/src/weapon/weapon.js';

/**
 * Fixed, forward-facing weapon on a ship.
 */
export class FixedWeapon {
    /**
     * Creates a new FixedWeapon instance.
     * @param {Vector2D} relativePosition - Position relative to ship center.
     * @param {number} radius - Weapon size from featurePoints.
     */
    constructor(relativePosition, radius) {
        /** @type {Vector2D} Position relative to ship center. */
        this.relativePosition = relativePosition.clone();
        /** @type {number} Size scaling factor. */
        this.radius = radius;
        /** @type {Weapon} Weapon instance (rail gun). */
        this.weapon = new Weapon(0); // Rail gun, cooldown 0.5s
        /** @type {Vector2D} Temp vector for world position. */
        this._scratchWorldPos = new Vector2D(0, 0);
    }

    /**
     * Updates weapon cooldown.
     * @param {number} deltaTime - Time step in seconds.
     */
    update(deltaTime) {
        this.weapon.update(deltaTime);
    }

    /**
     * Fires the weapon at its position, forward-facing.
     * @param {Ship} ship - Parent ship.
     * @param {ProjectileManager} projectileManager - Manager for projectiles.
     */
    fire(ship, projectileManager) {
        // World-space position
        const cosAngle = Math.cos(ship.angle);
        const sinAngle = Math.sin(ship.angle);
        const worldX = this.relativePosition.x * cosAngle - this.relativePosition.y * sinAngle + ship.position.x;
        const worldY = this.relativePosition.x * sinAngle + this.relativePosition.y * cosAngle + ship.position.y;
        this._scratchWorldPos.set(worldX, worldY);
        this.weapon.fire(ship, projectileManager, this._scratchWorldPos, ship.angle);
    }

    /**
     * Returns true if the weapon is read to fire
     * @returns {boolean} True if it is ready to fired, false if on cooldown.
     */
    canFire() {
        return this.weapon.canFire();
    }
}