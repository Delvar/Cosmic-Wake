// /src/autopilot/flyToTargetAutopilot.js
import { Autopilot } from './autopilot.js';
import { Ship } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { remapClamp } from '/src/core/utils.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';
import { GameManager } from '/src/core/game.js';

/**
 * Autopilot that flies a ship to a target and slows it to a specified arrival speed as it nears the target.
 * @extends {Autopilot<GameObject>}
 */
export class FlyToTargetAutopilot extends Autopilot {
    /**
     * Creates a new FlyToTargetAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} target - The target to fly toward.
     * @param {number} [arrivalDistance=100.0] - Distance from target center to achieve arrivalSpeed.
     * @param {number} [arrivalSpeed=Ship.LANDING_SPEED] - Target speed when within arrivalDistance.
     */
    constructor(ship, target, arrivalDistance = 100.0, arrivalSpeed = Ship.LANDING_SPEED) {
        super(ship, target);
        /** @type {number} Distance from target center to achieve arrivalSpeed. */
        this.arrivalDistance = arrivalDistance;
        /** @type {number} Target speed when within arrivalDistance. */
        this.arrivalSpeed = arrivalSpeed;

        // Precompute distances for approach phases based on ship dynamics
        const timeToTurn = Math.PI / this.ship.rotationSpeed; // Time to rotate 180 degrees
        const maxDecelerationDistance = (this.ship.maxVelocity * this.ship.maxVelocity - this.arrivalSpeed * this.arrivalSpeed) / (2 * this.ship.thrust); // Distance to decelerate
        /** @type {number} Distance for far approach phase, computed dynamically. */
        this.farApproachDistance = this.arrivalDistance + maxDecelerationDistance + (this.ship.maxVelocity * timeToTurn); // Start slowing down
        /** @type {number} Distance for close approach phase, computed dynamically. */
        this.closeApproachDistance = this.arrivalDistance + (this.arrivalSpeed * timeToTurn); // Near target speed

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

        /** @type {Vector2D} Scratch vector for approach velocity. */
        this._scratchApproachVelocity = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lateral velocity. */
        this._scratchLateralVelocity = new Vector2D(0.0, 0.0);

        if (new.target === FlyToTargetAutopilot) Object.seal(this);
    }

    /**
     * Starts the approach behaviour, validating target presence and system membership.
     * @returns {void}
     */
    start() {
        super.start();

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
     * Updates the approach behaviour each frame.
     * Computes the desired velocity, manages arrival detection, and stops when the ship reaches the target.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    update(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            if (!this.ship.dockingContext) {
                throw new TypeError('dockingContext is missing on Landed ship');
            }
            if (this.ship.dockingContext.landedObject === this.target) {
                this.completed = true;
                this.stop();
            } else {
                this.ship.dockingContext.takeOff();
            }
            return;
        }
        if (!this.target) {
            throw new TypeError('target is missing');
        }
        // Compute distance and normalized direction to target
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        // Check if arrived: within arrivalDistance and matching target speed
        if (distance <= this.arrivalDistance /*&& this.ship.velocity.distanceSquaredTo(this.target.velocity) <= this.arrivalSpeed * this.arrivalSpeed*/) {
            this.completed = true;
            this.stop();
            return;
        }

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

        // Ensure we are moving towards the target then Adjust desired velocity based on distance phase
        const approachSpeed = -this._scratchVelocityError.dot(this._scratchLeadDirection);
        this._scratchApproachVelocity.set(this._scratchLeadDirection).multiplyInPlace(approachSpeed);
        this._scratchLateralVelocity.set(this._scratchVelocityError).multiplyInPlace(-1.0).subtractInPlace(this._scratchApproachVelocity);

        if (distance < this.arrivalDistance) {
            // Within arrival distance: match target velocity
            this._scratchDesiredVelocity.set(this._scratchLeadDirection)
                .multiplyInPlace(remapClamp(distance, 0.0, this.arrivalDistance, 0.0, this.arrivalSpeed))
                .addInPlace(this.target.velocity)
                .subtractInPlace(this._scratchLateralVelocity);
        } else if (distance < this.closeApproachDistance) {
            // Close approach: slow to arrival speed, face away from target
            this._scratchDesiredVelocity.set(this._scratchLeadDirection)
                .multiplyInPlace(this.arrivalSpeed)
                .addInPlace(this.target.velocity)
                .subtractInPlace(this._scratchLateralVelocity);
            failoverAngle = this._scratchTemp.set(this._scratchDirectionToTarget).multiplyInPlace(-1); // Face away
        } else if (distance < this.farApproachDistance) {
            // Far approach: interpolate speed, face away from target
            const speed = remapClamp(distance, this.closeApproachDistance, this.farApproachDistance, this.arrivalSpeed * 4.0, this.ship.maxVelocity);
            this._scratchDesiredVelocity.set(this._scratchLeadDirection)
                .multiplyInPlace(speed)
                .addInPlace(this.target.velocity);
            failoverAngle = this._scratchTemp.set(this._scratchDirectionToTarget).multiplyInPlace(-1); // Face away
        } else {
            // Beyond far approach: full speed toward lead position
            this._scratchDesiredVelocity.set(this._scratchLeadDirection)
                .multiplyInPlace(this.ship.maxVelocity);
            failoverAngle = this._scratchLeadDirection;//.getAngle(); // Face lead
        }

        // If we are not moving towards the target just force it by overriding the threshold
        if (approachSpeed < this.arrivalSpeed * 0.5) {
            errorThresholdRatio = 0.0;
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