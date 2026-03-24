// /src/autopilot/inRangeAttackAutopilot.js

import { Vector2D } from '/src/core/vector2d.js';
import { Autopilot } from '/src/autopilot/autopilot.js';
import { remapClamp } from '/src/core/utils.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';

/**
 * Moves within 100–450 units, matches target velocity, and fires continuously.
 * @extends Autopilot
 */
export class InRangeAttackAutopilot extends Autopilot {
    /**
     * Creates a new InRangeAttackAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} target - The target to attack.
     * @param {boolean} [stopOnDisabled=true] - Whether to stop if the ship is disabled.
     * @throws {Error} If ship or target is not a valid Ship instance.
     */
    constructor(ship, target, stopOnDisabled = true) {
        super(ship, target);
        /** @type {Ship} The Ship to target. */
        this.target = target;
        /** @type {boolean} Whether to stop autopilot if the ship is disabled. */
        this.stopOnDisabled = stopOnDisabled;
        /** @type {number} Minimum distance to avoid collision. */
        this.minRange = 100.0;
        /** @type {number} Maximum distance to loop back for another pass. */
        this.maxRange = 2.0 * this.ship.maxVelocity;
        /** @type {number} Speed of projectiles for lead aiming. */
        this.projectileSpeed = 1000.0;
        /** @type {Vector2D} Scratch vector for target direction. */
        this._scratchDirectionToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for delta to target. */
        this._scratchDeltaToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for desired velocity. */
        this._scratchDesiredVelocity = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for velocity error. */
        this._scratchVelocityError = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead position. */
        this._scratchLeadPosition = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead offset. */
        this._scratchLeadOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lateral offset. */
        this._scratchLateralOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead direction. */
        this._scratchLeadDirection = new Vector2D(0.0, 0.0);

        if (new.target === InRangeAttackAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, validating the target.
     */
    start() {
        if (!this.target || !isValidAttackTarget(this.ship, this.target, !this.stopOnDisabled) || this.target.starSystem !== this.ship.starSystem) {
            this.error = "Invalid or unreachable target";
            this.active = false;
            return;
        }
        this.active = true;
        this.completed = false;
        this.error = null;
        if (this.ship.debug) {
            console.log("InRangeAttackAutopilot: Started");
        }
    }

    /**
     * Updates the autopilot, maintaining 100–450 unit range and firing with lead-aiming.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        if (!this.target || !isValidAttackTarget(this.ship, this.target, !this.stopOnDisabled)) {
            this.completed = true;
            this.stop();
            return;
        }

        // Calculate distance and direction
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        const targetVelocity = this.target.velocity || Vector2D.Zero;

        // Compute lead position and angles
        const angleToLead = this.computeLeadPosition(
            this.ship,
            this.target,
            this.projectileSpeed,
            targetVelocity,
            distance,
            this._scratchDirectionToTarget,
            this._scratchLeadPosition,
            this._scratchLeadOffset,
            this._scratchLateralOffset,
            this._scratchLeadDirection,
            this._scratchVelocityError
        );

        // Desired velocity: match target velocity, adjust to maintain range
        this._scratchDesiredVelocity.set(this._scratchDirectionToTarget);
        if (distance < this.minRange) {
            const thrustMultiplier = 1.0 - remapClamp(distance, 0.0, this.minRange, 0.0, 1.0);
            this._scratchDesiredVelocity.multiplyInPlace(-100.0 * thrustMultiplier);
        } else if (distance > this.maxRange) {
            const thrustMultiplier = 1.0 - remapClamp(distance - this.maxRange, 0.0, 1000.0, 0.0, 1.0);
            this._scratchDesiredVelocity.multiplyInPlace(100.0 * thrustMultiplier);
        }
        this._scratchDesiredVelocity.addInPlace(targetVelocity);

        // Apply thrust
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            this._scratchLeadDirection,
            1.0,
            this._scratchVelocityError
        );

        // Fire if in range
        if (distance <= this.maxRange) {
            this.ship.fireTurrets();
            if (Math.abs(angleToLead) < Math.PI / 25.0) {
                this.ship.fireFixedWeapons();
            }
            if (this.ship.debug) {
                console.log("InRangeAttackAutopilot: Firing at target");
            }
        }
    }

    /**
     * Stops the autopilot, disabling thrust.
     */
    stop() {
        this.active = false;
        this.ship.applyThrust(false);
        if (this.ship.debug) {
            console.log("InRangeAttackAutopilot: Stopped");
        }
    }
}