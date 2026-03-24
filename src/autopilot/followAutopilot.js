// /src/autopilot/followAutopilot.js
import { Autopilot } from '/src/autopilot/autopilot.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';
import { remapClamp } from '/src/core/utils.js';
import { GameManager } from '/src/core/game.js';

/**
 * Autopilot that follows a target GameObject with a distance band.
 * @extends Autopilot
 */
export class FollowAutopilot extends Autopilot {
    /**
     * Creates a new FollowAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} target - The target GameObject to follow.
     * @param {number} [minFollowDistance=100.0] - Minimum distance from target center.
     * @param {number} [maxFollowDistance=500.0] - Maximum distance from target center.
     */
    constructor(ship, target, minFollowDistance = 100.0, maxFollowDistance = 500.0) {
        super(ship, target);
        /** @type {GameObject} The target to follow. */
        this.target = target;
        /** @type {number} Minimum distance from target center. */
        this.minFollowDistance = minFollowDistance;
        /** @type {number} Maximum distance from target center. */
        this.maxFollowDistance = maxFollowDistance;

        // Precompute distances for approach phases based on ship dynamics
        const timeToTurn = Math.PI / this.ship.rotationSpeed; // Time to rotate 180 degrees
        const maxDecelerationDistance = (this.ship.maxVelocity * this.ship.maxVelocity) / (2 * this.ship.thrust); // Distance to decelerate
        /** @type {number} Distance for far approach phase, computed dynamically. */
        this.farApproachDistance = this.maxFollowDistance + maxDecelerationDistance + (this.ship.maxVelocity * timeToTurn); // Start slowing down

        // Initialize scratch vectors for calculations
        /** @type {Vector2D} Scratch vector for delta to target. */
        this._scratchDeltaToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for target direction. */
        this._scratchDirectionToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead position. */
        this._scratchLeadPosition = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead offset. */
        this._scratchLeadOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lateral offset. */
        this._scratchLateralOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead direction. */
        this._scratchLeadDirection = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for velocity error. */
        this._scratchVelocityError = new Vector2D(0.0, 0.0);

        if (new.target === FollowAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, ensuring the target is in the same star system.
     */
    start() {
        super.start();

        if (!(this.target instanceof GameObject)) {
            this.error = 'Target is not a valid game object';
            this.active = false;
            return;
        }

        if (!this.target) {
            this.error = 'No target';
            this.active = false;
            return;
        }

        if (!isValidTarget(this.ship, this.target)) {
            this.error = 'Target not in same system';
            this.active = false;
            return;
        }

        this.ship.target = this.target;
    }

    /**
     * Updates the autopilot, adjusting velocity to reach the target at the desired speed.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        // Compute distance and normalized direction to target
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        // Calculate lead position and angle to lead, using max velocity as projectile speed
        const angleToLead = this.computeLeadPosition(
            this.ship,
            this.target,
            this.ship.maxVelocity, // Use max velocity for lead aiming
            this.target.velocity,
            distance,
            this._scratchDirectionToTarget,
            this._scratchLeadPosition,
            this._scratchLeadOffset,
            this._scratchLateralOffset,
            this._scratchLeadDirection,
            this._scratchVelocityError
        );

        let errorThresholdRatio = 1.0; // Default thrust error threshold multiplier
        let failoverAngle = null; // Angle to face when not thrusting
        if (distance < this.minFollowDistance) {
            this._scratchDesiredVelocity.set(this._scratchDirectionToTarget).multiplyInPlace(
                remapClamp(Math.max(1.0, distance), 0.0, this.minFollowDistance, -this.ship.maxVelocity, -1.0)
            ).addInPlace(this.target.velocity);
            failoverAngle = this.target.velocity;
            errorThresholdRatio = remapClamp(distance, 0.0, this.minFollowDistance, 0.0, 0.1); // Tighten thrust threshold
        } else if (distance >= this.minFollowDistance && distance < this.maxFollowDistance) {
            //FIXME: implement manoeuvre speed here, -20.0, 20.0
            const speed = remapClamp(distance, this.minFollowDistance, this.maxFollowDistance, -Ship.LANDING_SPEED, Ship.LANDING_SPEED);
            this._scratchDesiredVelocity.set(this._scratchLeadDirection).multiplyInPlace(speed).addInPlace(this.target.velocity);
            failoverAngle = (this.target.velocity.x === 0.0 && this.target.velocity.y === 0.0) ? this.target.angle : this.target.velocity;
            errorThresholdRatio = remapClamp(distance, this.minFollowDistance, this.maxFollowDistance, 0.1, 0.5); // Tighten thrust threshold
        } else if (distance >= this.maxFollowDistance && distance < this.farApproachDistance) {
            const speed = remapClamp(distance, this.maxFollowDistance, this.farApproachDistance, 0.0, this.ship.maxVelocity);
            this._scratchDesiredVelocity.set(this._scratchLeadDirection).multiplyInPlace(speed).addInPlace(this.target.velocity);
            failoverAngle = this._scratchTemp.set(this._scratchLeadDirection).multiplyInPlace(-1); // Face away
        } else if (distance >= this.farApproachDistance) {
            this._scratchDesiredVelocity.set(this._scratchLeadDirection).multiplyInPlace(this.ship.maxVelocity);
            failoverAngle = this._scratchLeadDirection;
        }

        // Apply thrust based on desired velocity and alignment
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            failoverAngle,
            errorThresholdRatio,
            this._scratchVelocityError
        );
    }
}