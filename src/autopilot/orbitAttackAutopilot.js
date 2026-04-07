// /src/autopilot/orbitAttackAutopilot.js

import { Vector2D } from '/src/core/vector2d.js';
import { Autopilot } from '/src/autopilot/autopilot.js';
import { remapClamp, randomBetween, clamp } from '/src/core/utils.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';

/**
 * Autopilot that keeps a ship in a combat orbit around a hostile target while maintaining
 * distance, aiming at lead points, and firing fixed weapons when able.
 * @extends {Autopilot<Ship>}
 */
export class OrbitAttackAutopilot extends Autopilot {
    /**
     * Creates a new OrbitAttackAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} target - The target ship to orbit and attack.
     * @param {boolean} [stopOnDisabled=true] - If true, stops the behaviour when the ship becomes disabled.
     */
    constructor(ship, target, stopOnDisabled = true) {
        super(ship, target);
        /** @type {boolean} Whether to stop autopilot if the ship is disabled. */
        this.stopOnDisabled = stopOnDisabled;
        /** @type {number} Desired orbital radius around the target. */
        this.orbitRadius = randomBetween(250.0, 500.0);
        /** @type {number} Minimum allowed orbital radius. */
        this.minRadius = this.orbitRadius * 0.25;
        /** @type {number} Maximum allowed orbital radius. */
        this.maxRadius = this.orbitRadius * 1.75;
        /** @type {number} Speed of projectiles for lead aiming. */
        this.projectileSpeed = 1000.0;
        /** @type {string} Current state: "Approaching" or "Orbiting". */
        this.state = "Approaching";
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
        /** @type {Vector2D} Scratch vector for tangent direction. */
        this._scratchTangent = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for offset position. */
        this._scratchOffsetPosition = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for temporary calculations. */
        this._scratchTemp = new Vector2D(0.0, 0.0);
        /** @type {Object.<string, Function>} State handlers for update logic. */
        this.stateHandlers = {
            Approaching: this.updateApproaching.bind(this),
            Orbiting: this.updateOrbiting.bind(this)
        };

        if (new.target === OrbitAttackAutopilot) Object.seal(this);
    }

    /**
     * Begins the orbit attack behaviour by validating the target and setting the initial state.
     * @returns {void}
     */
    start() {
        if (!isValidAttackTarget(this.ship, this.target, !this.stopOnDisabled)) return;
        this.active = true;
        this.completed = false;
        this.error = null;
        this.state = "Approaching";
        this.debugLog(() => console.log(`${this.constructor.name}: Started, orbitRadius=${this.orbitRadius}`));
    }

    /**
     * Updates the orbit attack sequence each frame, validating the target and then delegating
     * to the current state handler.
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
     * Handles the Approaching state by moving the ship toward an entry point on the desired orbit.
     * This establishes position and alignment before transitioning to the orbiting attack phase.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateApproaching(deltaTime, gameManager) {
        if (!this.target) {
            throw new TypeError('target is missing');
        }
        // Calculate distance and direction to target
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        // Compute offset position (to the side of target)
        this._scratchTangent.set(-this._scratchDirectionToTarget.y, this._scratchDirectionToTarget.x);
        this._scratchOffsetPosition.set(this.target.position).addInPlace(
            this._scratchTangent.multiplyInPlace(this.orbitRadius)
        );

        // Compute desired velocity toward offset position
        this._scratchDesiredVelocity.set(this._scratchOffsetPosition).subtractInPlace(this.ship.position)
            .normalizeInPlace().multiplyInPlace(this.ship.maxVelocity);

        // Apply thrust with hysteresis
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            this._scratchDirectionToTarget,
            1.0,
            this._scratchVelocityError
        );

        // Transition to Orbiting if close enough
        if (distance <= this.orbitRadius * 1.2) {
            this.state = "Orbiting";
        }
    }

    /**
     * Handles the Orbiting state by maintaining a stable orbit around the target,
     * computing lead aiming and firing logic while matching the target's motion.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateOrbiting(deltaTime, gameManager) {
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

        // Compute desired orbital velocity
        this.computeOrbitalVelocity(targetVelocity, distance, this._scratchLeadDirection);

        // Apply thrust logic
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            this.ship.fixedWeapons.length !== 0.0 ? this._scratchLeadDirection : null,
            1.0,
            this._scratchVelocityError
        );

        // Handle firing
        this.handleFiring(distance, angleToLead);
    }

    /**
     * Computes the desired orbital velocity vector for the current target engagement.
     * It combines lateral orbit motion with radial correction based on distance and target velocity.
     * @param {Vector2D} targetVelocity - The target's velocity.
     * @param {number} distance - Distance to the target.
     * @param {Vector2D} leadDirection - Normalized lead direction vector.
     * @returns {void}
     */
    computeOrbitalVelocity(targetVelocity, distance, leadDirection) {
        const maxSpeedDelta = clamp(this.ship.maxVelocity * 0.5, 50.0, 250.0);
        const orbitSpeed = maxSpeedDelta;

        // Determine orbit direction using cross product
        const crossProduct = leadDirection.x * this.ship.velocity.y - leadDirection.y * this.ship.velocity.x;
        if (crossProduct >= 0.0) {
            this._scratchTangent.set(-leadDirection.y, leadDirection.x); // counter-clockwise
        } else {
            this._scratchTangent.set(leadDirection.y, -leadDirection.x); // Clockwise
        }
        const radialSpeed = remapClamp(distance, this.minRadius, this.maxRadius, -1.0, 1.0) * this.ship.maxVelocity * 0.2;

        this._scratchDesiredVelocity.set(this._scratchTangent).multiplyInPlace(orbitSpeed).addInPlace(
            this._scratchTemp.set(leadDirection).multiplyInPlace(radialSpeed)
        ).addInPlace(targetVelocity);
    }

    /**
     * Stops the orbit attack behaviour and disables thrust input from this autopilot.
     * @returns {void}
     */
    stop() {
        this.active = false;
        this.ship.applyThrust(false);
        this.debugLog(() => console.log(`${this.constructor.name}: Stopped`));
    }
}