// autopilot.js
import { JumpGate } from './celestialBody.js';
import { remapClamp, normalizeAngle, randomBetween } from './utils.js';
import { Ship } from './ship.js';
import { Vector2D } from './vector2d.js';
import { Asteroid } from './asteroidBelt.js';
import { GameObject } from './gameObject.js';

/**
 * Base class for autopilot behaviors, providing a common interface for ship control automation.
 */
export class AutoPilot {
    /**
     * Creates a new AutoPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} [target=null] - The target object (e.g., planet, gate).
     */
    constructor(ship, target = null) {
        this.ship = ship;
        this.target = target;
        this.active = false;
        this.completed = false;
        this.error = null;
    }

    /**
     * Starts the autopilot, validating preconditions and setting it active.
     */
    start() {
        if (!this.ship) {
            this.error = "No ship assigned";
            return;
        }
        this.active = true;
        this.completed = false;
        this.error = null;
    }

    /**
     * Updates the autopilot's behavior each frame.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;
        // Subclasses override this
    }

    /**
     * Stops the autopilot, resetting ship controls and deactivating it.
     */
    stop() {
        this.active = false;
        this.ship.applyThrust(false);
        this.ship.applyBrakes(false);
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getStatus() {
        return "Autopilot: Idle";
    }

    /**
     * Checks if the autopilot has completed its task (success or failure).
     * @returns {boolean} True if completed or errored, false if still running.
     */
    isComplete() {
        return this.completed || !!this.error;
    }
}

/**
 * Autopilot that flies the ship to a target within the same system with precise velocity control.
 * @extends AutoPilot
 */
export class FlyToTargetAutoPilot extends AutoPilot {
    /**
     * Creates a new FlyToTargetAutoPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} target - The target to fly toward.
     * @param {number} [arrivalDistance=100] - Distance from target center to achieve arrivalSpeed in world units.
     * @param {number} [arrivalSpeed=Ship.LANDING_SPEED] - Target speed at arrivalDistance in world units per second.
     * @param {number} [closeApproachSpeed=30] - Speed at closeApproachDistance for smoother approach in world units per second.
     */
    constructor(ship, target, arrivalDistance = 100, arrivalSpeed = Ship.LANDING_SPEED, closeApproachSpeed = 30) {
        super(ship, target);
        this.arrivalDistance = arrivalDistance;
        this.arrivalSpeed = arrivalSpeed;
        this.closeApproachSpeed = closeApproachSpeed;
        this.farApproachDistance = 0;
        this.closeApproachDistance = 0;

        // Scratch vectors to eliminate all allocations in update
        this._scratchDirectionToTarget = new Vector2D(); // Direction from ship to target
        this._scratchTargetVelocity = new Vector2D(); // Desired velocity toward target
        this._scratchVelocityError = new Vector2D(); // Difference between desired and current velocity
        this._scratchLateralCorrection = new Vector2D(); // Correction for perpendicular velocity
        this._scratchVelocityPerpendicular = new Vector2D(); // Perpendicular component of current velocity
        this._scratchDesiredVelocity = new Vector2D(); // Final desired velocity after corrections
        this._scratchTemp = new Vector2D(); // Temporary vector for intermediate calculations
        this._scratchFuturePosition = new Vector2D(); // Predicted future position of the target
    }

    /**
     * Starts the autopilot, ensuring the target is in the same star system.
     */
    start() {
        super.start();
        if (!this.target || this.target.starSystem !== this.ship.starSystem) {
            this.error = "Target not in same system";
            this.active = false;
        }
    }

    /**
     * Updates the ship's trajectory to fly toward the target with velocity control.
     * If the target is moving, predicts its future position based on its velocity.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active || !this.target) return;

        // Calculate the target's current position
        let targetPosition = this.target.position;

        // If the target has a velocity (e.g., an asteroid or ship), predict its future position
        if (this.target.velocity && this.target.velocity instanceof Vector2D) {
            // Calculate direction and distance to the target's current position
            this._scratchDirectionToTarget.set(this.target.position)
                .subtractInPlace(this.ship.position);
            const distanceToTarget = this._scratchDirectionToTarget.magnitude();
            this._scratchDirectionToTarget.normalizeInPlace();

            // Estimate time to intercept based on distance and relative speed
            const relativeVelocity = this._scratchTemp.set(this.ship.velocity)
                .subtractInPlace(this.target.velocity)
                .dot(this._scratchDirectionToTarget);
            const closingSpeed = Math.max(this.ship.maxVelocity - relativeVelocity, 1);
            const timeToIntercept = distanceToTarget / closingSpeed;

            // Predict the target's future position
            this._scratchFuturePosition.set(this.target.velocity)
                .multiplyInPlace(timeToIntercept)
                .addInPlace(this.target.position);
            targetPosition = this._scratchFuturePosition;
        }

        // Calculate direction and distance to the (possibly predicted) target position
        this._scratchDirectionToTarget.set(targetPosition)
            .subtractInPlace(this.ship.position);
        const distanceToTargetCenter = this._scratchDirectionToTarget.magnitude();
        this._scratchDirectionToTarget.normalizeInPlace();
        const currentSpeed = this.ship.velocity.magnitude();

        // Velocity components
        const velocityTowardTarget = this.ship.velocity.dot(this._scratchDirectionToTarget);
        this._scratchTemp.set(this._scratchDirectionToTarget)
            .multiplyInPlace(velocityTowardTarget);
        this._scratchVelocityPerpendicular.set(this.ship.velocity)
            .subtractInPlace(this._scratchTemp);
        const lateralSpeed = this._scratchVelocityPerpendicular.magnitude();
        const decelerationDistance = currentSpeed > this.arrivalSpeed
            ? (currentSpeed * currentSpeed - this.arrivalSpeed * this.arrivalSpeed) / (2 * this.ship.thrust)
            : 0;

        // Check if close enough to complete
        if (distanceToTargetCenter <= this.arrivalDistance) {
            this.completed = true;
            this.stop();
            return;
        }

        // Calculate stopping parameters
        const timeToTurn = Math.PI / this.ship.rotationSpeed;
        const maxDecelerationDistance = (this.ship.maxVelocity * this.ship.maxVelocity - this.arrivalSpeed * this.arrivalSpeed) / (2 * this.ship.thrust);
        const maxDistanceWhileTurning = this.ship.maxVelocity * timeToTurn;
        this.farApproachDistance = maxDecelerationDistance + maxDistanceWhileTurning;
        this.closeApproachDistance = this.arrivalSpeed + this.arrivalDistance + (this.arrivalSpeed * timeToTurn);

        // Control logic
        let desiredAngle = this.ship.angle;
        let shouldThrust = false;

        if (distanceToTargetCenter > this.farApproachDistance) {
            const desiredSpeed = this.ship.maxVelocity;
            this._scratchTargetVelocity.set(this._scratchDirectionToTarget)
                .multiplyInPlace(desiredSpeed);
            this._scratchDesiredVelocity.set(this._scratchTargetVelocity);

            if (lateralSpeed > 5) {
                const lateralCorrectionFactor = Math.min(1, lateralSpeed / 10);
                this._scratchLateralCorrection.set(this._scratchVelocityPerpendicular)
                    .normalizeInPlace()
                    .multiplyInPlace(-lateralSpeed * lateralCorrectionFactor);
                this._scratchDesiredVelocity.addInPlace(this._scratchLateralCorrection)
                    .normalizeInPlace()
                    .multiplyInPlace(desiredSpeed);
            }

            this._scratchVelocityError.set(this._scratchDesiredVelocity)
                .subtractInPlace(this.ship.velocity);
            this.ship.velocityError.set(this._scratchVelocityError);
            const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 4;
            } else {
                desiredAngle = Math.atan2(this.ship.velocity.x, -this.ship.velocity.y);
            }
        } else if (distanceToTargetCenter > this.closeApproachDistance) {
            const distanceToClose = distanceToTargetCenter - this.closeApproachDistance;
            const stoppingDistance = decelerationDistance + ((currentSpeed - this.closeApproachSpeed) * timeToTurn);

            const angleToReverseVelocity = normalizeAngle(Math.atan2(-this.ship.velocity.x, this.ship.velocity.y) - this.ship.angle);
            const isFacingAway = Math.abs(angleToReverseVelocity) < Math.PI / 6;
            if (velocityTowardTarget > 0 && isFacingAway && decelerationDistance < (distanceToTargetCenter - this.arrivalDistance)) {
                this._scratchDesiredVelocity.set(this.ship.velocity);
                desiredAngle = Math.atan2(-this.ship.velocity.x, this.ship.velocity.y);
            } else if (stoppingDistance > distanceToClose && currentSpeed > this.closeApproachSpeed * 1.2) {
                this._scratchTargetVelocity.set(this.ship.velocity)
                    .normalizeInPlace()
                    .multiplyInPlace(-currentSpeed);
                this._scratchDesiredVelocity.set(this._scratchTargetVelocity);
                if (lateralSpeed > 5) {
                    const lateralCorrectionFactor = Math.min(1, lateralSpeed / 5);
                    this._scratchLateralCorrection.set(this._scratchVelocityPerpendicular)
                        .normalizeInPlace()
                        .multiplyInPlace(-lateralSpeed * lateralCorrectionFactor);
                    this._scratchDesiredVelocity.addInPlace(this._scratchLateralCorrection)
                        .normalizeInPlace()
                        .multiplyInPlace(currentSpeed);
                }
            } else {
                const desiredSpeed = Math.max(this.closeApproachSpeed, this.closeApproachSpeed + (distanceToClose / maxDecelerationDistance) * (this.ship.maxVelocity - this.closeApproachSpeed));
                this._scratchTargetVelocity.set(this._scratchDirectionToTarget)
                    .multiplyInPlace(desiredSpeed);
                this._scratchDesiredVelocity.set(this._scratchTargetVelocity);
                if (lateralSpeed > 5) {
                    const lateralCorrectionFactor = Math.min(1, lateralSpeed / 5);
                    this._scratchLateralCorrection.set(this._scratchVelocityPerpendicular)
                        .normalizeInPlace()
                        .multiplyInPlace(-lateralSpeed * lateralCorrectionFactor);
                    this._scratchDesiredVelocity.addInPlace(this._scratchLateralCorrection)
                        .normalizeInPlace()
                        .multiplyInPlace(desiredSpeed);
                }
            }

            this._scratchVelocityError.set(this._scratchDesiredVelocity)
                .subtractInPlace(this.ship.velocity);
            this.ship.velocityError.set(this._scratchVelocityError);
            const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 12 || velocityTowardTarget < -5;
            } else if (!shouldThrust) {
                desiredAngle = Math.atan2(-this.ship.velocity.x, this.ship.velocity.y);
            }
        } else {
            const finalSpeed = remapClamp(distanceToTargetCenter, 0, this.closeApproachDistance, this.arrivalSpeed, this.closeApproachSpeed);
            let desiredSpeed = finalSpeed;
            if (currentSpeed < finalSpeed * 0.5) {
                desiredSpeed = finalSpeed * 1.2;
            } else if (currentSpeed > finalSpeed * 1.2) {
                desiredSpeed = -currentSpeed;
            }
            this._scratchTargetVelocity.set(this._scratchDirectionToTarget)
                .multiplyInPlace(desiredSpeed);
            this._scratchDesiredVelocity.set(this._scratchTargetVelocity);
            if (lateralSpeed > 1) {
                const lateralCorrectionFactor = Math.min(1, lateralSpeed / 5);
                this._scratchLateralCorrection.set(this._scratchVelocityPerpendicular)
                    .normalizeInPlace()
                    .multiplyInPlace(-lateralSpeed * lateralCorrectionFactor);
                this._scratchDesiredVelocity.addInPlace(this._scratchLateralCorrection)
                    .normalizeInPlace()
                    .multiplyInPlace(desiredSpeed);
            }

            this._scratchVelocityError.set(this._scratchDesiredVelocity)
                .subtractInPlace(this.ship.velocity);
            this.ship.velocityError.set(this._scratchVelocityError);
            const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

            if (velocityErrorMagnitude > 1) {
                desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 12;
            } else {
                desiredAngle = Math.atan2(-this.ship.velocity.x, this.ship.velocity.y);
            }
        }

        this.ship.setTargetAngle(desiredAngle);
        this.ship.applyThrust(shouldThrust);
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string indicating the flight target.
     */
    getStatus() {
        return `Autopilot: Flying to ${this.target.name || 'target'}`;
    }
}

/**
 * Autopilot that flies to a planet and lands on it.
 * Chains FlyToTargetAutoPilot and handles landing initiation and completion.
 * @extends AutoPilot
 */
export class LandOnPlanetAutoPilot extends AutoPilot {
    /**
     * Creates a new LandOnPlanetAutoPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} planet - The planet to land on.
     */
    constructor(ship, planet) {
        super(ship, planet);
        this.subPilot = null;
        this._scratchDistanceToTarget = new Vector2D(); // Distance from ship to planet
        this._scratchTemp = new Vector2D();
    }

    /**
     * Starts the autopilot, ensuring the target is a planet in the same system.
     */
    start() {
        super.start();
        if (!(this.target && !(this.target instanceof JumpGate))) {
            this.error = "Target is not a planet";
            this.active = false;
            return;
        }
        if (this.target.starSystem !== this.ship.starSystem) {
            this.error = "Planet not in same system";
            this.active = false;
            return;
        }
        this.subPilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
        this.subPilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase, landing initiation, and waiting for landing completion.
     * Restarts the sub-pilot if the ship overshoots and can't land yet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;

        if (this.subPilot && this.subPilot.active) {
            // Fly to the planet using sub-autopilot
            this.subPilot.update(deltaTime);
            if (this.subPilot.isComplete()) {
                if (this.subPilot.error) {
                    this.error = this.subPilot.error;
                    this.stop();
                    return;
                }
                this.subPilot = null;
            }
        } else if (this.ship.state === 'Flying') {
            // Sub-pilot is done or never started; check if we can land
            this._scratchDistanceToTarget.set(this.ship.position)
                .subtractInPlace(this.target.position);
            const distanceToPlanetCenter = this._scratchDistanceToTarget.magnitude();
            if (distanceToPlanetCenter <= this.target.radius) {
                if (this.ship.canLand(this.target)) {
                    this.ship.initiateLanding(this.target);
                } else {
                    //Hack to slow ships down if they have slow turning rate, need a better fix for this.
                    this.ship.velocity.multiplyInPlace(1 - (0.5 * deltaTime));
                    this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDistanceToTarget).multiplyInPlace(-0.5 * deltaTime));
                    // Slow down if not ready to land (e.g., speed too high)
                    this.ship.velocityError.set(-this.ship.velocity.x, -this.ship.velocity.y);
                    const desiredAngle = Math.atan2(this.ship.velocityError.x, -this.ship.velocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12);

                }
            } else {
                // Overshot the target; restart the sub-pilot to fly back
                if (this.ship.debug) {
                    console.log(`Overshot ${this.target.name || 'target'}; restarting fly-to phase`);
                }
                this.subPilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
                this.subPilot.start();
            }
        } else if (this.ship.state === 'Landing') {
            // Do nothing; ship is handling its own animation
        } else if (this.ship.state === 'Landed') {
            // Landing complete; mark autopilot as done
            this.completed = true;
            this.stop();
        } else {
            // Unexpected ship state (e.g., TakingOff, JumpingOut)
            this.error = `Unexpected ship state during landing: ${this.ship.state}`;
            this.stop();
        }
    }

    /**
     * Stops the autopilot, including any sub-autopilot.
     */
    stop() {
        if (this.subPilot) this.subPilot.stop();
        super.stop();
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string indicating landing or sub-autopilot state.
     */
    getStatus() {
        if (this.subPilot && this.subPilot.active) {
            return this.subPilot.getStatus();
        } else if (this.ship.state === 'Landing') {
            return `Autopilot: Landing on ${this.target.name || 'planet'} (Animating)`;
        }
        return `Autopilot: Landing on ${this.target.name || 'planet'}`;
    }
}

/**
 * Autopilot that flies to a jump gate and traverses it, waiting for the full jump animation to complete.
 * Chains FlyToTargetAutoPilot and handles hyperjump initiation and completion.
 * @extends AutoPilot
 */
export class TraverseJumpGateAutoPilot extends AutoPilot {
    /**
     * Creates a new TraverseJumpGateAutoPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {JumpGate} gate - The jump gate to traverse.
     */
    constructor(ship, gate) {
        super(ship, gate);
        this.subPilot = null;
        this._scratchDistanceToTarget = new Vector2D(); // Distance from ship to gate
        this._scratchTemp = new Vector2D();
    }

    /**
     * Starts the autopilot, ensuring the target is a jump gate in the same system.
     */
    start() {
        super.start();
        if (!(this.target instanceof JumpGate)) {
            this.error = "Target is not a jump gate";
            this.active = false;
            return;
        }
        if (this.target.starSystem !== this.ship.starSystem) {
            this.error = "Jump gate not in same system";
            this.active = false;
            return;
        }
        // Fly to the gate's position with a small arrival distance
        this.subPilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
        this.subPilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase, hyperjump initiation, and waiting for jump completion.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;

        if (this.subPilot && this.subPilot.active) {
            // Fly to the jump gate using sub-autopilot
            this.subPilot.update(deltaTime);
            if (this.subPilot.isComplete()) {
                if (this.subPilot.error) {
                    this.error = this.subPilot.error;
                    this.stop();
                    return;
                }
                this.subPilot = null; // Sub-pilot done; proceed to jumping
            }
        } else if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.lane.target) {
            // Jump complete; ship is flying in the target system
            this.completed = true;
            this.stop();
        } else if (this.ship.state === 'Flying') {
            // Ship is flying in the original system; try to initiate hyperjump
            this._scratchDistanceToTarget.set(this.ship.position)
                .subtractInPlace(this.target.position);
            //const distanceToGate = this._scratchDistanceToTarget.magnitude();
            if (this.target.overlapsShip(this.ship.position)) {
                if (this.ship.initiateHyperjump()) {
                    // Hyperjump started successfully
                } else {
                    //Hack to slow ships down if they have slow turning rate, need a better fix for this.
                    this.ship.velocity.multiplyInPlace(1 - (0.5 * deltaTime));
                    this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDistanceToTarget).multiplyInPlace(-0.5 * deltaTime));
                    // Hyperdrive not ready or gate not found; slow down and wait
                    this.ship.velocityError.set(-this.ship.velocity.x, -this.ship.velocity.y);
                    const desiredAngle = Math.atan2(this.ship.velocityError.x, -this.ship.velocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12);
                }
            } else {
                // Not close enough or not overlapping; restart sub-pilot to approach again
                if (this.ship.debug) {
                    console.log(`Not aligned with ${this.target.name || 'jump gate'}; restarting fly-to phase`);
                }
                this.subPilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
                this.subPilot.start();
            }
        } else if (this.ship.state === 'JumpingOut' || this.ship.state === 'JumpingIn') {
            // Do nothing; ship is handling its own animation
        } else {
            // Unexpected ship state (e.g., Landed, TakingOff)
            this.error = `Unexpected ship state during jump: ${this.ship.state}`;
            this.stop();
        }
    }

    /**
     * Stops the autopilot, including any sub-autopilot.
     */
    stop() {
        if (this.subPilot) this.subPilot.stop();
        super.stop();
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string indicating jump progress.
     */
    getStatus() {
        if (this.subPilot && this.subPilot.active) {
            return this.subPilot.getStatus();
        } else if (this.ship.state === 'JumpingOut') {
            return `Autopilot: Jumping out to ${this.target.lane.target.name || 'system'} (Animating)`;
        } else if (this.ship.state === 'JumpingIn') {
            return `Autopilot: Jumping in to ${this.target.lane.target.name || 'system'} (Animating)`;
        }
        return `Autopilot: Traversing ${this.target.name || 'jump gate'}`;
    }
}

/**
 * Autopilot that follows a moving ship, projecting its future position and matching its velocity once within a radius.
 * @extends AutoPilot
 */
export class FollowShipAutoPilot extends AutoPilot {
    /**
     * Creates a new FollowShipAutoPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} target - The target ship or object to follow.
     * @param {number} followRadius - The radius within which to fully match the target's velocity.
     * @param {number} [approachSpeed=100] - Speed to approach the target when outside the approach distance.
     */
    constructor(ship, target, followRadius, approachSpeed = 100) {
        super(ship, target);
        this.followRadius = followRadius;
        this.approachSpeed = approachSpeed;

        // Distance zones for gradual velocity matching
        this.farApproachDistance = 0; // Computed dynamically
        this.closeApproachDistance = followRadius * 2; // Start velocity matching at 2x follow radius

        // Scratch vectors to eliminate allocations in update
        this._scratchDirectionToTarget = new Vector2D();
        this._scratchFuturePosition = new Vector2D();
        this._scratchVelocityError = new Vector2D();
        this._scratchDesiredVelocity = new Vector2D();
        this._scratchTemp = new Vector2D();
        this._scratchTargetVelocity = new Vector2D();
    }

    /**
     * Starts the autopilot, ensuring the target is a ship in the same star system.
     */
    start() {
        super.start();
        if (!(this.target instanceof GameObject)) {
            this.error = "Target is not a Game Object";
            this.active = false;
        }
        if (this.target.starSystem !== this.ship.starSystem) {
            this.error = "Target not in same system";
            this.active = false;
        }

        // Calculate far approach distance based on ship's max velocity and thrust
        const timeToTurn = Math.PI / this.ship.rotationSpeed;
        const maxDecelerationDistance = (this.ship.maxVelocity * this.ship.maxVelocity - this.approachSpeed * this.approachSpeed) / (2 * this.ship.thrust);
        const maxDistanceWhileTurning = this.ship.maxVelocity * timeToTurn;
        this.farApproachDistance = maxDecelerationDistance + maxDistanceWhileTurning;
    }

    /**
     * Updates the ship's trajectory to follow the target ship, projecting its future position
     * and gradually matching velocity as it approaches.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active || !this.target || this.target.isDespawned()) {
            this.stop();
            return;
        }

        // Calculate current distance to target
        this._scratchDirectionToTarget.set(this.target.position)
            .subtractInPlace(this.ship.position);
        const distanceToTarget = this._scratchDirectionToTarget.magnitude();
        this._scratchDirectionToTarget.normalizeInPlace();

        // Estimate time to intercept based on distance and relative speed
        const relativeVelocity = this._scratchTemp.set(this.ship.velocity)
            .subtractInPlace(this.target.velocity)
            .dot(this._scratchDirectionToTarget);
        const closingSpeed = Math.max(this.ship.maxVelocity - relativeVelocity, 1);
        const timeToIntercept = distanceToTarget / closingSpeed;

        // Project target's future position
        this._scratchFuturePosition.set(this.target.velocity)
            .multiplyInPlace(timeToIntercept)
            .addInPlace(this.target.position);

        // Recalculate direction and distance to the future position
        this._scratchDirectionToTarget.set(this._scratchFuturePosition)
            .subtractInPlace(this.ship.position);
        //const distanceToFuture = this._scratchDirectionToTarget.magnitude();
        this._scratchDirectionToTarget.normalizeInPlace();

        let desiredAngle = this.ship.angle;
        let shouldThrust = false;

        if (distanceToTarget > this.farApproachDistance) {
            // Far distance: fly at full speed toward the future position
            const desiredSpeed = this.ship.maxVelocity;
            this._scratchDesiredVelocity.set(this._scratchDirectionToTarget)
                .multiplyInPlace(desiredSpeed);

            this._scratchVelocityError.set(this._scratchDesiredVelocity)
                .subtractInPlace(this.ship.velocity);
            this.ship.velocityError.set(this._scratchVelocityError);
            const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 4;
            } else {
                if (this.target instanceof Ship) {
                    if (this.target.isThrusting) {
                        desiredAngle = this.ship.angle; // Maintain current heading
                    } else {
                        desiredAngle = this.target.angle; // Align with target's heading
                    }
                } else if (this.target instanceof Asteroid) {
                    desiredAngle = this.target.orbitAngle + Math.PI * 0.5;
                } else {
                    desiredAngle = this.ship.angle;
                }
            }
        } else if (distanceToTarget > this.followRadius) {
            if (this.ship.debug) {
                console.log("distanceToTarget > this.followRadius");
            }
            // Approach distance: gradually match the target's velocity
            const distanceRange = this.closeApproachDistance - this.followRadius;
            const distanceProgress = (distanceToTarget - this.followRadius) / distanceRange; // 1 at closeApproachDistance, 0 at followRadius
            const speedFactor = remapClamp(distanceProgress, 0, 1, 0, 1); // 0 to 1

            // Interpolate desired velocity between approach speed and target's velocity
            const approachVelocity = this._scratchTemp.set(this._scratchDirectionToTarget)
                .multiplyInPlace(this.approachSpeed);
            this._scratchTargetVelocity.set(this.target.velocity);
            this._scratchDesiredVelocity.set(this._scratchTargetVelocity)
                .multiplyInPlace(1 - speedFactor)
                .addInPlace(approachVelocity.multiplyInPlace(speedFactor));

            this._scratchVelocityError.set(this._scratchDesiredVelocity)
                .subtractInPlace(this.ship.velocity);
            this.ship.velocityError.set(this._scratchVelocityError);
            const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 12;
            } else {
                if (this.target instanceof Ship) {
                    if (this.target.isThrusting) {
                        desiredAngle = this.ship.angle; // Maintain current heading
                    } else {
                        desiredAngle = this.target.angle; // Align with target's heading
                    }
                } else if (this.target instanceof Asteroid) {
                    desiredAngle = this.target.orbitAngle + Math.PI * 0.5;
                } else {
                    desiredAngle = this.ship.angle;
                }
            }
        } else {
            if (this.ship.debug) {
                console.log("Inside follow radiuss");
            }
            // Inside follow radius: fully match the target's velocity
            this._scratchDesiredVelocity.set(this.target.velocity);
            this._scratchVelocityError.set(this._scratchDesiredVelocity)
                .subtractInPlace(this.ship.velocity);
            this.ship.velocityError.set(this._scratchVelocityError);
            const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 12;
            } else {
                if (this.target instanceof Ship) {
                    if (this.target.isThrusting) {
                        desiredAngle = this.ship.angle; // Maintain current heading
                    } else {
                        desiredAngle = this.target.angle; // Align with target's heading
                    }
                } else if (this.target instanceof Asteroid) {
                    desiredAngle = this.target.orbitAngle + Math.PI * 0.5;
                } else {
                    desiredAngle = this.ship.angle;
                }
            }
        }

        this.ship.setTargetAngle(desiredAngle);
        this.ship.applyThrust(shouldThrust);
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string indicating the follow target.
     */
    getStatus() {
        return `Autopilot: Following ${this.target.name || 'ship'}`;
    }
}

/**
 * Autopilot that escorts a designated ship, following it, taking off and landing in sync,
 * and jumping through gates to stay in the same system.
 * @extends AutoPilot
 */
export class EscortAutoPilot extends AutoPilot {
    /**
     * Creates a new EscortAutoPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} escortedShip - The ship to escort.
     * @param {number} [followDistance=250] - The distance to maintain while following.
     */
    constructor(ship, escortedShip, followDistance = 250) {
        super(ship, escortedShip);
        this.followDistance = followDistance;
        this.state = 'Idle';
        this.waitTime = 0;
        this.subAutopilot = null;

        // Scratch vectors to eliminate allocations in update
        this._scratchDirectionToTarget = new Vector2D();
        this._scratchDistanceToTarget = new Vector2D();

        // Constants for behavior tuning
        this.waitTimeMin = 2; // Minimum wait time after landing (seconds)
        this.waitTimeMax = 5; // Maximum wait time after landing (seconds)

        // State handlers for the autopilot's behavior
        this.stateHandlers = {
            'Idle': this.updateIdle.bind(this),
            'Following': this.updateFollowing.bind(this),
            'TakingOff': this.updateTakingOff.bind(this),
            'Landing': this.updateLanding.bind(this),
            'TraversingJumpGate': this.updateTraversingJumpGate.bind(this),
            'Waiting': this.updateWaiting.bind(this)
        };
    }

    /**
     * Finds a jump gate in the current system that leads to the target system.
     * @param {StarSystem} targetSystem - The system to jump to.
     * @returns {JumpGate|null} The jump gate leading to the target system, or null if none found.
     */
    findJumpGateToSystem(targetSystem) {
        const gates = this.ship.starSystem.celestialBodies.filter(body => body instanceof JumpGate && !body.isDespawned());
        for (let i = 0; i < gates.length; i++) {
            const gate = gates[i];
            if (gate.lane && gate.lane.target === targetSystem) {
                return gate;
            }
        }
        return null;
    }

    /**
     * Starts the autopilot, ensuring the target is a ship in the same star system.
     */
    start() {
        super.start();
        if (!(this.target instanceof Ship)) {
            this.error = "Target is not a ship";
            this.active = false;
        }
        if (this.target.starSystem !== this.ship.starSystem) {
            this.error = "Target ship not in same system";
            this.active = false;
        }
    }

    /**
     * Updates the autopilot's behavior based on the current state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;

        // Check if the escorted ship has despawned
        if (!this.target || this.target.isDespawned()) {
            this.stop();
            this.error = "Escorted ship despawned";
            return;
        }

        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime);
        } else {
            console.warn(`No handler for state: ${this.state}`);
            this.state = 'Idle';
        }
    }

    /**
     * Handles the Idle state: starts following the escorted ship.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateIdle(deltaTime) {
        if (this.ship.state === 'Landed') {
            // If the escorted ship is taking off or flying, take off
            if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
                this._scratchDirectionToTarget.set(this.target.position)
                    .subtractInPlace(this.ship.position);
                this.ship.setTargetAngle(Math.atan2(this._scratchDirectionToTarget.x, -this._scratchDirectionToTarget.y));
                this.ship.initiateTakeoff();
                this.state = 'TakingOff';
            }
        } else if (this.ship.state === 'Flying') {
            // Start following the escorted ship
            this.subAutopilot = new FollowShipAutoPilot(this.ship, this.target, this.followDistance, 100);
            this.subAutopilot.start();
            this.state = 'Following';
        } else {
            console.warn(`Invalid ship state '${this.ship.state}' in EscortAutoPilot updateIdle`);
        }
    }

    /**
       * Handles the Following state: follows the escorted ship and reacts to its actions.
       * @param {number} deltaTime - Time elapsed since the last update in seconds.
       */
    updateFollowing(deltaTime) {
        if (!this.subAutopilot) {
            console.warn('Sub-autopilot is not set during Following state');
            this.state = 'Idle';
            return;
        }

        // Check if the escorted ship has started a jump (JumpingOut state)
        if (this.target.state === 'JumpingOut') {
            this.subAutopilot.stop();
            const jumpGate = this.target.jumpGate; // Get the jump gate directly from the escorted ship

            if (jumpGate && jumpGate instanceof JumpGate && !jumpGate.isDespawned()) {
                this.subAutopilot = new TraverseJumpGateAutoPilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = 'TraversingJumpGate';
            } else {
                console.warn('Jump gate not found or invalid for escorted ship during jump; waiting');
                this.subAutopilot = null;
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
            }
            return;
        }

        // Check if the escorted ship has landed
        if (this.target.state === 'Landed' || this.target.state === 'Landing') {
            this.subAutopilot.stop();
            this.subAutopilot = new LandOnPlanetAutoPilot(this.ship, this.target.landedPlanet);
            this.subAutopilot.start();
            this.state = 'Landing';
            return;
        }

        // Check if the escorted ship has jumped to another system
        if (this.target.starSystem !== this.ship.starSystem) {
            this.subAutopilot.stop();
            const targetSystem = this.target.starSystem;
            const jumpGate = this.findJumpGateToSystem(targetSystem);
            if (jumpGate) {
                this.subAutopilot = new TraverseJumpGateAutoPilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = 'TraversingJumpGate';
            } else {
                console.warn('No jump gate found to follow escorted ship; waiting');
                this.subAutopilot = null;
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
            }
            return;
        }

        // Continue following
        this.subAutopilot.update(deltaTime);

        if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot is inactive during Following state; restarting');
            this.subAutopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the TakingOff state: waits for the ship to finish taking off.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateTakingOff(deltaTime) {
        if (this.ship.state === 'Flying') {
            this.state = 'Idle';
        }
    }

    /**
     * Handles the Landing state: lands on the same body as the escorted ship.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    /**
 * Handles the Landing state: lands on the same body as the escorted ship.
 * Aborts landing if the escorted ship takes off.
 * @param {number} deltaTime - Time elapsed since the last update in seconds.
 */
    updateLanding(deltaTime) {
        if (!this.subAutopilot) {
            console.warn('Sub-autopilot is not set during Landing state');
            this.state = 'Idle';
            return;
        }

        // Check if the escorted ship has taken off
        if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
            this.subAutopilot.stop();
            this.subAutopilot = null;
            this._scratchDirectionToTarget.set(this.target.position)
                .subtractInPlace(this.ship.position);
            this.ship.setTargetAngle(Math.atan2(this._scratchDirectionToTarget.x, -this._scratchDirectionToTarget.y));
            this.ship.initiateTakeoff();
            this.state = 'TakingOff';
            return;
        }

        this.subAutopilot.update(deltaTime);

        if (this.subAutopilot.isComplete()) {
            if (this.subAutopilot.error) {
                console.warn(`Sub-autopilot failed: ${this.subAutopilot.error}`);
                this.subAutopilot = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Landed') {
                    this.subAutopilot = null;
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = 'Waiting';
                } else {
                    console.warn('Sub-autopilot completed but ship is not landed; resetting');
                    this.subAutopilot = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot is inactive but not complete during Landing state');
            this.subAutopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the TraversingJumpGate state: jumps to the system where the escorted ship is.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateTraversingJumpGate(deltaTime) {
        if (!this.subAutopilot) {
            console.warn('Sub-autopilot is not set during TraversingJumpGate state');
            this.state = 'Idle';
            return;
        }

        this.subAutopilot.update(deltaTime);

        if (this.subAutopilot.isComplete()) {
            if (this.subAutopilot.error) {
                console.warn(`Sub-autopilot failed: ${this.subAutopilot.error}`);
                this.subAutopilot = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.starSystem) {
                    this.subAutopilot = null;
                    this.state = 'Idle'; // Will transition to Following in the next update
                } else {
                    console.warn('Sub-autopilot completed but jump not finished; resetting');
                    this.subAutopilot = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot is inactive but not complete during TraversingJumpGate state');
            this.subAutopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the Waiting state: waits after landing, then checks if the escorted ship is still landed.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateWaiting(deltaTime) {
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            this.state = 'Idle'; // Will check escorted ship's state and take off if necessary
        }
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getStatus() {
        if (this.state === 'Following' && this.subAutopilot?.active) {
            return `Autopilot: Escorting ${this.target.name || 'ship'}`;
        } else if (this.state === 'Landing' && this.subAutopilot?.active) {
            return `Autopilot: Landing on ${this.target.landedOn?.name || 'body'}`;
        } else if (this.state === 'TraversingJumpGate' && this.subAutopilot?.active) {
            return `Autopilot: Jumping to ${this.target.starSystem?.name || 'system'}`;
        } else if (this.state === 'Waiting') {
            return `Autopilot: Waiting`;
        }
        return `Autopilot: Escorting (${this.state})`;
    }
}

/**
 * Autopilot that flies to an asteroid and lands on it to mine.
 * Chains ApproachTargetAutoPilot and handles mining initiation and completion.
 * @extends AutoPilot
 */
export class LandOnAsteroidAutoPilot extends AutoPilot {
    /**
     * Creates a new LandOnAsteroidAutoPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Asteroid} asteroid - The asteroid to land on and mine.
     */
    constructor(ship, asteroid) {
        super(ship, asteroid);
        this.subPilot = null;
        this._scratchDistanceToTarget = new Vector2D(); // Distance from ship to asteroid
        this._scratchTemp = new Vector2D();
    }

    /**
     * Starts the autopilot, ensuring the target is an asteroid in the same system.
     */
    start() {
        super.start();
        if (!(this.target instanceof Asteroid)) {
            this.error = "Target is not an asteroid";
            this.active = false;
            return;
        }
        if (this.target.starSystem !== this.ship.starSystem) {
            this.error = "Asteroid not in same system";
            this.active = false;
            return;
        }
        this.subPilot = new ApproachTargetAutoPilot(
            this.ship,
            this.target,
            this.target.radius + 50,  // finalRadius
            Ship.LANDING_SPEED,                        // arrivalSpeedMin
            Ship.LANDING_SPEED * 2,                       // arrivalSpeedMax
            2,                        // velocityTolerance
            Math.PI / 6,              // thrustAngleLimit
            Ship.LANDING_SPEED,       // upperVelocityErrorThreshold
            2,                        // lowerVelocityErrorThreshold
            2                        // maxTimeToIntercept
        );
        this.subPilot.start();
    }

    /**
     * Updates the autopilot, managing the approach phase, mining initiation, and waiting for mining completion.
     * Restarts the sub-pilot if the ship overshoots and can't mine yet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;

        if (this.subPilot && this.subPilot.active) {
            // Approach the asteroid using sub-autopilot
            this.subPilot.update(deltaTime);
            if (this.subPilot.isComplete()) {
                if (this.subPilot.error) {
                    this.error = this.subPilot.error;
                    this.stop();
                    return;
                }
                this.subPilot = null;
            }
        } else if (this.ship.state === 'Flying') {
            // Sub-pilot is done or never started; check if we can mine
            this._scratchDistanceToTarget.set(this.ship.position)
                .subtractInPlace(this.target.position);
            const distanceToAsteroidCenter = this._scratchDistanceToTarget.magnitude();
            if (distanceToAsteroidCenter <= this.target.radius + 50) {
                if (this.ship.canMine(this.target)) {
                    this.ship.initiateMining(this.target);
                } else {
                    // Slow down if not ready to mine (e.g., speed too high)
                    this.ship.velocity.multiplyInPlace(1 - (0.5 * deltaTime));
                    this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDistanceToTarget).multiplyInPlace(-0.5 * deltaTime));
                    this.ship.velocityError.set(-this.ship.velocity.x, -this.ship.velocity.y);
                    const desiredAngle = Math.atan2(this.ship.velocityError.x, -this.ship.velocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12);
                }
            } else {
                // Overshot the target; restart the sub-pilot to approach again
                if (this.ship.debug) {
                    console.log(`Overshot ${this.target.name || 'asteroid'}; restarting approach phase`);
                }
                this.subPilot = new ApproachTargetAutoPilot(
                    this.ship,
                    this.target,
                    this.target.radius + 50,  // finalRadius
                    Ship.LANDING_SPEED,                        // arrivalSpeedMin
                    Ship.LANDING_SPEED * 2,                       // arrivalSpeedMax
                    2,                        // velocityTolerance
                    Math.PI / 6,              // thrustAngleLimit
                    Ship.LANDING_SPEED,       // upperVelocityErrorThreshold
                    2,                        // lowerVelocityErrorThreshold
                    2                        // maxTimeToIntercept
                );
                this.subPilot.start();
            }
        } else if (this.ship.state === 'MiningLanding') {
            // Do nothing; ship is handling its own animation
        } else if (this.ship.state === 'Mining') {
            // Mining initiated successfully; mark autopilot as done
            this.completed = true;
            this.stop();
        } else {
            // Unexpected ship state (e.g., TakingOff, JumpingOut)
            this.error = `Unexpected ship state during mining: ${this.ship.state}`;
            this.stop();
        }
    }

    /**
     * Stops the autopilot, including any sub-autopilot.
     */
    stop() {
        if (this.subPilot) this.subPilot.stop();
        super.stop();
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string indicating mining or sub-autopilot state.
     */
    getStatus() {
        if (this.subPilot && this.subPilot.active) {
            return this.subPilot.getStatus();
        } else if (this.ship.state === 'MiningLanding') {
            return `Autopilot: Landing on ${this.target.name || 'asteroid'} (Animating)`;
        }
        return `Autopilot: Mining ${this.target.name || 'asteroid'}`;
    }
}

/**
 * Autopilot that approaches a target (static or moving), matches its velocity as best as possible,
 * and settles within a specified final radius. Ensures the ship moves toward the target's origin.
 * @extends AutoPilot
 */
export class ApproachTargetAutoPilot {
    constructor(ship, target, finalRadius, arrivalSpeedMin, arrivalSpeedMax, velocityTolerance, thrustAngleLimit, upperVelocityErrorThreshold, lowerVelocityErrorThreshold, maxTimeToIntercept) {
        this.ship = ship;
        this.target = target;
        this.finalRadius = finalRadius;
        this.arrivalSpeedMin = arrivalSpeedMin;
        this.arrivalSpeedMax = arrivalSpeedMax;
        this.velocityTolerance = velocityTolerance;
        this.thrustAngleLimit = thrustAngleLimit;
        this.upperVelocityErrorThreshold = upperVelocityErrorThreshold;
        this.lowerVelocityErrorThreshold = lowerVelocityErrorThreshold;
        this.maxTimeToIntercept = maxTimeToIntercept;

        this.active = false;
        this.completed = false;
        this.error = null;
        this.farApproachDistance = 0;
        this.midApproachDistance = 0;

        // Scratch vectors for in-place calculations
        this._scratchFuturePosition = new Vector2D();
        this._scratchDirectionToTarget = new Vector2D();
        this._scratchDesiredVelocity = new Vector2D();
        this._scratchTemp = new Vector2D();
        this._scratchVelocityDifference = new Vector2D();
        this._scratchVelocityError = new Vector2D();
    }

    start() {
        if (!this.target || !this.target.position) {
            this.error = "No valid target specified";
            this.completed = true;
            return;
        }
        const timeToTurn = Math.PI / this.ship.rotationSpeed;
        const decelerationDistance = (this.ship.maxVelocity ** 2 - this.arrivalSpeedMax ** 2) / (2 * this.ship.thrust);
        this.farApproachDistance = decelerationDistance + (this.ship.maxVelocity * timeToTurn);
        this.midApproachDistance = this.finalRadius + this.arrivalSpeedMax * 10;
        this.active = true;
        this.completed = false;
        this.error = null;
    }

    stop() {
        this.active = false;
        this.ship.applyThrust(false);
    }

    update(deltaTime) {
        if (!this.active || !this.target || !this.target.position) {
            this.stop();
            this.error = "Target lost or invalid";
            this.completed = true;
            return;
        }

        // Calculate distance to target
        this._scratchDirectionToTarget.set(this.target.position)
            .subtractInPlace(this.ship.position);
        const distanceToTarget = this._scratchDirectionToTarget.magnitude();
        this._scratchDirectionToTarget.normalizeInPlace();

        // Get target velocity (default to zero if not present)
        const targetVelocity = this.target.velocity || this._scratchTemp.set(0, 0);

        // Calculate relative velocity toward target
        this._scratchVelocityDifference.set(this.ship.velocity)
            .subtractInPlace(targetVelocity);
        const relativeSpeedTowardTarget = this._scratchVelocityDifference.dot(this._scratchDirectionToTarget);

        // Determine target position (predicted or current)
        let targetPosition;
        if (distanceToTarget > this.midApproachDistance) {
            const closingSpeed = Math.max(relativeSpeedTowardTarget, 0.1);
            const timeToIntercept = Math.min(distanceToTarget / closingSpeed, this.maxTimeToIntercept);
            this._scratchFuturePosition.set(targetVelocity)
                .multiplyInPlace(timeToIntercept)
                .addInPlace(this.target.position);
            targetPosition = this._scratchFuturePosition;
        } else {
            targetPosition = this.target.position;
        }

        // Update direction to target based on selected position
        this._scratchDirectionToTarget.set(targetPosition)
            .subtractInPlace(this.ship.position)
            .normalizeInPlace();

        // Velocity blending based on distance zones
        if (distanceToTarget > this.farApproachDistance) {
            this._scratchDesiredVelocity.set(this._scratchDirectionToTarget)
                .multiplyInPlace(this.ship.maxVelocity);
        } else if (distanceToTarget > this.midApproachDistance) {
            const speed = remapClamp(distanceToTarget, this.midApproachDistance, this.farApproachDistance, this.arrivalSpeedMax * 10, this.ship.maxVelocity);
            this._scratchDesiredVelocity.set(this._scratchDirectionToTarget)
                .multiplyInPlace(speed);
        } else if (distanceToTarget > this.finalRadius) {
            const approachSpeed = remapClamp(distanceToTarget, this.finalRadius, this.midApproachDistance, this.arrivalSpeedMin, this.arrivalSpeedMax);
            this._scratchTemp.set(this._scratchDirectionToTarget)
                .multiplyInPlace(approachSpeed);
            this._scratchDesiredVelocity.set(targetVelocity)
                .addInPlace(this._scratchTemp);
        } else {
            this._scratchTemp.set(this._scratchDirectionToTarget)
                .multiplyInPlace(this.arrivalSpeedMin);
            this._scratchDesiredVelocity.set(targetVelocity)
                .addInPlace(this._scratchTemp);
        }

        // Calculate velocity error
        this._scratchVelocityError.set(this._scratchDesiredVelocity)
            .subtractInPlace(this.ship.velocity);
        this.ship.velocityError.set(this._scratchVelocityError);
        const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

        // Thrust and angle control with hysteresis
        const desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
        const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
        const isAngleWithinLimit = Math.abs(angleToDesired) < this.thrustAngleLimit;

        let shouldThrust = false;
        if (isAngleWithinLimit && (
            velocityErrorMagnitude > this.upperVelocityErrorThreshold ||
            (velocityErrorMagnitude > this.lowerVelocityErrorThreshold && this.ship.isThrusting)
        )) {
            shouldThrust = true;
        }

        this.ship.setTargetAngle(this.ship.angle + angleToDesired);
        this.ship.applyThrust(shouldThrust);

        // Check completion condition
        if (distanceToTarget <= this.finalRadius) {
            const speedDifference = this._scratchVelocityDifference.magnitude();
            if (relativeSpeedTowardTarget > 0 && relativeSpeedTowardTarget < this.arrivalSpeedMin && speedDifference < this.arrivalSpeedMax) {
                this.completed = true;
                this.stop();
            }
            // Small adjustment to move towards the center when close
            this.ship.velocity.addInPlace(this._scratchTemp.set(this._scratchVelocityDifference).multiplyInPlace(0.1 * deltaTime));
            this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDirectionToTarget).multiplyInPlace(0.1 * deltaTime));
        }
    }

    isComplete() {
        return this.completed;
    }

    getStatus() {
        return `Approach Autopilot: ${this.completed ? 'Completed' : 'Active'}`;
    }
}