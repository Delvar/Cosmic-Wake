// /src/autopilot/flybyAttackAutopilot.js

import { Vector2D } from '/src/core/vector2d.js';
import { Autopilot } from '/src/autopilot/autopilot.js';
import { remapClamp } from '/src/core/utils.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';

/**
 * Performs high-speed attack runs, firing when close, retreating, and turning for the next run.
 * @extends Autopilot
 */
export class FlybyAttackAutopilot extends Autopilot {
    /**
     * Creates a new FlybyAttackAutopilot instance.
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
        /** @type {number} Speed for flyby passes. */
        this.passSpeed = this.ship.maxVelocity * 0.5;
        /** @type {number} Minimum distance to avoid collision. */
        this.minRange = 100.0;
        /** @type {number} Maximum distance to loop back for another pass. */
        this.maxRange = this.firingRange * 1.1;
        /** @type {number} The length of item we have been turning. */
        this.turningTime = 0.0;
        /** @type {number} Speed of projectiles for lead aiming. */
        this.projectileSpeed = 1000.0;
        /** @type {string} Current state: "Approaching", "Firing", "Retreating", or "Turning". */
        this.state = "Approaching";
        /** @type {number} Last recorded distance to detect chasing. */
        this.lastDistance = Infinity;
        /** @type {Vector2D} Scratch vector for target direction. */
        this._scratchDirectionToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for delta to target. */
        this._scratchDeltaToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for desired velocity. */
        this._scratchDesiredVelocity = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for velocity error. */
        this._scratchVelocityError = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead offset. */
        this._scratchLeadOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lateral offset. */
        this._scratchLateralOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead position. */
        this._scratchLeadPosition = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead direction. */
        this._scratchLeadDirection = new Vector2D(0.0, 0.0);
        /** @type {Object.<string, Function>} State handlers for update logic. */
        this.stateHandlers = {
            Approaching: this.updateApproaching.bind(this),
            Firing: this.updateFiring.bind(this),
            Retreating: this.updateRetreating.bind(this),
            Turning: this.updateTurning.bind(this)
        };

        if (new.target === FlybyAttackAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, initializing the Approaching state.
     */
    start() {
        if (!isValidAttackTarget(this.ship, this.target, !this.stopOnDisabled)) return;
        this.active = true;
        this.completed = false;
        this.error = null;
        this.state = "Approaching";
        this.lastDistance = Infinity;
        this.debugLog(`FlybyAttackAutopilot: Started, passSpeed=${this.passSpeed}, maxRange=${this.maxRange}`);

    }

    /**
     * Updates the autopilot, delegating to the base class.
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
        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the Approaching state, moving the ship toward the target.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateApproaching(deltaTime, gameManager) {
        // Calculate distance and direction
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        const angleToLead = this.computeLeadPosition(
            this.ship,
            this.target,
            this.projectileSpeed,
            this.target.velocity,
            distance,
            this._scratchDirectionToTarget,
            this._scratchLeadPosition,
            this._scratchLeadOffset,
            this._scratchLateralOffset,
            this._scratchLeadDirection,
            this._scratchVelocityError
        );

        // Compute desired velocity toward lead position
        this._scratchDesiredVelocity.set(this._scratchLeadDirection)
            .multiplyInPlace(this.passSpeed);

        // Apply thrust
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            this._scratchLeadDirection,
            1.0,
            this._scratchVelocityError
        );

        // Transition to Firing
        if (distance <= this.firingRange) {
            this.state = "Firing";
            this.debugLog("FlybyAttackAutopilot: Transitioned to Firing");
        }
    }

    /**
     * Handles the Firing state, firing at the target during a close pass.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFiring(deltaTime, gameManager) {
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

        // Compute desired velocity toward lead position
        this._scratchDesiredVelocity.set(this._scratchLeadDirection)
            .multiplyInPlace(this.passSpeed);

        this.ship.applyThrust(true);
        this.ship.setTargetAngle(angleToLead + this.ship.angle);
        // Handle firing
        this.handleFiring(distance, angleToLead);

        // Transition to Retreating
        if (Math.abs(angleToLead) > Math.PI / 3.0 && distance < this.minRange) {
            this.state = "Retreating";
            this.lastDistance = distance;
            this.debugLog("FlybyAttackAutopilot: Transitioned to Retreating");
        }
    }

    /**
     * Handles the Retreating state, moving away from the target.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateRetreating(deltaTime, gameManager) {
        // Calculate distance and direction
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        // Always be thrusting
        this.ship.applyThrust(true);
        // Aim away from the target
        this.ship.setTargetAngle(this._scratchDirectionToTarget.getAngle() + Math.PI);

        // Check for chasing target
        const isChasing = distance <= this.lastDistance;
        this.lastDistance = distance;

        // Transition to Turning
        if (distance >= this.maxRange * 0.25 && !isChasing) {
            this.turningTime = 0.0;
            this.state = "Turning";
            this.debugLog(`FlybyAttackAutopilot: Transitioned to Turning${isChasing ? ' (chasing detected)' : ''}`);
        }
    }

    /**
     * Handles the Turning state, turning toward the target for another pass.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateTurning(deltaTime, gameManager) {
        this.turningTime += deltaTime;
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
        const leadAngle = this._scratchLeadDirection.getAngle();
        const requestedAngle = (1.0 - remapClamp(this.turningTime, 0.0, 3.0, 0.0, 1.0)) * Math.PI + leadAngle;
        this.ship.setTargetAngle(requestedAngle);
        this.ship.applyThrust(true);
        this._scratchDesiredVelocity.setFromPolar(this.ship.maxVelocity, requestedAngle);
        this._scratchVelocityError.set(this._scratchDesiredVelocity).subtractInPlace(this.ship.velocity);

        // Handle firing
        this.handleFiring(distance, angleToLead);

        // Transition to Approaching
        if (this.turningTime > 3.0) {
            this.state = "Approaching";
            this.debugLog("FlybyAttackAutopilot: Transitioned to Approaching");

        }
    }

    /**
     * Stops the autopilot, disabling ship thrust.
     */
    stop() {
        this.active = false;
        this.ship.applyThrust(false);
        this.debugLog("FlybyAttackAutopilot: Stopped");
    }
}