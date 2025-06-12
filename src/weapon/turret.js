// /src/weapon/turret.js

import { Vector2D } from '/src/core/vector2d.js';
import { Weapon } from '/src/weapon/weapon.js';
import { normalizeAngle } from '/src/core/utils.js';
import { ProjectileManager } from '/src/starSystem/projectileManager.js';
import { isValidAttackTarget, Ship } from '/src/ship/ship.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';
import { PlayerPilot } from '/src/pilot/pilot.js';

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
        /** @type {Ship|null} Current target ship. */
        this.target = null;
        /** @type {number} Time until next target re-evaluation (seconds). */
        this.reselectTimer = 0;

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

        if (new.target === Turret) Object.seal(this);
    }

    /**
     * Updates turret direction to aim at target or ship forward.
     * @param {number} deltaTime - Time step in seconds.
     * @param {Ship} ship - Parent ship.
     */
    update(deltaTime, ship) {
        this.weapon.update(deltaTime);
        if (ship.state !== 'Flying' || ship.turretMode === 'Disabled') {
            return;
        }
        // Update target selection timer
        this.reselectTimer -= deltaTime;
        if (this.reselectTimer <= 0) {
            this.selectTarget(ship);
            this.reselectTimer = Math.random() * 0.5 + 0.5;
        }
        let targetAngle = 0;

        if (this.target && isValidAttackTarget(ship, this.target)) {
            // Compute world-space turret position
            const cosShipAngle = Math.cos(ship.angle);
            const sinShipAngle = Math.sin(ship.angle);
            const worldX = this.relativePosition.x * cosShipAngle - this.relativePosition.y * sinShipAngle + ship.position.x;
            const worldY = this.relativePosition.x * sinShipAngle + this.relativePosition.y * cosShipAngle + ship.position.y;
            this._scratchTurretWorldPosition.set(worldX, worldY);

            // Compute direction to target
            this._scratchDirectionToTarget.set(this.target.position).subtractInPlace(this._scratchTurretWorldPosition);
            const distanceToTarget = this._scratchDirectionToTarget.magnitude();
            this._scratchDirectionToTarget.normalizeInPlace();

            // Compute lead position
            const projectileSpeed = 1000;
            this.computeLeadPosition(
                ship,
                this.target,
                projectileSpeed,
                this.target.velocity,
                distanceToTarget,
                this._scratchDirectionToTarget,
                this._scratchLeadPosition,
                this._scratchLeadOffset,
                this._scratchLateralOffset,
                this._scratchLeadDirection,
                this._scratchVelocityError
            );

            // Compute angle to lead position
            this._scratchLeadDirection.set(this._scratchLeadPosition).subtractInPlace(this._scratchTurretWorldPosition);
            targetAngle = normalizeAngle(Math.atan2(this._scratchLeadDirection.x, -this._scratchLeadDirection.y) - ship.angle);
            const angleDifference = normalizeAngle(targetAngle - this.direction);
            if (ship.turretMode === 'Full-auto' && distanceToTarget < 1000 && Math.abs(angleDifference) < this.target.radius / distanceToTarget) {
                this.fire(ship, ship.starSystem.projectileManager);
            }
        }

        //const targetAngle = this.getTargetAngle(ship);
        const angleDifference = normalizeAngle(targetAngle - this.direction);
        const maxRotation = this.rotationSpeed * deltaTime;
        this.direction += Math.max(Math.min(angleDifference, maxRotation), -maxRotation);
        this.direction = normalizeAngle(this.direction);
    }

    /**
     * Selects a target for the turret.
     * @param {Ship} ship - Parent ship.
     */
    selectTarget(ship) {
        if (ship.turretMode === 'Target-only' && ship.target instanceof Ship && PlayerPilot.isValidHostileTarget(ship, ship.target)) {
            this.target = ship.target;
            return;
        }

        // Prefer ship.target if hostile
        if (ship.target instanceof Ship && PlayerPilot.isValidHostileTarget(ship, ship.target) && ship.position.distanceSquaredTo(ship.target.position) < 1000 * 1000) {
            this.target = ship.target;
            return;
        }

        // Select closest hostile by rotation time
        this.target = this.getClosestHostileByRotationTime(ship);
    }

    /**
     * Finds the closest hostile by rotation time.
     * @param {Ship} ship - Parent ship.
     * @returns {Ship|null} Closest hostile ship, or null if none.
     */
    getClosestHostileByRotationTime(ship) {
        // Compute world-space turret position
        const cosShipAngle = Math.cos(ship.angle);
        const sinShipAngle = Math.sin(ship.angle);
        const worldX = this.relativePosition.x * cosShipAngle - this.relativePosition.y * sinShipAngle + ship.position.x;
        const worldY = this.relativePosition.x * sinShipAngle + this.relativePosition.y * cosShipAngle + ship.position.y;
        this._scratchTurretWorldPosition.set(worldX, worldY);

        let closestHostile = null;
        let minRotationTime = Infinity;

        for (const hostile of ship.hostiles) {
            if (!isValidAttackTarget(ship, hostile)) continue;

            // Compute angle to hostile
            this._scratchDirectionToTarget.set(hostile.position).subtractInPlace(this._scratchTurretWorldPosition);
            const targetAngle = normalizeAngle(Math.atan2(this._scratchDirectionToTarget.x, -this._scratchDirectionToTarget.y) - ship.angle);
            const angleDifference = Math.abs(normalizeAngle(targetAngle - this.direction));
            const rotationTime = angleDifference / this.rotationSpeed;

            if (rotationTime < minRotationTime) {
                minRotationTime = rotationTime;
                closestHostile = hostile;
            }
        }

        return closestHostile;
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
        const timeToImpact = Math.min(distanceToTarget / projectileSpeed, 3.0);
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