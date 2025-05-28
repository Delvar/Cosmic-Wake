// /src/weapon/turret.js

import { Vector2D } from '/src/core/vector2d.js';
import { Weapon } from '/src/weapon/weapon.js';
import { normalizeAngle } from '/src/core/utils.js';
import { ProjectileManager } from '/src/starSystem/projectileManager.js';
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
        this.rotationSpeed = Math.PI;

        /** @type {Vector2D} Scratch vector for turret's world position. */
        this._scratchTurretWorldPosition = new Vector2D(0, 0);
        /** @type {Vector2D} Scratch vector for direction to target. */
        this._scratchDirectionToTarget = new Vector2D(0, 0);
        /** @type {Vector2D} Scratch vector for lead position. */
        this._scratchLeadPosition = new Vector2D(0, 0);
        /** @type {Vector2D} Scratch vector for lead offset. */
        this._scratchLeadOffset = new Vector2D(0, 0);
        /** @type {Vector2D} Scratch vector for lateral offset. */
        this._scratchLateralOffset = new Vector2D(0, 0);
        /** @type {Vector2D} Scratch vector for lead direction. */
        this._scratchLeadDirection = new Vector2D(0, 0);
        /** @type {Vector2D} Scratch vector for velocity error. */
        this._scratchVelocityError = new Vector2D(0, 0);
        /** @type {Vector2D} Scratch vector for temporary calculations. */
        this._scratchTemporaryVector = new Vector2D(0, 0);
    }

    /**
     * Updates turret direction to aim at target or ship forward.
     * @param {number} deltaTime - Time step in seconds.
     * @param {Ship} ship - Parent ship.
     */
    update(deltaTime, ship) {
        const targetAngle = this.getTargetAngle(ship);
        const angleDifference = normalizeAngle(targetAngle - this.direction);
        const maxRotation = this.rotationSpeed * deltaTime;
        this.direction += Math.max(Math.min(angleDifference, maxRotation), -maxRotation);
        this.direction = normalizeAngle(this.direction);
        this.weapon.update(deltaTime);
    }

    /**
     * Computes target angle relative to ship forward.
     * @param {Ship} ship - Parent ship.
     * @returns {number} Target angle (radians).
     */
    getTargetAngle(ship) {
        if (ship.target && !ship.target.despawned && ship.target.position && ship.target.velocity) {
            // Compute world-space turret position
            const cosShipAngle = Math.cos(ship.angle);
            const sinShipAngle = Math.sin(ship.angle);
            const worldX = this.relativePosition.x * cosShipAngle - this.relativePosition.y * sinShipAngle + ship.position.x;
            const worldY = this.relativePosition.x * sinShipAngle + this.relativePosition.y * cosShipAngle + ship.position.y;
            this._scratchTurretWorldPosition.set(worldX, worldY);

            // Compute direction to target
            this._scratchDirectionToTarget.set(ship.target.position).subtractInPlace(this._scratchTurretWorldPosition);
            const distanceToTarget = this._scratchDirectionToTarget.magnitude();
            this._scratchDirectionToTarget.normalizeInPlace();

            // Compute lead position
            const projectileSpeed = this.weapon.projectileSpeed || 1000; // Default if undefined
            this.computeLeadPosition(
                ship,
                ship.target,
                projectileSpeed,
                ship.target.velocity,
                distanceToTarget,
                this._scratchDirectionToTarget,
                this._scratchLeadPosition,
                this._scratchLeadOffset,
                this._scratchLateralOffset,
                this._scratchLeadDirection,
                this._scratchVelocityError
            );

            // Compute angle to lead position relative to ship angle
            this._scratchLeadDirection.set(this._scratchLeadPosition).subtractInPlace(this._scratchTurretWorldPosition);
            return normalizeAngle(Math.atan2(this._scratchLeadDirection.x, -this._scratchLeadDirection.y) - ship.angle);
        }
        return 0; // Face ship forward if no valid target
    }

    /**
     * Computes the lead position and direction for aiming at the target.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} target - The target to aim at.
     * @param {number} projectileSpeed - Speed of projectiles for lead aiming.
     * @param {Vector2D} targetVelocity - The target's velocity.
     * @param {number} distanceToTarget - Distance to the target.
     * @param {Vector2D} directionToTarget - Normalized direction to the target.
     * @param {Vector2D} outLeadPosition - Output vector for lead position.
     * @param {Vector2D} outLeadOffset - Output vector for lead offset.
     * @param {Vector2D} outLateralOffset - Output vector for lateral offset.
     * @param {Vector2D} outLeadDirection - Output vector for normalized lead direction.
     * @param {Vector2D} outVelocityError - Output vector for velocity error.
     */
    computeLeadPosition(
        ship,
        target,
        projectileSpeed,
        targetVelocity,
        distanceToTarget,
        directionToTarget,
        outLeadPosition,
        outLeadOffset,
        outLateralOffset,
        outLeadDirection,
        outVelocityError
    ) {
        outVelocityError.set(targetVelocity).subtractInPlace(ship.velocity);
        const timeToImpact = distanceToTarget / projectileSpeed;
        outLeadPosition.set(outVelocityError).multiplyInPlace(timeToImpact).addInPlace(target.position);
        outLeadOffset.set(outLeadPosition).subtractInPlace(target.position);
        const longitudinalComponent = outLeadOffset.dot(directionToTarget);
        outLateralOffset.set(outLeadOffset).subtractInPlace(
            this._scratchTemporaryVector.set(directionToTarget).multiplyInPlace(longitudinalComponent)
        );
        outLeadPosition.set(target.position).addInPlace(outLateralOffset);
        outLeadDirection.set(outLeadPosition).subtractInPlace(this._scratchTurretWorldPosition).normalizeInPlace();
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
        this._scratchTurretWorldPosition.set(barrelX, barrelY);
        this.weapon.fire(ship, projectileManager, this._scratchTurretWorldPosition, ship.angle + this.direction);
    }
}