// /src/autopilot/autopilot.js
import { GameObject, isValidTarget } from '/src/core/gameObject.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { JumpGate, Planet } from '/src/starSystem/celestialBody.js';
import { remapClamp, normalizeAngle, randomBetween } from '/src/core/utils.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { GameManager } from '/src/core/game.js';

/**
 * Base class for autopilot behaviors controlling ship navigation.
 * @template {GameObject} TargetType - The type of the target object, extending GameObject.
 */
export class Autopilot {
    /**
     * Creates a new Autopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {TargetType|null} [target=null] - The target object (e.g., planet, jump gate).
     */
    constructor(ship, target = null) {
        /** @type {Ship} The ship controlled by this autopilot. */
        this.ship = ship;
        /** @type {TargetType|null} The target object (e.g., planet, jump gate). */
        this.target = target;
        /** @type {boolean} Whether the autopilot is active. */
        this.active = false;
        /** @type {boolean} Whether the autopilot has completed its task. */
        this.completed = false;
        /** @type {string|null} Error message if the autopilot fails, null if no error. */
        this.error = null;
        /** @type {Autopilot|null} Optional sub-autopilot for delegated tasks. */
        this.subAutopilot = null;
        /** @type {number} Maximum angle deviation to apply thrust. */
        this.thrustAngleLimit = Math.PI / 16.0;
        /** @type {number} Upper threshold for thrust activation. between 5 and 15 frames*/
        this.upperVelocityErrorThreshold = (this.ship.thrust * randomBetween(5.0, 15.0)) / 60.0;
        /** @type {number} Lower threshold for thrust hysteresis. We use maxThrust for 1 frame*/
        this.lowerVelocityErrorThreshold = this.ship.thrust / 60.0;
        /** @type {number} Maximum distance to fire weapons. */
        this.firingRange = 1000.0;
        /** @type {string} Current state of the autopilot (e.g., "Approaching"). */
        this.state = "";
        /** @type {Object.<string, Function>} State handlers for update logic. */
        this.stateHandlers = {};

        // Initialize scratch vectors for calculations
        /** @type {Vector2D} Temporary scratch vector for calculations. */
        this._scratchTemp = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Final desired velocity after corrections. */
        this._scratchDesiredVelocity = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Difference between desired and current velocity. */
        this._scratchVelocityError = new Vector2D(0.0, 0.0);

        if (new.target === Autopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, validating preconditions and setting it active.
     */
    start() {
        if (!this.ship) {
            this.error = "No ship assigned";
            this.active = false;
            return;
        }
        this.active = true;
        this.completed = false;
        this.error = null;
    }

    /**
     * Updates the autopilot, executing the current state's handler.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     * @throws {Error} If the current state is invalid.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        const handler = this.stateHandlers[this.state];
        if (!handler) {
            throw new Error(`Invalid autopilot state: ${this.state}`);
        }
        handler(deltaTime, gameManager);
    }

    /**
     * Stops the autopilot, resetting ship controls and deactivating it.
     */
    stop() {
        if (this.subAutopilot) {
            this.subAutopilot.stop();
            this.subAutopilot = null;
        }
        this.active = false;
        this.ship.applyThrust(false);
        this.ship.applyBrakes(false);
    }

    /**
     * Returns the action name by processing the class name, removing 'Autopilot' and adding spaces before capital letters.
     * @returns {string} The action name.
     */
    getActionName() {
        const className = this.constructor.name;
        if (className.endsWith('Autopilot')) {
            const baseName = className.slice(0.0, -9.0); // Remove 'Autopilot'
            // Insert space before each capital letter (except first) and trim
            return baseName.replace(/([A-Z])/g, ' $1').trim();
        }
        return className; // Fallback if no 'Autopilot' suffix
    }

    /**
     * Returns the current status for HUD display.
     * @returns {string} The status string.
     */
    getStatus() {
        if (this.subAutopilot?.active) {
            return `${this.getActionName()}: ${this.subAutopilot.getStatus()}`;
        }

        const targetName = this.target?.name || (this.target instanceof Ship ? 'ship' : this.target instanceof Planet ? 'planet' : this.target instanceof Asteroid ? 'asteroid' : 'target');
        const baseStatus = this.state ? `${this.getActionName()} ${targetName} (${this.state})` : `${this.getActionName()} ${targetName}`;
        return this.error ? `${baseStatus}, Error: ${this.error}` : baseStatus;
    }

    /**
     * Checks if the autopilot has completed its task (success or failure).
     * @returns {boolean} True if completed or errored, false if still running.
     */
    isComplete() {
        return this.completed || !!this.error;
    }

    /**
     * Given a velocity error decide if we we should thrust or not including hysteresis.
     * @param {number} velocityErrorMagnitude Magnitude of the error between teh current velocity and the desired velocity.
     * @param {number} [errorThresholdRatio=1.0] The ratio for the error threshold, lofer is more accurate but can cause twitching.
     * @returns {boolean} True if should thrust, false if not.
     */
    shouldThrust(velocityErrorMagnitude, errorThresholdRatio = 1.0) {
        if (this.ship.isThrusting) {
            if (velocityErrorMagnitude <= this.lowerVelocityErrorThreshold) {
                return false;
            }
        } else {
            if (velocityErrorMagnitude > Math.max(this.lowerVelocityErrorThreshold, this.upperVelocityErrorThreshold * errorThresholdRatio)) {
                return true;
            }
        }
        return this.ship.isThrusting;
    }

    /**
     * Validates the target, setting error if invalid.
     * @returns {boolean} True if the target is valid, false otherwise.
     */
    validateTarget() {
        if (!isValidTarget(this.ship, this.target)) {
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: validateTarget, Invalid or unreachable target`);
            }
            this.error = "Invalid or unreachable target";
            this.active = false;
            return false;
        }
        if (this.target instanceof Ship && this.target.state !== 'Flying') {
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: validateTarget, Target not flying`);
            }
            this.error = "Target not flying";
            this.active = false;
            return false;
        }
        return true;
    }

    /**
     * Computes the lead position and direction for aiming at the target.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} target - The target to aim at.
     * @param {number} projectileSpeed - Speed of projectiles for lead aiming.
     * @param {Vector2D} targetVelocity - The target's velocity.
     * @param {number} distance - Distance to the target.
     * @param {Vector2D} directionToTarget - Normalized direction to the target.
     * @param {Vector2D} outLeadPosition - Output vector for lead position.
     * @param {Vector2D} outLeadOffset - Output vector for lead offset.
     * @param {Vector2D} outLateralOffset - Output vector for lateral offset.
     * @param {Vector2D} outLeadDirection - Output vector for normalized lead direction.
     * @param {Vector2D} outVelocityError - Output vector for velocity error.
     * @returns {number} Angle to lead position (radians).
     */
    computeLeadPosition(
        ship,
        target,
        projectileSpeed,
        targetVelocity,
        distance,
        directionToTarget,
        outLeadPosition,
        outLeadOffset,
        outLateralOffset,
        outLeadDirection,
        outVelocityError
    ) {
        outVelocityError.set(targetVelocity).subtractInPlace(ship.velocity);
        const timeToImpact = Math.min(distance / projectileSpeed, 3.0); // Maximum 3 second lead
        outLeadPosition.set(outVelocityError).multiplyInPlace(timeToImpact).addInPlace(target.position);
        outLeadOffset.set(outLeadPosition).subtractInPlace(target.position);
        const longitudinalComponent = outLeadOffset.dot(directionToTarget);
        outLateralOffset.set(outLeadOffset).subtractInPlace(
            this._scratchTemp.set(directionToTarget).multiplyInPlace(longitudinalComponent)
        );
        outLeadPosition.set(target.position).addInPlace(outLateralOffset);
        outLeadDirection.set(outLeadPosition).subtractInPlace(ship.position).normalizeInPlace();
        const leadAngle = outLeadDirection.getAngle();
        return normalizeAngle(leadAngle - ship.angle);
    }

    /**
    * Applies thrust based on velocity error and angle alignment.
    * @param {Ship} ship - The ship to control.
    * @param {Vector2D} desiredVelocity - Desired velocity vector.
    * @param {number|Vector2D|null} [failoverAngle=null] - Angle to face when not thrusting, or null.
    * @param {number} [errorThresholdRatio=1.0] The ratio for the error threshold, lofer is more accurate but can cause twitching.
    * @param {Vector2D} [outVelocityError=null] - Output vector for velocity error.
    * @returns {boolean} True if thrusting, false otherwise.
    */
    applyThrustLogic(ship, desiredVelocity, failoverAngle = null, errorThresholdRatio = 1.0, outVelocityError = null) {
        outVelocityError.set(desiredVelocity).subtractInPlace(ship.velocity);
        const velocityErrorMagnitude = outVelocityError.magnitude();

        //Cheat to avoid twitching
        if (velocityErrorMagnitude <= this.lowerVelocityErrorThreshold) {
            ship.velocity.set(desiredVelocity); // Snap to desired velocity
            outVelocityError.set(0.0, 0.0);
            ship.applyThrust(false);
            if (failoverAngle === null) {
                ship.setTargetAngle(desiredVelocity.getAngle());
            } else {
                ship.setTargetAngle(failoverAngle instanceof Vector2D ? failoverAngle.getAngle() : failoverAngle);
            }
            return false;
        }
        const desiredAngle = outVelocityError.getAngle();
        const angleToDesired = normalizeAngle(desiredAngle - ship.angle);
        const shouldThrust = this.shouldThrust(velocityErrorMagnitude, errorThresholdRatio);

        if (shouldThrust || failoverAngle === null) {
            ship.setTargetAngle(desiredAngle);
        } else {
            ship.setTargetAngle(failoverAngle instanceof Vector2D ? failoverAngle.getAngle() : failoverAngle);
        }

        if (shouldThrust && Math.abs(angleToDesired) < this.thrustAngleLimit) {
            ship.applyThrust(true);
        } else {
            ship.applyThrust(false);
        }

        return shouldThrust;
    }

    /**
     * Handles firing weapons if within range and aligned with the target.
     * @param {number} distance - Distance to the target.
     * @param {number} angleToLead - Angle to the lead position (radians).
     */
    handleFiring(distance, angleToLead) {
        if (distance <= this.firingRange) {
            this.ship.fireTurrets();
            if (Math.abs(angleToLead) < this.target.radius / distance) {
                this.ship.fireFixedWeapons();
            }
        }
    }
}

/**
 * Autopilot that flies a ship to a target, slowing to a specified speed within a given distance.
 * @extends Autopilot
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
     * Starts the autopilot, ensuring the target is in the same star system.
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
     * Updates the autopilot, adjusting velocity to reach the target at the desired speed.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            if (this.ship.landedObject === this.target) {
                this.completed = true;
                this.stop();
            } else {
                this.ship.initiateTakeoff();
            }
            return;
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

        // Ensure we are moiving towards the target then Adjust desired velocity based on distance phase
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

        // If we are not moving towards the target just force it by overiding the threshold
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
            //FIXME: implement manuver speed here, -20.0, 20.0
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

/**
 * Autopilot that escorts a target ship, moves within range of the ship, lands, takes off, jumps with the ship.
 * @extends Autopilot
 */
export class EscortAutopilot extends Autopilot {
    /**
     * Creates a new EscortAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} target - The target ship to escore.
     * @param {number} [minFollowDistance=100] - Minimum distance from target center.
     * @param {number} [maxFollowDistance=500] - Maximum distance from target center.
     */
    constructor(ship, target, minFollowDistance = 100.0, maxFollowDistance = 500.0) {
        super(ship, target);
        /** @type {Ship} The target to follow. */
        this.target = target;
        /** @type {number} Minimum distance from target center. */
        this.minFollowDistance = minFollowDistance;
        /** @type {number} Maximum distance from target center. */
        this.maxFollowDistance = maxFollowDistance;
        /** @type {Object.<string, Function>} Map of state names to their respective handler methods. */
        this.stateHandlers = {
            'Starting': this.updateStarting.bind(this),
            'Following': this.updateFollowing.bind(this),
            'FollowLanding': this.updateFollowLanding.bind(this),
            'Landing': this.updateLanding.bind(this),
            'TraversingJumpGate': this.updateTraversingJumpGate.bind(this),
            'Waiting': this.updateWaiting.bind(this)
        };
        /** @type {number} Minimum wait time (seconds) */
        this.waitTimeMin = 5.0;
        /** @type {number} Maximum wait time (seconds) */
        this.waitTimeMax = 10.0;
        /** @type {number} Time (seconds) remaining to wait in the 'Waiting' state. */
        this.waitTime = 0.0;

        if (new.target === EscortAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, validating that the target is a ship in the same star system.
     * @override
     */
    start() {
        super.start();

        if (!(this.target instanceof Ship)) {
            this.error = 'Target is not a ship';
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
        this.state = 'Starting';
    }

    /**
     * Updates the autopilot, delegating to the base class.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        if (this.ship.state !== "Landed" && this.ship.state !== "Flying") {
            return;
        }
        // Check if the escorted ship still exists
        if (!this.target || this.target.isDespawned() || !(this.target instanceof Ship)) {
            this.stop();
            this.error = 'Escorted ship despawned';
            return;
        }
        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the 'Starting' state: figure out where we are in relation to the target and switch to whatver state is required.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateStarting(deltaTime, gameManager) {
        // Check if target is in another star system
        if (this.target.starSystem !== this.ship.starSystem) {
            const jumpGate = this.ship.starSystem.getJumpGateToSystem(this.target.starSystem);
            if (jumpGate && !jumpGate.isDespawned()) {
                this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = "TraversingJumpGate";
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Transitioned to TraversingJumpGate for system ${this.target.starSystem.name}`);
                }
            } else {
                if (this.ship.state === "Landed") {
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = "Waiting";
                    if (this.ship.debug) {
                        console.log("EscortAutopilot: No jump gate found, transitioned to Waiting");
                    }
                } else {
                    // Find the closest planet in the current system to land on
                    const closestPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
                    if (closestPlanet) {
                        this.subAutopilot = new LandOnPlanetAutopilot(this.ship, closestPlanet);
                        this.subAutopilot.start();
                        this.state = "Landing";
                        if (this.ship.debug) {
                            console.log(`EscortAutopilot: No jump gate found, transitioned to Landing on ${closestPlanet.name}`);
                        }
                    } else {
                        this.error = "No landable planets found in current system";
                        this.stop();
                        if (this.ship.debug) {
                            console.log("EscortAutopilot: Stopped due to no landable planets");
                        }
                    }
                }
            }
            return;
        }

        // Target is in the same system
        if (this.target.state === "Landed" || this.target.state === "Landing") {
            const landedObject = this.target.landedObject;
            if (!landedObject) {
                this.error = "Target planet not found";
                this.stop();
                return;
            }
            if (this.ship.state === "Landed") {
                if (this.ship.landedObject === landedObject) {
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = "Waiting";
                    if (this.ship.debug) {
                        console.log(`EscortAutopilot: Transitioned to Waiting on ${landedObject.name}`);
                    }
                } else {
                    this.ship.initiateTakeoff();
                    if (this.ship.debug) {
                        console.log(`EscortAutopilot: Taking Off to land on ${landedObject.name}`);
                    }
                }
            } else if (this.ship.state === "Flying") {
                if (landedObject instanceof Planet) {
                    this.subAutopilot = new LandOnPlanetAutopilot(this.ship, landedObject);
                    this.subAutopilot.start();
                    this.state = "Landing";
                    if (this.ship.debug) {
                        console.log(`EscortAutopilot: Transitioned to Landing on ${landedObject.name}`);
                    }
                } else {
                    //we dont know what it landed on so just follow the landed object
                    this.subAutopilot = new FollowAutopilot(this.ship, landedObject, this.minFollowDistance, this.maxFollowDistance);
                    this.subAutopilot.start()
                    this.state = "Following";
                    if (this.ship.debug) {
                        console.log(`EscortAutopilot: Transitioned to Following ${landedObject.name}`);
                    }
                }
            }
            // If ship is in TakingOff or Landing, let those states complete naturally
        } else if (this.target.state === "Flying" || this.target.state === "TakingOff") {
            if (this.ship.state === "Landed") {
                this.ship.initiateTakeoff();
                if (this.ship.debug) {
                    console.log("EscortAutopilot: Taking Off to follow target");
                }
            } else if (this.ship.state === "Flying") {
                this.subAutopilot = new FollowAutopilot(this.ship, this.target, this.minFollowDistance, this.maxFollowDistance);
                this.subAutopilot.start();
                this.state = "Following";
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Transitioned to Following target ${this.target.name}`);
                }
            }
            // If ship is in TakingOff or Landing, let those states complete naturally
        } else {
            this.error = `Invalid target state '${this.target.state}' in updateStarting`;
            this.stop();
            if (this.ship.debug) {
                console.log(`EscortAutopilot: Stopped due to invalid target state '${this.target.state}'`);
            }
        }
    }

    /**
     * Handles the 'Waiting' state: pauses after landing before resuming escort duties, with early takeoff if the target takes off or is flying in the same system.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateWaiting(deltaTime, gameManager) {
        // Validate target
        if (!this.target || this.target.isDespawned() || !(this.target instanceof Ship)) {
            this.error = "Target is invalid or despawned";
            this.stop();
            if (this.ship.debug) {
                console.log('EscortAutopilot: Stopped due to invalid or despawned target');
            }
            return;
        }

        // Ensure ship is landed (should always be true in Waiting state)
        if (this.ship.state !== 'Landed') {
            console.warn(`Unexpected ship state '${this.ship.state}' in Waiting state; resetting`);
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log(`EscortAutopilot: Reset to Starting due to unexpected ship state '${this.ship.state}'`);
            }
            return;
        }

        // Handle target in the same system
        if (this.target.starSystem === this.ship.starSystem) {
            // Early takeoff if target is flying or taking off
            if (this.target.state === 'Flying' || this.target.state === 'TakingOff') {
                this.ship.initiateTakeoff();
                this.state = 'Starting';
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Early takeoff triggered, transitioned to Starting due to target ${this.target.state}`);
                }
                return;
            }

            // Handle target landed on a different planet
            if (this.target.state === 'Landed' || this.target.state === 'Landing') {
                const landedObject = this.target.landedObject;
                if (landedObject && this.ship.landedObject !== landedObject) {
                    this.ship.initiateTakeoff();
                    this.state = 'Starting';
                    if (this.ship.debug) {
                        console.log(`EscortAutopilot: Transitioned to Starting to land on target's planet ${landedObject.name}`);
                    }
                    return;
                }
            }
        }

        // Continue waiting
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0.0) {
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log('EscortAutopilot: Wait time expired, transitioned to Starting');
            }
        }
    }

    /**
     * Handles the 'Following' state: follows the escorted ship and reacts to its actions (landing, jumping).
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFollowing(deltaTime, gameManager) {
        if (!this.subAutopilot || !this.subAutopilot.active) {
            console.warn('Sub-autopilot not set or inactive during Following state');
            this.subAutopilot = null;
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log('EscortAutopilot: Reset to Starting due to missing or inactive sub-autopilot');
            }
            return;
        }

        // Handle the escorted ship jumping out
        if (this.target.state === 'JumpingOut') {
            this.subAutopilot.stop();
            this.subAutopilot = null;
            const jumpGate = this.target.jumpGate;
            if (jumpGate && !jumpGate.isDespawned()) {
                this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = 'TraversingJumpGate';
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Transitioned to TraversingJumpGate for jump gate ${jumpGate.name}`);
                }
            } else {
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
                if (this.ship.debug) {
                    console.log('EscortAutopilot: No jump gate found, transitioned to Waiting');
                }
            }
            return;
        }

        // Handle the escorted ship landing or landed
        if (this.target.state === 'Landing' || this.target.state === 'Landed') {
            const landedObject = this.target.landedObject;
            if (!landedObject) {
                this.error = 'Target landed but no landed object set!';
                this.subAutopilot.stop();
                this.subAutopilot = null;
                this.state = 'Starting';
                if (this.ship.debug) {
                    console.log('EscortAutopilot: Reset to Starting due to missing target planet');
                }
                return;
            }
            if (landedObject instanceof Planet) {
                this.subAutopilot.stop();
                this.subAutopilot = new LandOnPlanetAutopilot(this.ship, landedObject);
                this.subAutopilot.start();
                this.state = "Landing";
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Transitioned to Landing on ${landedObject.name}`);
                }
                return;
            } else {
                //we dont know what it landed on so just follow the landed object
                this.subAutopilot.stop();
                this.subAutopilot = new FollowAutopilot(this.ship, landedObject, this.minFollowDistance, this.maxFollowDistance);
                this.subAutopilot.start()
                this.state = "FollowLanding";
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Transitioned to FollowLanding ${landedObject.name}`);
                }
                return;
            }
        }

        // Handle the escorted ship moving to another star system
        if (this.target.starSystem !== this.ship.starSystem) {
            this.subAutopilot.stop();
            this.subAutopilot = null;
            const jumpGate = this.ship.starSystem.getJumpGateToSystem(this.target.starSystem);
            if (jumpGate && !jumpGate.isDespawned()) {
                this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = 'TraversingJumpGate';
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Transitioned to TraversingJumpGate for system ${this.target.starSystem.name}`);
                }
            } else {
                // Land on the closest planet if no jump gate is found
                const closestPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
                if (closestPlanet) {
                    this.subAutopilot = new LandOnPlanetAutopilot(this.ship, closestPlanet);
                    this.subAutopilot.start();
                    this.state = 'Landing';
                    if (this.ship.debug) {
                        console.log(`EscortAutopilot: No jump gate found, transitioned to Landing on ${closestPlanet.name}`);
                    }
                } else {
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = 'Waiting';
                    if (this.ship.debug) {
                        console.log('EscortAutopilot: No jump gate or planets found, transitioned to Waiting');
                    }
                }
            }
            return;
        }

        // Continue following the escorted ship
        this.subAutopilot.update(deltaTime, gameManager);
        if (!this.subAutopilot.active || this.subAutopilot.error) {
            console.warn(`Sub-autopilot inactive or errored during Following state: ${this.subAutopilot.error || 'unknown error'}`);
            this.subAutopilot.stop();
            this.subAutopilot = null;
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log('EscortAutopilot: Reset to Starting due to sub-autopilot failure');
            }
        }
    }

    /**
     * Handles the 'FollowLanding' state: follows the same body as the escorted ship, aborting if it takes off.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFollowLanding(deltaTime, gameManager) {
        if (!this.subAutopilot || !this.subAutopilot.active) {
            console.warn('Sub-autopilot not set or inactive during FollowLanding state');
            this.subAutopilot = null;
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log('EscortAutopilot: Reset to Starting due to missing or inactive sub-autopilot');
            }
            return;
        }

        // Abort landing if the escorted ship takes off or is flying
        if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
            this.subAutopilot.stop();
            this.subAutopilot = new FollowAutopilot(this.ship, this.target, this.minFollowDistance, this.maxFollowDistance);
            this.subAutopilot.start();
            this.state = 'Following';
            if (this.ship.debug) {
                console.log(`EscortAutopilot: Aborted landing, transitioned to Following target ${this.target.name}`);
            }
            return;
        }

        // Continue following the escorted ship
        this.subAutopilot.update(deltaTime, gameManager);
        if (!this.subAutopilot.active || this.subAutopilot.error) {
            console.warn(`Sub-autopilot inactive or errored during FollowLanding state: ${this.subAutopilot.error || 'unknown error'}`);
            this.subAutopilot.stop();
            this.subAutopilot = null;
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log('EscortAutopilot: Reset to Starting due to sub-autopilot failure');
            }
        }
    }


    /**
     * Handles the 'Landing' state: lands on the same body as the escorted ship, aborting if it takes off.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateLanding(deltaTime, gameManager) {
        if (!this.subAutopilot || !this.subAutopilot.active) {
            console.warn('Sub-autopilot not set or inactive during Landing state');
            this.subAutopilot = null;
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log('EscortAutopilot: Reset to Starting due to missing or inactive sub-autopilot');
            }
            return;
        }

        // Abort landing if the escorted ship takes off or is flying
        if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
            this.subAutopilot.stop();
            this.subAutopilot = new FollowAutopilot(this.ship, this.target, this.minFollowDistance, this.maxFollowDistance);
            this.subAutopilot.start();
            this.state = 'Following';
            if (this.ship.debug) {
                console.log(`EscortAutopilot: Aborted landing, transitioned to Following target ${this.target.name}`);
            }
            return;
        }

        // Handle target moving to another star system
        if (this.target.starSystem !== this.ship.starSystem) {
            this.subAutopilot.stop();
            this.subAutopilot = null;
            const jumpGate = this.ship.starSystem.getJumpGateToSystem(this.target.starSystem);
            if (jumpGate && !jumpGate.isDespawned()) {
                this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = 'TraversingJumpGate';
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Target moved to another system, transitioned to TraversingJumpGate for system ${this.target.starSystem.name}`);
                }
            } else {
                // Land on the closest planet if no jump gate is found
                const closestPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
                if (closestPlanet) {
                    this.subAutopilot = new LandOnPlanetAutopilot(this.ship, closestPlanet);
                    this.subAutopilot.start();
                    this.state = 'Landing';
                    if (this.ship.debug) {
                        console.log(`EscortAutopilot: No jump gate found, continuing Landing on ${closestPlanet.name}`);
                    }
                } else {
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = 'Waiting';
                    if (this.ship.debug) {
                        console.log('EscortAutopilot: No jump gate or planets found, transitioned to Waiting');
                    }
                }
            }
            return;
        }

        // Process landing
        this.subAutopilot.update(deltaTime, gameManager);
        if (this.subAutopilot.isComplete()) {
            if (this.subAutopilot.error) {
                console.warn(`Landing failed: ${this.subAutopilot.error}`);
                this.subAutopilot = null;
                this.state = 'Starting';
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Reset to Starting due to landing failure: ${this.subAutopilot.error}`);
                }
            } else if (this.ship.state === 'Landed') {
                this.subAutopilot = null;
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Landing complete, transitioned to Waiting on ${this.ship.landedObject.name}`);
                }
            } else {
                console.warn('Landing completed but ship not landed; resetting');
                this.subAutopilot = null;
                this.state = 'Starting';
                if (this.ship.debug) {
                    console.log('EscortAutopilot: Reset to Starting due to unexpected ship state after landing');
                }
            }
        } else if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot inactive but not complete during Landing state');
            this.subAutopilot = null;
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log('EscortAutopilot: Reset to Starting due to inactive sub-autopilot');
            }
        }
    }

    /**
     * Handles the 'TraversingJumpGate' state: jumps to the escorted ship's star system.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateTraversingJumpGate(deltaTime, gameManager) {
        if (!this.subAutopilot || !this.subAutopilot.active) {
            console.warn('Sub-autopilot not set or inactive during TraversingJumpGate state');
            this.subAutopilot = null;
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log('EscortAutopilot: Reset to Starting due to missing or inactive sub-autopilot');
            }
            return;
        }

        // Process the jump
        this.subAutopilot.update(deltaTime, gameManager);
        if (this.subAutopilot.isComplete()) {
            if (this.subAutopilot.error) {
                console.warn(`Jump failed: ${this.subAutopilot.error}`);
                this.subAutopilot = null;
                this.state = 'Starting';
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Reset to Starting due to jump failure: ${this.subAutopilot.error}`);
                }
            } else if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.starSystem) {
                this.subAutopilot = new FollowAutopilot(this.ship, this.target, this.minFollowDistance, this.maxFollowDistance);
                this.subAutopilot.start();
                this.state = 'Following';
                if (this.ship.debug) {
                    console.log(`EscortAutopilot: Jump complete, transitioned to Following target ${this.target.name} in system ${this.ship.starSystem.name}`);
                }
            } else {
                console.warn('Jump completed but not in target system or not flying; resetting');
                this.subAutopilot = null;
                this.state = 'Starting';
                if (this.ship.debug) {
                    console.log('EscortAutopilot: Reset to Starting due to unexpected state or system mismatch after jump');
                }
            }
        } else if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot inactive but not complete during TraversingJumpGate state');
            this.subAutopilot = null;
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log('EscortAutopilot: Reset to Starting due to inactive sub-autopilot');
            }
        }
    }
}

/**
 * Autopilot that uses FlyToTargetAutopilot to a target, then initiate landing.
 * @extends Autopilot
 */
export class LandOnPlanetAutopilot extends Autopilot {
    /**
     * Creates a new LandOnPlanetAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Planet} planet - The planet to land on.
     */
    constructor(ship, planet) {
        super(ship, planet);
        /** @type {FlyToTargetAutopilot|null} Sub-autopilot for approaching the planet. */
        this.subAutopilot = null;
        /** @type {Vector2D} Distance vector from ship to target planet. */
        this._scratchDistanceToTarget = new Vector2D(0.0, 0.0);

        if (new.target === LandOnPlanetAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, ensuring the target is a planet in the same system.
     */
    start() {
        super.start();

        if (!(this.target instanceof Planet)) {
            this.error = 'Target is not a planet';
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

        this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
        this.subAutopilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase, landing initiation, and completion.
     * Restarts the sub-autopilot if the ship overshoots and cannot land yet.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;

        if (this.subAutopilot && this.subAutopilot.active) {
            // Delegate to sub-pilot for approaching the planet
            this.subAutopilot.update(deltaTime, gameManager);
            if (this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot = null; // Sub-pilot done, proceed to landing check
            }
        } else if (this.ship.state === 'Flying') {
            // Check distance to planet for landing readiness
            this._scratchDistanceToTarget.set(this.ship.position).subtractInPlace(this.target.position);
            const distanceToPlanetCenter = this._scratchDistanceToTarget.magnitude();

            if (distanceToPlanetCenter <= this.target.radius) {
                if (this.target instanceof Planet && this.ship.canLand(this.target)) {
                    // Initiate landing if conditions are met
                    this.ship.initiateLanding(this.target);
                } else {
                    // Slow down if not ready to land (e.g., speed too high)
                    // TODO: Replace this hack with better approach tuning
                    this.ship.velocity.multiplyInPlace(1 - (0.5 * deltaTime));
                    this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDistanceToTarget).multiplyInPlace(-0.5 * deltaTime));
                    this._scratchVelocityError.set(-this.ship.velocity.x, -this.ship.velocity.y);
                    const desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12.0);
                }
            } else {
                // Overshot the planet; restart sub-pilot to re-approach
                this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
                this.subAutopilot.start();
            }
        } else if (this.ship.state === 'Landing') {
            // Wait for landing animation to complete
        } else if (this.ship.state === 'Landed') {
            // Landing completed successfully
            this.completed = true;
            this.stop();
        } else {
            // Handle unexpected ship states (e.g., TakingOff, JumpingOut)
            this.error = `Unexpected ship state during landing: ${this.ship.state}`;
            this.stop();
        }
    }

    /**
     * Stops the autopilot and any active sub-autopilot.
     */
    stop() {
        if (this.subAutopilot) this.subAutopilot.stop();
        super.stop();
    }
}


/**
 * Autopilot that uses FlyToTargetAutopilot to approach a disabled ship, then initiate boarding to capture it.
 * @extends Autopilot
 */
export class BoardShipAutopilot extends Autopilot {
    /**
     * Creates a new BoardShipAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} targetShip - The target ship to board and capture.
     */
    constructor(ship, targetShip) {
        super(ship, targetShip);
        /** @type {FlyToTargetAutopilot|null} Sub-autopilot for approaching the target ship. */
        this.subAutopilot = null;
        /** @type {Vector2D} Distance vector from ship to target ship. */
        this._scratchDistanceToTarget = new Vector2D(0.0, 0.0);

        if (new.target === BoardShipAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, ensuring the target is a disabled ship in the same system.
     */
    start() {
        super.start();

        if (!(this.target instanceof Ship)) {
            this.error = 'Target is not a ship';
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

        if (this.target.state !== 'Disabled') {
            this.error = 'Target ship is not disabled';
            this.active = false;
            return;
        }

        // Initialize sub-autopilot to approach the target ship
        this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
        this.subAutopilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase, boarding initiation, and completion.
     * Restarts the sub-autopilot if the ship overshoots and cannot board yet.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;

        if (!this.target || this.target.state !== 'Disabled' || this.target.isDespawned() || !(this.target instanceof Ship)) {
            this.error = 'Target ship is no longer valid or not disabled';
            this.stop();
            return;
        }

        if (this.subAutopilot && this.subAutopilot.active) {
            // Delegate to sub-pilot for approaching the target ship
            this.subAutopilot.update(deltaTime, gameManager);
            if (this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot = null; // Sub-pilot done, proceed to boarding check
            }
        } else if (this.ship.state === 'Flying') {
            // Check distance to target ship for boarding readiness
            this._scratchDistanceToTarget.set(this.ship.position).subtractInPlace(this.target.position);
            const distanceToTargetCenter = this._scratchDistanceToTarget.magnitude();

            if (distanceToTargetCenter <= this.target.radius) {
                if (this.target instanceof Ship && this.ship.canBoard(this.target)) {
                    // Initiate boarding if conditions are met
                    this.ship.initiateBoarding(this.target);;
                } else {
                    // Slow down and adjust position if not ready to board
                    // Adapted from LandOnPlanetAutopilot for smooth approach
                    this.ship.velocity.multiplyInPlace(1 - (0.5 * deltaTime));
                    this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDistanceToTarget).multiplyInPlace(-0.5 * deltaTime));
                    this._scratchVelocityError.set(-this.ship.velocity.x, -this.ship.velocity.y);
                    const desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12.0);
                }
            } else {
                // Overshot the target ship; restart sub-pilot to re-approach
                this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
                this.subAutopilot.start();
            }
        } else if (this.ship.state === 'Landing') {
            // Wait for boarding action to complete (e.g., animation or timer)
        } else if (this.ship.state === 'Landed') {
            // Boarding completed successfully, ship captured
            this.completed = true;
            this.stop();
        } else {
            // Handle unexpected ship states
            this.error = `Unexpected ship state during boarding: ${this.ship.state}`;
            this.stop();
        }
    }

    /**
     * Stops the autopilot and any active sub-autopilot.
     */
    stop() {
        if (this.subAutopilot) this.subAutopilot.stop();
        super.stop();
    }
}
//OLD Auto Pilots
// /**
//  * @extends Autopilot
//  */
// export class EscortAutopilot extends Autopilot {
//     /**
//      * Creates a new EscortAutopilot instance.
//      * @param {Ship} ship - The ship to control with this autopilot.
//      * @param {Ship} escortedShip - The target ship to escort.
//      * @param {number} [followDistance=250] - The desired distance to maintain while following the escorted ship.
//      */
//     constructor(ship, escortedShip, followDistance = 250.0) {
//         super(ship, escortedShip);
//         /** @type {number} The distance to maintain while following the escorted ship. */
//         this.followDistance = followDistance;
//         /** @type {string} The current state of the autopilot (e.g., 'Idle', 'Following'). */
//         this.state = 'Idle';
//         /** @type {number} Time (seconds) remaining to wait in the 'Waiting' state. */
//         this.waitTime =  0.0;
//         /** @type {Vector2D} Pre-allocated vector for direction calculations to avoid allocations. */
//         this._scratchDirectionToTarget = new Vector2D(0.0,  0.0);
//         /** @type {Vector2D} Pre-allocated vector for distance (unused but retained for consistency). */
//         this._scratchDistanceToTarget = new Vector2D(0.0,  0.0);
//         /** @type {number} Minimum wait time (seconds) after landing before taking off. */
//         this.waitTimeMin =  2.0;
//         /** @type {number} Maximum wait time (seconds) after landing before taking off. */
//         this.waitTimeMax =  5.0;
//         /** @type {Object.<string, Function>} Map of state names to their respective handler methods. */
//         this.stateHandlers = {
//             Idle: this.updateIdle.bind(this),
//             Following: this.updateFollowing.bind(this),
//             TakingOff: this.updateTakingOff.bind(this),
//             Landing: this.updateLanding.bind(this),
//             TraversingJumpGate: this.updateTraversingJumpGate.bind(this),
//             Waiting: this.updateWaiting.bind(this)
//         };
//     }

//     /**
//      * Starts the autopilot, validating that the target is a ship in the same star system.
//      * @override
//      */
//     start() {
//         super.start();
//         if (!(this.target instanceof Ship)) {
//             this.error = 'Target is not a ship';
//             this.active = false;
//             return;
//         }
//         if (this.target.starSystem !== this.ship.starSystem) {
//             this.error = 'Target ship not in same system';
//             this.active = false;
//             return;
//         }
//     }

//     /**
//      * Updates the autopilot's behavior based on its current state.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      */
//     update(deltaTime) {
//         if (!this.active) return;

//         // Check if the escorted ship still exists
//         if (!this.target || this.target.isDespawned()) {
//             this.stop();
//             this.error = 'Escorted ship despawned';
//             console.warn('Escorted ship despawned');
//             return;
//         }

//         const handler = this.stateHandlers[this.state];
//         if (handler) {
//             handler(deltaTime);
//         } else {
//             console.warn(`No handler for state: ${this.state}`);
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the 'Idle' state: initiates following or takeoff based on the escorted ship's state.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateIdle(deltaTime) {
//         if (this.ship.state === 'Landed') {
//             // Take off if the escorted ship is moving
//             if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
//                 this.ship.initiateTakeoff();
//                 this.state = 'TakingOff';
//             }
//         } else if (this.ship.state === 'Flying') {
//             // Begin following the escorted ship
//             this.subAutopilot = new FollowShipAutopilot(this.ship, this.target, this.followDistance,  100.0);
//             this.subAutopilot.start();
//             this.state = 'Following';
//         } else if (this.ship.state === 'TakingOff' || this.ship.state === 'Landing') {
//             // Wait for transitional states to complete
//         } else {
//             console.warn(`Invalid ship state '${this.ship.state}' in EscortAutopilot updateIdle`);
//         }
//     }

//     /**
//      * Handles the 'Following' state: follows the escorted ship and reacts to its actions (landing, jumping).
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateFollowing(deltaTime) {
//         if (!this.subAutopilot) {
//             console.warn('Sub-autopilot not set during Following state');
//             this.state = 'Idle';
//             return;
//         }

//         // Handle the escorted ship jumping out
//         if (this.target.state === 'JumpingOut') {
//             this.subAutopilot.stop();
//             const jumpGate = this.target.jumpGate;
//             if (jumpGate && jumpGate instanceof JumpGate && !jumpGate.isDespawned()) {
//                 this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
//                 this.subAutopilot.start();
//                 this.state = 'TraversingJumpGate';
//             } else {
//                 console.warn('Jump gate invalid or not found; entering wait mode');
//                 this.subAutopilot = null;
//                 this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//                 this.state = 'Waiting';
//             }
//             return;
//         }

//         // Handle the escorted ship landing
//         if (this.target.state === 'Landed' || this.target.state === 'Landing') {
//             this.subAutopilot.stop();
//             this.subAutopilot = new LandOnPlanetAutopilot(this.ship, this.target.landedObject);
//             this.subAutopilot.start();
//             this.state = 'Landing';
//             return;
//         }

//         // Handle the escorted ship moving to another star system
//         if (this.target.starSystem !== this.ship.starSystem) {
//             this.subAutopilot.stop();
//             const targetSystem = this.target.starSystem;
//             const jumpGate = this.ship.starSystem.getJumpGateToSystem(targetSystem);
//             if (jumpGate) {
//                 this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
//                 this.subAutopilot.start();
//                 this.state = 'TraversingJumpGate';
//             } else {
//                 console.warn('No jump gate found to target system; entering wait mode');
//                 this.subAutopilot = null;
//                 this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//                 this.state = 'Waiting';
//             }
//             return;
//         }

//         // Continue following the escorted ship
//         this.subAutopilot.update(deltaTime);
//         if (!this.subAutopilot.active) {
//             console.warn('Sub-autopilot inactive during Following state; resetting');
//             this.subAutopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the 'TakingOff' state: waits for the ship to complete takeoff.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateTakingOff(deltaTime) {
//         if (this.ship.state === 'Flying') {
//             this.state = 'Idle'; // Transition to determine the next action
//         }
//     }

//     /**
//      * Handles the 'Landing' state: lands on the same body as the escorted ship, aborting if it takes off.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateLanding(deltaTime) {
//         if (!this.subAutopilot) {
//             console.warn('Sub-autopilot not set during Landing state');
//             this.state = 'Idle';
//             return;
//         }

//         // Abort landing if the escorted ship takes off
//         if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
//             this.subAutopilot.stop();
//             this.subAutopilot = null;
//             this.state = 'Idle';
//             return;
//         }

//         // Process landing
//         this.subAutopilot.update(deltaTime);
//         if (this.subAutopilot.isComplete()) {
//             if (this.subAutopilot.error) {
//                 console.warn(`Landing failed: ${this.subAutopilot.error}`);
//                 this.subAutopilot = null;
//                 this.state = 'Idle';
//             } else if (this.ship.state === 'Landed') {
//                 this.subAutopilot = null;
//                 this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//                 this.state = 'Waiting';
//             } else {
//                 console.warn('Landing completed but ship not landed; resetting');
//                 this.subAutopilot = null;
//                 this.state = 'Idle';
//             }
//         } else if (!this.subAutopilot.active) {
//             console.warn('Sub-autopilot inactive but not complete during Landing state');
//             this.subAutopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the 'TraversingJumpGate' state: jumps to the escorted ship's star system.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateTraversingJumpGate(deltaTime) {
//         if (!this.subAutopilot) {
//             console.warn('Sub-autopilot not set during TraversingJumpGate state');
//             this.state = 'Idle';
//             return;
//         }

//         // Process the jump
//         this.subAutopilot.update(deltaTime);
//         if (this.subAutopilot.isComplete()) {
//             if (this.subAutopilot.error) {
//                 console.warn(`Jump failed: ${this.subAutopilot.error}`);
//                 this.subAutopilot = null;
//                 this.state = 'Idle';
//             } else if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.starSystem) {
//                 this.subAutopilot = null;
//                 this.state = 'Idle'; // Transition to resume following
//             } else {
//                 console.warn('Jump completed but not in target system; resetting');
//                 this.subAutopilot = null;
//                 this.state = 'Idle';
//             }
//         } else if (!this.subAutopilot.active) {
//             console.warn('Sub-autopilot inactive but not complete during TraversingJumpGate state');
//             this.subAutopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the 'Waiting' state: pauses after landing before resuming escort duties.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateWaiting(deltaTime) {
//         this.waitTime -= deltaTime;
//         if (this.waitTime <= 0.0) {
//             this.state = 'Idle'; // Check the escorted ship's state next update
//         }
//     }

//     /**
//      * Returns the current status of the autopilot for display (e.g., on a HUD).
//      * @returns {string} A descriptive status string based on the current state.
//      */
//     getStatus() {
//         if (this.state === 'Following' && this.subAutopilot?.active) {
//             return `Escorting ${this.target.name || 'ship'}`;
//         }
//         if (this.state === 'Landing' && this.subAutopilot?.active) {
//             return `Landing on ${this.target.landedOn?.name || 'body'}`;
//         }
//         if (this.state === 'TraversingJumpGate' && this.subAutopilot?.active) {
//             return `Jumping to ${this.target.starSystem?.name || 'system'}`;
//         }
//         if (this.state === 'Waiting') {
//             return 'Waiting';
//         }
//         return `Escorting (${this.state})`;
//     }
// }


/**
 * @extends Autopilot
 */
export class LandOnAsteroidAutopilot extends Autopilot {
    /**
     * Creates a new LandOnAsteroidAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Asteroid} asteroid - The asteroid to land on and mine.
     */
    constructor(ship, asteroid) {
        super(ship, asteroid);
        /** @type {Vector2D} Pre-allocated vector for distance calculations. */
        this._scratchDistanceToTarget = new Vector2D(0.0, 0.0);

        if (new.target === LandOnAsteroidAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, ensuring the target is an asteroid in the same system.
     * @override
     */
    start() {
        super.start();

        if (!(this.target instanceof Asteroid)) {
            this.error = 'Target is not an Asteroid';
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

        this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
        this.subAutopilot.start();
    }

    /**
     * Updates the autopilot, managing the approach phase, mining initiation, and completion.
     * Restarts the sub-pilot if the ship overshoots and can't mine yet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     * @override
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;

        if (this.subAutopilot && this.subAutopilot.active) {
            // Delegate to sub-pilot for approaching the asteroid
            this.subAutopilot.update(deltaTime, gameManager);
            if (this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot = null; // Sub-pilot done, proceed to mining check
            }
        } else if (this.ship.state === 'Flying') {
            // Check distance to asteroid for mining readiness
            this._scratchDistanceToTarget.set(this.ship.position).subtractInPlace(this.target.position);
            const distanceToAsteroidCenter = this._scratchDistanceToTarget.magnitude();

            if (distanceToAsteroidCenter <= this.target.radius) {
                if (this.ship.canLand(this.target)) {
                    // Initiate mining if conditions are met
                    this.ship.initiateLanding(this.target);
                    return;
                } else {
                    // Slow down if not ready to mine (e.g., speed too high)
                    this._scratchVelocityError.set(this.target.velocity).subtractInPlace(this.ship.velocity);
                    const desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    const velocityErrorMagnitude = this._scratchVelocityError.magnitude();
                    if (velocityErrorMagnitude > 1.0) {
                        this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12.0);
                    }
                }
            } else {
                // Overshot the asteroid; restart sub-pilot to re-approach
                if (this.ship.debug) {
                    console.log(`Overshot ${this.target.name || 'asteroid'}; restarting approach phase`);
                }
                this.subAutopilot = new FlyToTargetAutopilot(
                    this.ship,
                    this.target,
                    this.target.radius,
                    Ship.LANDING_SPEED,
                );
                this.subAutopilot.start();
            }
        } else if (this.ship.state === 'Landing') {
            // Wait for landing animation to complete
        } else if (this.ship.state === 'Landed') {
            // Mining started successfully; mark as complete
            this.completed = true;
            this.stop();
        } else {
            // Handle unexpected states (e.g., TakingOff, JumpingOut)
            this.error = `Unexpected ship state during mining: ${this.ship.state}`;
            this.stop();
        }
    }

    /**
     * Stops the autopilot and any active sub-autopilot.
     * @override
     */
    stop() {
        if (this.subAutopilot) this.subAutopilot.stop();
        super.stop();
    }
}

/**
 * @extends Autopilot
 */
export class TraverseJumpGateAutopilot extends Autopilot {
    /**
     * Creates a new TraverseJumpGateAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {JumpGate} gate - The jump gate to traverse.
     */
    constructor(ship, gate) {
        super(ship, gate);
        /** @type {FlyToTargetAutopilot|null} Sub-autopilot for approaching the jump gate. */
        this.subAutopilot = null;
        /** @type {Vector2D} Distance vector from ship to target jump gate. */
        this._scratchDistanceToTarget = new Vector2D(0.0, 0.0);

        if (new.target === TraverseJumpGateAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, ensuring the target is a jump gate in the same system.
     */
    start() {
        super.start();

        if (!(this.target instanceof JumpGate)) {
            this.error = 'Target is not a JumpGate';
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

        this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, this.ship.maxVelocity);
        this.subAutopilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase, hyperjump initiation, and jump completion.
     * Restarts the sub-autopilot if the ship is not aligned with the gate.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;

        if (this.subAutopilot && this.subAutopilot.active) {
            // Delegate to sub-pilot to approach the jump gate
            this.subAutopilot.update(deltaTime, gameManager);
            if (this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot = null; // Sub-pilot done, proceed to jump phase
            }
        } else if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.lane.target) {
            // Jump completed successfully
            this.completed = true;
            this.stop();
        } else if (this.ship.state === 'Flying') {
            // Check if ship is close enough to initiate hyperjump
            this._scratchDistanceToTarget.set(this.ship.position).subtractInPlace(this.target.position);
            if (this.target.overlapsPoint(this.ship.position)) {
                if (this.ship.initiateHyperjump()) {
                    // Hyperjump initiated; wait for animation
                } else {
                    // Slow down if hyperjump fails (e.g., not ready)
                    // TODO: Replace this hack with better alignment logic
                    this.ship.velocity.multiplyInPlace(1 - (0.5 * deltaTime));
                    this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDistanceToTarget).multiplyInPlace(-0.5 * deltaTime));
                    this._scratchVelocityError.set(-this.ship.velocity.x, -this.ship.velocity.y);
                    const desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12.0);
                }
            } else {
                // Not aligned with gate; restart sub-pilot
                if (this.ship.debug) {
                    console.log(`Not aligned with ${this.target.name || 'jump gate'}; restarting fly-to phase`);
                }
                this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
                this.subAutopilot.start();
            }
        } else if (this.ship.state === 'JumpingOut' || this.ship.state === 'JumpingIn') {
            // Wait for jump animation to complete
        } else {
            // Handle unexpected ship states
            this.error = `Unexpected ship state during jump: ${this.ship.state}`;
            this.stop();
        }
    }
}

/**
 * @extends Autopilot
 */
export class FleeAutopilot extends Autopilot {
    /**
     * Creates a new FleeAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} threat - The threat to flee from.
     */
    constructor(ship, threat) {
        super(ship);
        /** @type {Ship} The ship posing a threat to flee from. */
        this.threat = threat;
        /** @type {JumpGate|Planet|null} The target to flee to (jump gate or planet). */
        this.target = ship.starSystem.getClosestJumpGatePlanet(ship);
        /** @type {Vector2D} Temporary vector for calculations. */
        this._scratchVector = new Vector2D();

        if (new.target === FleeAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, validating the target.
     */
    start() {
        super.start();

        if (!(this.threat instanceof Ship)) {
            this.error = 'Threat is not a ship';
            this.active = false;
            return;
        }

        if (!this.threat) {
            this.error = 'No threat';
            this.active = false;
            return;
        }

        if (!isValidTarget(this.ship, this.threat)) {
            this.error = 'Threat not in same system';
            this.active = false;
            return;
        }

        this.ship.target = this.threat;
    }

    /**
     * Updates the autopilot, fleeing to the target and managing sub-autopilots.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.target || this.ship.state !== 'Flying') {
            this.completed = true;
            this.stop();
            return;
        }

        if (!isValidTarget(this.ship, this.target)) {
            console.log('FleeAutopilot: target not valid!');
            this.target = this.ship.starSystem.getClosestPlanet(this.ship);
            if (this.subAutopilot) {
                this.subAutopilot.stop();
                this.subAutopilot = null;
            }
        }

        if (!this.subAutopilot) {
            // Navigate to target
            if (this.target instanceof JumpGate) {
                this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, this.target);
            } else {
                this.subAutopilot = new LandOnPlanetAutopilot(this.ship, this.target);
            }
            this.subAutopilot.start();
        } else {
            this.subAutopilot.update(deltaTime, gameManager);
            return;
        }
    }

    /**
     * Returns the current status for HUD display.
     * @returns {string} The status string.
     */
    getStatus() {
        if (this.subAutopilot?.active) {
            return `${this.getActionName()}: ${this.subAutopilot.getStatus()}`;
        }

        const targetName = this.target?.name || (this.target instanceof Ship ? 'ship' : this.target instanceof Planet ? 'planet' : this.target instanceof Asteroid ? 'asteroid' : 'target');
        const threatName = this.threat?.name || (this.target instanceof Ship ? 'ship' : 'threat');
        const baseStatus = this.state ? `${this.getActionName()} from ${threatName} to ${targetName} (${this.state})` : `${this.getActionName()} from ${threatName} to ${targetName}`;
        return this.error ? `${baseStatus}, Error: ${this.error}` : baseStatus;
    }
}

/**
 * @extends Autopilot
 */
export class LandOnPlanetDespawnAutopilot extends Autopilot {
    /**
     * Creates a new LandOnPlanetDespawnAutopilot instance.
     * @param {Ship} ship - The ship to control.
     */
    constructor(ship) {
        super(ship);
        /** @type {Planet|null} The closest planet to land on. */
        this.target = ship.starSystem?.getClosestPlanet(ship);
        /** @type {Vector2D} Scratch vector for distance calculations. */
        this._scratchDistanceToTarget = new Vector2D();

        if (new.target === LandOnPlanetDespawnAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, validating the target planet.
     */
    start() {
        super.start();

        if (!(this.target instanceof Planet)) {
            this.error = 'Target is not a Planet';
            this.active = false;
            return;
        }

        if (!this.target) {
            this.error = 'No planet available';
            this.active = false;
            return;
        }

        if (!isValidTarget(this.ship, this.target)) {
            this.error = 'Target not in same system';
            this.active = false;
            return;
        }

        this.ship.target = this.target;
        this.subAutopilot = new LandOnPlanetAutopilot(this.ship, this.target);
        this.subAutopilot.start();
    }

    /**
     * Updates the autopilot, managing landing and despawning.
     * @param {number} deltaTime - Time elapsed in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;
        if (!this.target || this.target.isDespawned()) {
            this.target = this.ship.starSystem?.getClosestPlanet(this.ship);
            if (!this.target) {
                this.error = 'No planet available';
                this.stop();
                return;
            }
            this.subAutopilot = new LandOnPlanetAutopilot(this.ship, this.target);
            this.subAutopilot.start();
        }

        if (this.subAutopilot && this.subAutopilot.active) {
            this.subAutopilot.update(deltaTime);
            if (this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot = null;
            }
        } else if (this.ship.state === 'Landed') {
            this.ship.despawn();
            this.completed = true;
            this.stop();
        } else if (this.ship.state !== 'Landing') {
            this.subAutopilot = new LandOnPlanetAutopilot(this.ship, this.target);
            this.subAutopilot.start();
        }
    }
}

/**
 * Autopilot for avoiding a threat by moving away and toward the sector center.
 * @extends Autopilot
 */
export class AvoidAutopilot extends Autopilot {
    /**
     * Creates a new AvoidAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} threat - The threat to avoid.
     */
    constructor(ship, threat) {
        super(ship);
        /** @type {Ship} The ship posing a threat to avoid. */
        this.threat = threat;
        /** @type {number} Maximum duration (seconds) to attempt avoiding the threat. */
        this.timeout = 30.0;
        /** @type {number} Cumulative time (seconds) spent avoiding the threat. */
        this.timeElapsed = 0.0;
        /** @type {Vector2D} Scratch vector for target direction. */
        this._scratchDirectionToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for delta to target. */
        this._scratchDeltaToTarget = new Vector2D(0.0, 0.0);

        if (new.target === AvoidAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, initializing avoidance behavior.
     */
    start() {
        super.start();

        if (!(this.threat instanceof Ship)) {
            this.error = 'Threat is not a ship';
            this.active = false;
            return;
        }

        if (!this.threat) {
            this.error = 'No threat';
            this.active = false;
            return;
        }

        if (!isValidTarget(this.ship, this.threat)) {
            this.error = 'Threat not in same system';
            this.active = false;
            return;
        }

        this.timeElapsed = 0.0;
        this.ship.target = this.threat;
    }

    /**
     * Updates the autopilot, moving the ship away from the threat and toward the sector center.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.threat || this.ship.state !== 'Flying') {
            this.completed = true;
            this.stop();
            return;
        }

        this.timeElapsed += deltaTime;
        if (this.timeElapsed >= this.timeout) {
            this.completed = true;
            this.stop();
            return;
        }

        // Calculate distance and direction to threat
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.threat.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        // Compute desired velocity away from threat and towrads system center
        this._scratchDesiredVelocity.set(this.ship.position).normalizeInPlace().multiplyInPlace(0.5).addInPlace(this._scratchDirectionToTarget).normalizeInPlace().multiplyInPlace(-this.ship.maxVelocity);

        // Apply thrust with hysteresis
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            this.ship.velocity,
            1.0,
            this._scratchVelocityError
        );
    }

    /**
     * Returns the current status for HUD display.
     * @returns {string} The status string.
     */
    getStatus() {
        if (this.subAutopilot?.active) {
            return `${this.getActionName()}: ${this.subAutopilot.getStatus()}`;
        }

        const threatName = this.threat?.name || (this.target instanceof Ship ? 'ship' : 'threat');
        const baseStatus = this.state ? `${this.getActionName()} ${threatName} (${this.state})` : `${this.getActionName()} ${threatName}`;
        return this.error ? `${baseStatus}, Error: ${this.error}` : baseStatus;
    }
}

