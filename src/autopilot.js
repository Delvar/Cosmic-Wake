// autopilot.js

import { JumpGate } from './celestialBody.js';
import { remapClamp } from './utils.js';
import { Ship } from './ship.js';

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
 * Reimplements AIPilot's distance-based flying logic with configurable speeds.
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
        this.velocityError = null;
        this.farApproachDistance = 0;
        this.closeApproachDistance = 0;
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
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active || !this.target) return;

        // Reused from AIPilot: Normalize angle difference
        const normalizeAngleDiff = (angleDiff) => {
            return ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;
        };

        // Calculate direction and distance to target
        const directionToPlanet = this.target.position.subtract(this.ship.position);
        const distanceToPlanetCenter = directionToPlanet.magnitude();
        directionToPlanet.normalizeInPlace(); // Reuse directionToPlanet as normalized vector
        const currentSpeed = this.ship.velocity.magnitude();

        // Velocity components
        const velocityTowardPlanet = this.ship.velocity.dot(directionToPlanet);
        const velocityPerpendicular = this.ship.velocity.subtract(directionToPlanet.multiply(velocityTowardPlanet));
        const lateralSpeed = velocityPerpendicular.magnitude();
        const decelerationDistance = currentSpeed > this.arrivalSpeed
            ? (currentSpeed * currentSpeed - this.arrivalSpeed * this.arrivalSpeed) / (2 * this.ship.thrust)
            : 0;

        // Check if close enough to complete
        if (distanceToPlanetCenter <= this.arrivalDistance && currentSpeed <= this.arrivalSpeed) {
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
        let state = ''; // Optional for status

        if (distanceToPlanetCenter > this.farApproachDistance) {
            state = 'Far Away: ';
            const desiredSpeed = this.ship.maxVelocity;
            const targetVelocity = directionToPlanet.multiply(desiredSpeed); // Still one allocation here
            let desiredVelocity = targetVelocity;
            if (lateralSpeed > 5) {
                state += 'lateralSpeed > 5 ';
                const lateralCorrectionFactor = Math.min(1, lateralSpeed / 10);
                const lateralCorrection = velocityPerpendicular.normalize().multiply(-lateralSpeed * lateralCorrectionFactor);
                desiredVelocity = targetVelocity.add(lateralCorrection); // Another allocation
                desiredVelocity.normalizeInPlace().multiplyInPlace(desiredSpeed);
            }

            const velocityError = desiredVelocity.subtract(this.ship.velocity);
            this.velocityError = velocityError.clone(); // Keep for debugging, could be optimized out
            const velocityErrorMagnitude = velocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                state += 'velocityErrorMagnitude > 5 ';
                desiredAngle = Math.atan2(velocityError.y, velocityError.x);
                const angleToDesired = normalizeAngleDiff(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 4;
                state += shouldThrust ? 'Thrusting' : 'Turning';
            } else {
                desiredAngle = Math.atan2(this.ship.velocity.y, this.ship.velocity.x);
                state += 'Coasting';
            }
        } else if (distanceToPlanetCenter > this.closeApproachDistance) {
            state = 'Approach: ';
            const distanceToClose = distanceToPlanetCenter - this.closeApproachDistance;
            const stoppingDistance = decelerationDistance + ((currentSpeed - this.closeApproachSpeed) * timeToTurn);
            let desiredVelocity;

            const angleToReverseVelocity = normalizeAngleDiff(Math.atan2(-this.ship.velocity.y, -this.ship.velocity.x) - this.ship.angle);
            const isFacingAway = Math.abs(angleToReverseVelocity) < Math.PI / 6;
            if (velocityTowardPlanet > 0 && isFacingAway && decelerationDistance < (distanceToPlanetCenter - this.arrivalDistance)) {
                desiredVelocity = this.ship.velocity; // No allocation, just reference
                desiredAngle = Math.atan2(-this.ship.velocity.y, -this.ship.velocity.x);
                state += 'Coasting On Track';
            } else if (stoppingDistance > distanceToClose && currentSpeed > this.closeApproachSpeed * 1.2) {
                const targetVelocity = this.ship.velocity.normalize().multiply(-currentSpeed);
                desiredVelocity = targetVelocity;
                if (lateralSpeed > 5) {
                    state += 'lateralSpeed > 5 ';
                    const lateralCorrectionFactor = Math.min(1, lateralSpeed / 5);
                    const lateralCorrection = velocityPerpendicular.normalize().multiply(-lateralSpeed * lateralCorrectionFactor);
                    desiredVelocity = targetVelocity.add(lateralCorrection);
                    desiredVelocity.normalizeInPlace().multiplyInPlace(currentSpeed);
                }
                state += 'Overshoot ';
            } else {
                const desiredSpeed = Math.max(this.closeApproachSpeed, this.closeApproachSpeed + (distanceToClose / maxDecelerationDistance) * (this.ship.maxVelocity - this.closeApproachSpeed));
                const targetVelocity = directionToPlanet.multiply(desiredSpeed);
                desiredVelocity = targetVelocity;
                if (lateralSpeed > 5) {
                    state += 'lateralSpeed > 5 ';
                    const lateralCorrectionFactor = Math.min(1, lateralSpeed / 5);
                    const lateralCorrection = velocityPerpendicular.normalize().multiply(-lateralSpeed * lateralCorrectionFactor);
                    desiredVelocity = targetVelocity.add(lateralCorrection);
                    desiredVelocity.normalizeInPlace().multiplyInPlace(desiredSpeed);
                }
                state += 'Scale Speed ';
            }

            const velocityError = desiredVelocity.subtract(this.ship.velocity);
            this.velocityError = velocityError.clone();
            const velocityErrorMagnitude = velocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                state += 'velocityErrorMagnitude > 5 ';
                desiredAngle = Math.atan2(velocityError.y, velocityError.x);
                const angleToDesired = normalizeAngleDiff(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 12 || velocityTowardPlanet < -5;
                state += shouldThrust ? 'Thrusting' : 'Turning';
            } else if (!shouldThrust) {
                desiredAngle = Math.atan2(-this.ship.velocity.y, -this.ship.velocity.x);
                state += 'Coasting';
            }
        } else {
            state = 'Close: ';
            const finalSpeed = remapClamp(distanceToPlanetCenter, 0, this.closeApproachDistance, this.arrivalSpeed, this.closeApproachSpeed);
            let desiredSpeed = finalSpeed;
            if (currentSpeed < finalSpeed * 0.5) {
                desiredSpeed = finalSpeed * 1.2;
            } else if (currentSpeed > finalSpeed * 1.2) {
                desiredSpeed = -currentSpeed;
            }
            const targetVelocity = directionToPlanet.multiply(desiredSpeed);
            let desiredVelocity = targetVelocity;
            if (lateralSpeed > 1) {
                state += 'lateralSpeed > 1 ';
                const lateralCorrectionFactor = Math.min(1, lateralSpeed / 5);
                const lateralCorrection = velocityPerpendicular.normalize().multiply(-lateralSpeed * lateralCorrectionFactor);
                desiredVelocity = targetVelocity.add(lateralCorrection);
                desiredVelocity.normalizeInPlace().multiplyInPlace(desiredSpeed);
            }

            const velocityError = desiredVelocity.subtract(this.ship.velocity);
            this.velocityError = velocityError.clone();
            const velocityErrorMagnitude = velocityError.magnitude();

            if (velocityErrorMagnitude > 1) {
                state += 'velocityErrorMagnitude > 1 ';
                desiredAngle = Math.atan2(velocityError.y, velocityError.x);
                const angleToDesired = normalizeAngleDiff(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 12;
                state += shouldThrust ? 'Thrusting' : 'Turning';
            } else {
                desiredAngle = Math.atan2(-this.ship.velocity.y, -this.ship.velocity.x);
                state += 'Coasting';
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
 * Chains FlyToTargetAutoPilot and handles landing initiation.
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
        this.subPilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED, 30);
        this.subPilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase and landing initiation.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;

        if (this.subPilot && this.subPilot.active) {
            this.subPilot.update(deltaTime);
            if (this.subPilot.isComplete()) {
                if (this.subPilot.error) {
                    this.error = this.subPilot.error;
                    this.stop();
                    return;
                }
                this.subPilot = null;
            }
        } else {
            const distanceToPlanetCenter = this.ship.position.subtract(this.target.position).magnitude();
            if (distanceToPlanetCenter <= this.target.radius) {
                if (this.ship.canLand(this.target)) {
                    this.ship.initiateLanding(this.target);
                    this.completed = true;
                    this.stop();
                } else {
                    const velocityError = this.ship.velocity.multiply(-1); // Still one allocation
                    this.velocityError = velocityError.clone();
                    const desiredAngle = Math.atan2(velocityError.y, velocityError.x);
                    const angleToDesired = ((desiredAngle - this.ship.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12);
                }
            } else {
                this.error = "Not close enough to land";
                this.stop();
            }
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
        }
        return `Autopilot: Landing on ${this.target.name || 'planet'}`;
    }
}