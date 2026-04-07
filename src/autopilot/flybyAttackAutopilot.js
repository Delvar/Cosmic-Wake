// /src/autopilot/flybyAttackAutopilot.js

import { Vector2D } from '/src/core/vector2d.js';
import { Autopilot } from '/src/autopilot/autopilot.js';
import { remapClamp } from '/src/core/utils.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';

/**
 * Autopilot that performs repeated high-speed attack passes against a target,
 * firing close in, retreating, and turning back for another run.
 * @extends {Autopilot<Ship>}
 */
export class FlybyAttackAutopilot extends Autopilot {
    /**
     * Creates a new FlybyAttackAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} target - The target to attack.
     * @param {boolean} [stopOnDisabled=true] - Whether to stop if the ship is disabled.
     */
    constructor(ship, target, stopOnDisabled = true) {
        super(ship, target);
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
     * Starts the flyby attack behaviour by validating the target and setting the initial state.
     * @returns {void}
     */
    start() {
        if (!isValidAttackTarget(this.ship, this.target, !this.stopOnDisabled)) return;
        this.active = true;
        this.completed = false;
        this.error = null;
        this.state = "Approaching";
        this.lastDistance = Infinity;
        this.debugLog(() => console.log(`${this.constructor.name}: Started, passSpeed=${this.passSpeed}, maxRange=${this.maxRange}`));

    }

    /**
     * Updates the flyby attack sequence each frame, validating the target and then delegating
     * to the current state handler for approach, firing, retreat, or turning.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
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
     * Handles the Approaching state by driving the ship toward a firing pass position.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateApproaching(deltaTime, gameManager) {
        if (!this.target) {
            throw new TypeError('target is missing');
        }
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
            this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Firing`));
        }
    }

    /**
     * Handles the Firing state by keeping thrust engaged, aiming, and firing weapons during a close pass.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateFiring(deltaTime, gameManager) {
        if (!this.target) {
            throw new TypeError('target is missing');
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
            this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Retreating`));
        }
    }

    /**
     * Handles the Retreating state by moving the ship away from the target and detecting when it is safe to turn.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateRetreating(deltaTime, gameManager) {
        if (!this.target) {
            throw new TypeError('target is missing');
        }
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
            this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Turning${isChasing ? ' (chasing detected)' : ''}`));
        }
    }

    /**
     * Handles the Turning state by steering the ship back toward the target and preparing for another attack run.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateTurning(deltaTime, gameManager) {
        if (!this.target) {
            throw new TypeError('target is missing');
        }
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
            this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Approaching`));

        }
    }

    /**
     * Stops the flyby attack behaviour and disables thrust input from this autopilot.
     * @returns {void}
     */
    stop() {
        this.active = false;
        this.ship.applyThrust(false);
        this.debugLog(() => console.log(`${this.constructor.name}: Stopped`));
    }
}