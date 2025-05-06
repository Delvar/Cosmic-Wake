// turret.js

import { Vector2D } from './vector2d.js';
import { Weapon } from './weapon.js';
import { normalizeAngle } from './utils.js';

/**
 * Represents an auto-aiming turret on a ship.
 */
export class Turret {
    /**
     * Creates a new Turret instance.
     * @param {Vector2D} relativePosition - Position relative to ship center.
     * @param {number} radius - Turret size from featurePoints.
     */
    constructor(relativePosition, radius) {
        /** @type {Vector2D} Position relative to ship center. */
        this.relativePosition = relativePosition.clone();
        /** @type {number} Size scaling factor. */
        this.radius = radius;
        /** @type {Weapon} Turret's weapon (rail gun). */
        this.weapon = new Weapon(0);
        /** @type {number} Current direction (radians, relative to ship forward). */
        this.direction = 0;
        /** @type {number} Rotation speed (radians/s). */
        this.rotationSpeed = Math.PI * 0.25; // 45°/s
        /** @type {Vector2D} Temporary vector for world position. */
        this._scratchWorldPos = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for target angle. */
        this._scratchTarget = new Vector2D(0, 0);
    }

    /**
     * Updates turret direction to aim at target or ship forward.
     * @param {number} deltaTime - Time step in seconds.
     * @param {Ship} ship - Parent ship.
     */
    update(deltaTime, ship) {
        const targetAngle = this.getTargetAngle(ship);
        const angleDiff = normalizeAngle(targetAngle - this.direction);
        const maxRotation = this.rotationSpeed * deltaTime;
        this.direction += Math.max(Math.min(angleDiff, maxRotation), -maxRotation);
        this.direction = normalizeAngle(this.direction);
        this.weapon.update(deltaTime);
    }

    /**
     * Computes target angle relative to ship forward.
     * @param {Ship} ship - Parent ship.
     * @returns {number} Target angle (radians).
     */
    getTargetAngle(ship) {
        if (ship.target && !ship.target.despawned && ship.target.position) {
            // Compute world-space turret position
            const cosAngle = Math.cos(ship.angle);
            const sinAngle = Math.sin(ship.angle);
            const worldX = this.relativePosition.x * cosAngle - this.relativePosition.y * sinAngle + ship.position.x;
            const worldY = this.relativePosition.x * sinAngle + this.relativePosition.y * cosAngle + ship.position.y;
            this._scratchWorldPos.set(worldX, worldY);
            // Angle to target relative to ship angle
            this._scratchTarget.set(ship.target.position).subtractInPlace(this._scratchWorldPos);
            return normalizeAngle(Math.atan2(this._scratchTarget.x, -this._scratchTarget.y) - ship.angle);
        }
        return 0; // Face ship forward
    }

    /**
     * Fires the turret's weapon.
     * @param {Ship} ship - Parent ship.
     * @param {ProjectileManager} projectileManager - Manager for spawning projectiles.
     */
    fire(ship, projectileManager) {
        // Compute world-space barrel end
        const cosAngle = Math.cos(ship.angle + this.direction);
        const sinAngle = Math.sin(ship.angle + this.direction);
        const barrelLength = this.radius * 3;
        const turretWorldX = this.relativePosition.x * Math.cos(ship.angle) - this.relativePosition.y * Math.sin(ship.angle) + ship.position.x;
        const turretWorldY = this.relativePosition.x * Math.sin(ship.angle) + this.relativePosition.y * Math.cos(ship.angle) + ship.position.y;
        const barrelX = turretWorldX + barrelLength * sinAngle;
        const barrelY = turretWorldY - barrelLength * cosAngle;
        this._scratchWorldPos.set(barrelX, barrelY);
        this.weapon.fire(ship, projectileManager, this._scratchWorldPos, ship.angle + this.direction);
    }
}