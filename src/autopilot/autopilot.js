// ai/autopilot.js
import { JumpGate } from '/src/starSystem/celestialBody.js';
import { remapClamp, normalizeAngle, randomBetween } from '/src/core/utils.js';
import { Ship } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';

/**
 * Base class for autopilot behaviors controlling ship navigation.
 */
export class AutoPilot {
    /**
     * Creates a new AutoPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} [target=null] - The target object (e.g., planet, jump gate).
     */
    constructor(ship, target = null) {
        /** @type {Ship} The ship controlled by this autopilot. */
        this.ship = ship;
        /** @type {GameObject|null} The target object (e.g., planet, jump gate). */
        this.target = target;
        /** @type {boolean} Whether the autopilot is active. */
        this.active = false;
        /** @type {boolean} Whether the autopilot has completed its task. */
        this.completed = false;
        /** @type {string|null} Error message if the autopilot fails, null if no error. */
        this.error = null;
        /** @type {AutoPilot|null} Optional sub-autopilot for delegated tasks. */
        this.subAutopilot = null;
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
     * Updates the autopilot's behavior each frame. Must be overridden by subclasses.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        // Subclasses override this
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
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getStatus() {
        return "Idle";
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
 * Autopilot for avoiding a threat by moving away and toward the sector center.
 * @extends AutoPilot
 */
export class AvoidAutoPilot extends AutoPilot {
    /**
     * Creates a new AvoidAutoPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} threat - The threat to avoid.
     */
    constructor(ship, threat) {
        super(ship);
        /** @type {Ship} The ship posing a threat to avoid. */
        this.threat = threat;
        /** @type {number} Maximum duration (seconds) to attempt avoiding the threat. */
        this.timeout = 30;
        /** @type {number} Cumulative time (seconds) spent avoiding the threat. */
        this.timeElapsed = 0;
        /** @type {Vector2D} Desired velocity vector for navigation. */
        this._scratchDesiredVelocity = new Vector2D();
        /** @type {Vector2D} Velocity error vector for course correction. */
        this._scratchVelocityError = new Vector2D();
        /** @type {Vector2D} Temporary vector for distance calculations. */
        this._scratchDistance = new Vector2D();
    }

    /**
     * Starts the autopilot, initializing avoidance behavior.
     */
    start() {
        super.start();
        this.timeElapsed = 0;
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

        // Calculate desired velocity: 2 away from threat, 1 toward center
        this._scratchDesiredVelocity.set(0, 0);

        // Away from threat (weight: 2)
        const toThreat = this._scratchDistance.set(this.threat.position)
            .subtractInPlace(this.ship.position);
        const distanceSq = toThreat.squareMagnitude();
        if (distanceSq > 0) {
            this._scratchDesiredVelocity.subtractInPlace(toThreat.normalizeInPlace().multiplyInPlace(2));
        }

        // Toward sector center (weight: 1)
        const toCenter = this._scratchDistance.set(0, 0)
            .subtractInPlace(this.ship.position);
        if (toCenter.squareMagnitude() > 0) {
            this._scratchDesiredVelocity.addInPlace(toCenter.normalizeInPlace());
        }

        // Normalize and scale to max velocity
        const maxVelocity = this.ship.maxVelocity || 300; // Default max velocity
        if (this._scratchDesiredVelocity.squareMagnitude() > 0) {
            this._scratchDesiredVelocity.normalizeInPlace().multiplyInPlace(maxVelocity);
        }

        // Calculate velocity error
        this._scratchVelocityError.set(this._scratchDesiredVelocity).subtractInPlace(this.ship.velocity);
        const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

        // Set target angle and thrust
        let desiredAngle = this.ship.angle;
        let shouldThrust = false;
        if (velocityErrorMagnitude > 5) {
            desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
            const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
            desiredAngle = this.ship.angle + angleToDesired;
            shouldThrust = Math.abs(angleToDesired) < Math.PI / 12; // Thrust if within 15 degrees
        }

        this.ship.setTargetAngle(desiredAngle);
        this.ship.applyThrust(shouldThrust);
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string including threat name and time remaining.
     */
    getStatus() {
        return `Avoiding ${this.threat.name} (${(this.timeout - this.timeElapsed).toFixed(1)})`;
    }
}

/**
 * Autopilot to flee to the nearest planet or jump gate, firing at threat if close.
 * @extends AutoPilot
 */
export class FleeAutoPilot extends AutoPilot {
    /**
     * Creates a new FleeAutoPilot instance.
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
    }

    /**
     * Starts the autopilot, validating the target.
     */
    start() {
        super.start();
        if (!this.target) {
            this.completed = true;
            this.stop();
        }
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
            console.log('FleeAutoPilot: target not valid!');
            this.target = this.ship.starSystem.getClosestPlanet(this.ship);
            if (this.subAutopilot) {
                this.subAutopilot.stop();
                this.subAutopilot = null;
            }
        }

        if (!this.subAutopilot) {
            // Navigate to target
            if (this.target instanceof JumpGate) {
                this.subAutopilot = new TraverseJumpGateAutoPilot(this.ship, this.target);
            } else {
                this.subAutopilot = new LandOnPlanetAutoPilot(this.ship, this.target);
            }
            this.subAutopilot.start();
        } else {
            this.subAutopilot.update(deltaTime);
            if (this.subAutopilot.isComplete()) {
                this.subAutopilot = null;
                if (this.ship.state === 'Landed') {
                    this.completed = true;
                    this.stop();
                } else {
                    console.log('Auto pilot complete looking for a new planet');
                    this.target = this.ship.starSystem.getClosestPlanet(this.ship);
                }
            }
            return;
        }
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string including threat and target names.
     */
    getStatus() {
        if (this.ship.debug) {
            let status = `${this.constructor.name}: ${this.threat.name} to ${this.target.name}, `;
            if (this.subAutopilot) {
                status += `${this.subAutopilot.constructor.name}: ${this.subAutopilot.getStatus()}`;
            }
            return status;
        }
        return `Fleeing ${this.threat.name} to ${this.target.name}`;
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
     * @param {number} [arrivalDistance=100] - Distance from target center to achieve arrivalSpeed.
     * @param {number} [arrivalSpeed=Ship.LANDING_SPEED] - Target speed when within arrivalDistance.
     * @param {number} [closeApproachSpeed=30] - Speed at closeApproachDistance for smoother approach.
     */
    constructor(ship, target, arrivalDistance = 100, arrivalSpeed = Ship.LANDING_SPEED, closeApproachSpeed = 30) {
        super(ship, target);
        /** @type {number} Distance from target center to achieve arrivalSpeed. */
        this.arrivalDistance = arrivalDistance;
        /** @type {number} Target speed when within arrivalDistance. */
        this.arrivalSpeed = arrivalSpeed;
        /** @type {number} Speed at closeApproachDistance for smoother approach. */
        this.closeApproachSpeed = closeApproachSpeed;
        /** @type {number} Distance for far approach phase, computed dynamically. */
        this.farApproachDistance = 0;
        /** @type {number} Distance for close approach phase, computed dynamically. */
        this.closeApproachDistance = 0;
        /** @type {Vector2D} Direction from ship to target. */
        this._scratchDirectionToTarget = new Vector2D(0, 0);
        /** @type {Vector2D} Desired velocity toward target. */
        this._scratchTargetVelocity = new Vector2D(0, 0);
        /** @type {Vector2D} Difference between desired and current velocity. */
        this._scratchVelocityError = new Vector2D(0, 0);
        /** @type {Vector2D} Correction for perpendicular velocity. */
        this._scratchLateralCorrection = new Vector2D(0, 0);
        /** @type {Vector2D} Perpendicular component of current velocity. */
        this._scratchVelocityPerpendicular = new Vector2D(0, 0);
        /** @type {Vector2D} Final desired velocity after corrections. */
        this._scratchDesiredVelocity = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for intermediate calculations. */
        this._scratchTemp = new Vector2D(0, 0);
        /** @type {Vector2D} Predicted future position of the target. */
        this._scratchFuturePosition = new Vector2D(0, 0);
    }

    /**
     * Starts the autopilot, ensuring the target is in the same star system.
     */
    start() {
        super.start();
        if (!this.target || this.target.starSystem !== this.ship.starSystem) {
            this.error = 'Target not in same system';
            this.active = false;
        }
    }

    /**
     * Updates the ship's trajectory to fly toward the target with velocity control.
     * Adjusts speed and direction based on distance zones (far, mid, close).
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active || !this.target) return;

        // Default to target's current position
        let targetPosition = this.target.position;

        // Predict future position if target is moving
        if (this.target.velocity instanceof Vector2D) {
            this._scratchDirectionToTarget.set(this.target.position).subtractInPlace(this.ship.position);
            const distanceToTarget = this._scratchDirectionToTarget.magnitude();
            this._scratchDirectionToTarget.normalizeInPlace();

            const relativeVelocity = this._scratchTemp.set(this.ship.velocity)
                .subtractInPlace(this.target.velocity)
                .dot(this._scratchDirectionToTarget);
            const closingSpeed = Math.max(this.ship.maxVelocity - relativeVelocity, 1); // Avoid division by zero
            const timeToIntercept = distanceToTarget / closingSpeed;

            targetPosition = this._scratchFuturePosition.set(this.target.velocity)
                .multiplyInPlace(timeToIntercept)
                .addInPlace(this.target.position);
        }

        // Calculate direction and distance to target
        this._scratchDirectionToTarget.set(targetPosition).subtractInPlace(this.ship.position);
        const distanceToTargetCenter = this._scratchDirectionToTarget.magnitude();
        this._scratchDirectionToTarget.normalizeInPlace();
        const currentSpeed = this.ship.velocity.magnitude();

        // Decompose velocity into parallel and perpendicular components
        const velocityTowardTarget = this.ship.velocity.dot(this._scratchDirectionToTarget);
        this._scratchTemp.set(this._scratchDirectionToTarget).multiplyInPlace(velocityTowardTarget);
        this._scratchVelocityPerpendicular.set(this.ship.velocity).subtractInPlace(this._scratchTemp);
        const lateralSpeed = this._scratchVelocityPerpendicular.magnitude();
        const decelerationDistance = currentSpeed > this.arrivalSpeed
            ? (currentSpeed * currentSpeed - this.arrivalSpeed * this.arrivalSpeed) / (2 * this.ship.thrust)
            : 0;

        // Complete if within arrival distance
        if (distanceToTargetCenter <= this.arrivalDistance) {
            this.completed = true;
            this.stop();
            return;
        }

        // Precompute approach distances
        const timeToTurn = Math.PI / this.ship.rotationSpeed;
        const maxDecelerationDistance = (this.ship.maxVelocity * this.ship.maxVelocity - this.arrivalSpeed * this.arrivalSpeed) / (2 * this.ship.thrust);
        this.farApproachDistance = maxDecelerationDistance + (this.ship.maxVelocity * timeToTurn);
        this.closeApproachDistance = this.arrivalSpeed + this.arrivalDistance + (this.arrivalSpeed * timeToTurn);

        let desiredAngle = this.ship.angle;
        let shouldThrust = false;

        if (distanceToTargetCenter > this.farApproachDistance) {
            // Far phase: Full speed toward target
            this._scratchTargetVelocity.set(this._scratchDirectionToTarget).multiplyInPlace(this.ship.maxVelocity);
            this._scratchDesiredVelocity.set(this._scratchTargetVelocity);

            if (lateralSpeed > 5) {
                // Correct lateral drift
                const lateralCorrectionFactor = Math.min(1, lateralSpeed / 10);
                this._scratchLateralCorrection.set(this._scratchVelocityPerpendicular)
                    .normalizeInPlace()
                    .multiplyInPlace(-lateralSpeed * lateralCorrectionFactor);
                this._scratchDesiredVelocity.addInPlace(this._scratchLateralCorrection)
                    .normalizeInPlace()
                    .multiplyInPlace(this.ship.maxVelocity);
            }

            this._scratchVelocityError.set(this._scratchDesiredVelocity).subtractInPlace(this.ship.velocity);
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
            // Mid phase: Adjust speed based on stopping distance
            const distanceToClose = distanceToTargetCenter - this.closeApproachDistance;
            const stoppingDistance = decelerationDistance + ((currentSpeed - this.closeApproachSpeed) * timeToTurn);
            const angleToReverseVelocity = normalizeAngle(Math.atan2(-this.ship.velocity.x, this.ship.velocity.y) - this.ship.angle);
            const isFacingAway = Math.abs(angleToReverseVelocity) < Math.PI / 6;

            if (velocityTowardTarget > 0 && isFacingAway && decelerationDistance < (distanceToTargetCenter - this.arrivalDistance)) {
                // Maintain current velocity if decelerating naturally
                this._scratchDesiredVelocity.set(this.ship.velocity);
                desiredAngle = Math.atan2(-this.ship.velocity.x, this.ship.velocity.y);
            } else if (stoppingDistance > distanceToClose && currentSpeed > this.closeApproachSpeed * 1.2) {
                // Reverse thrust to slow down
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
                // Blend speed toward closeApproachSpeed
                const desiredSpeed = Math.max(this.closeApproachSpeed, this.closeApproachSpeed + (distanceToClose / maxDecelerationDistance) * (this.ship.maxVelocity - this.closeApproachSpeed));
                this._scratchTargetVelocity.set(this._scratchDirectionToTarget).multiplyInPlace(desiredSpeed);
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

            this._scratchVelocityError.set(this._scratchDesiredVelocity).subtractInPlace(this.ship.velocity);
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
            // Close phase: Fine-tune speed to arrivalSpeed
            const finalSpeed = remapClamp(distanceToTargetCenter, 0, this.closeApproachDistance, this.arrivalSpeed, this.closeApproachSpeed);
            let desiredSpeed = finalSpeed;
            if (currentSpeed < finalSpeed * 0.5) desiredSpeed = finalSpeed * 1.2;
            else if (currentSpeed > finalSpeed * 1.2) desiredSpeed = -currentSpeed;

            this._scratchTargetVelocity.set(this._scratchDirectionToTarget).multiplyInPlace(desiredSpeed);
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

            this._scratchVelocityError.set(this._scratchDesiredVelocity).subtractInPlace(this.ship.velocity);
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

        // Apply control inputs
        this.ship.setTargetAngle(desiredAngle);
        this.ship.applyThrust(shouldThrust);
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getStatus() {
        return `Flying to ${this.target.name || 'target'}`;
    }
}

/**
 * Autopilot that flies to a planet and lands on it, chaining FlyToTargetAutoPilot for approach.
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
        /** @type {FlyToTargetAutoPilot|null} Sub-autopilot for approaching the planet. */
        this.subAutopilot = null;
        /** @type {Vector2D} Distance vector from ship to target planet. */
        this._scratchDistanceToTarget = new Vector2D(0, 0);
        /** @type {Vector2D} Velocity error vector for course correction. */
        this._scratchVelocityError = new Vector2D();
        /** @type {Vector2D} Temporary vector for calculations. */
        this._scratchTemp = new Vector2D(0, 0);
    }

    /**
     * Starts the autopilot, ensuring the target is a planet in the same system.
     */
    start() {
        super.start();
        if (!(this.target && !(this.target instanceof JumpGate))) {
            console.warn('Target is not a planet', this.target, this, this.ship);
            this.error = 'Target is not a planet';
            this.active = false;
            return;
        }
        if (this.target.starSystem !== this.ship.starSystem) {
            console.warn('Planet not in same system', this.target, this, this.ship);
            this.error = 'Planet not in same system';
            this.active = false;
            return;
        }
        // Initialize sub-pilot to approach the planet
        this.subAutopilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
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
            this.subAutopilot.update(deltaTime);
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
                if (this.ship.canLand(this.target)) {
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
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12);
                }
            } else {
                // Overshot the planet; restart sub-pilot to re-approach
                this.subAutopilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
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

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string indicating landing or sub-autopilot state.
     */
    getStatus() {
        if (this.subAutopilot && this.subAutopilot.active) {
            return this.subAutopilot.getStatus();
        }
        if (this.ship.state === 'Landing') {
            return `Landing on ${this.target.name || 'planet'} (Animating)`;
        }
        return `Landing on ${this.target.name || 'planet'}`;
    }
}

/**
 * Autopilot that flies to the closest planet, lands, and despawns the ship.
 * @extends AutoPilot
 */
export class LandOnPlanetDespawnAutoPilot extends AutoPilot {
    /**
     * Creates a new LandOnPlanetDespawnAutoPilot instance.
     * @param {Ship} ship - The ship to control.
     */
    constructor(ship) {
        super(ship);
        /** @type {Planet|null} The closest planet to land on. */
        this.target = ship.starSystem?.getClosestPlanet(ship);
        /** @type {Vector2D} Scratch vector for distance calculations. */
        this._scratchDistanceToTarget = new Vector2D();
        /** @type {Vector2D} Scratch vector for velocity corrections. */
        this._scratchVelocityError = new Vector2D();
    }

    /**
     * Starts the autopilot, validating the target planet.
     */
    start() {
        super.start();
        if (!this.target) {
            this.error = 'No planet available';
            this.active = false;
            return;
        }
        this.subAutopilot = new LandOnPlanetAutoPilot(this.ship, this.target);
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
            this.subAutopilot = new LandOnPlanetAutoPilot(this.ship, this.target);
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
            this.subAutopilot = new LandOnPlanetAutoPilot(this.ship, this.target);
            this.subAutopilot.start();
        }
    }

    /**
     * Stops the autopilot and any active sub-autopilot.
     */
    stop() {
        if (this.subAutopilot) this.subAutopilot.stop();
        super.stop();
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getStatus() {
        return `Despawning on ${this.target?.name || 'planet'}`;
    }
}

/**
 * Autopilot that flies to a jump gate and traverses it, waiting for the full jump animation to complete.
 * Chains FlyToTargetAutoPilot for approach and handles hyperjump initiation.
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
        /** @type {FlyToTargetAutoPilot|null} Sub-autopilot for approaching the jump gate. */
        this.subAutopilot = null;
        /** @type {Vector2D} Distance vector from ship to target jump gate. */
        this._scratchDistanceToTarget = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for calculations. */
        this._scratchTemp = new Vector2D(0, 0);
        /** @type {Vector2D} Velocity error vector for course correction. */
        this._scratchVelocityError = new Vector2D();
    }

    /**
     * Starts the autopilot, ensuring the target is a jump gate in the same system.
     */
    start() {
        super.start();
        if (!(this.target instanceof JumpGate)) {
            this.error = 'Target is not a jump gate';
            this.active = false;
            return;
        }
        if (this.target.starSystem !== this.ship.starSystem) {
            this.error = 'Jump gate not in same system';
            this.active = false;
            return;
        }
        // Initialize sub-pilot to fly to the gate
        this.subAutopilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
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
            this.subAutopilot.update(deltaTime);
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
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12);
                }
            } else {
                // Not aligned with gate; restart sub-pilot
                if (this.ship.debug) {
                    console.log(`Not aligned with ${this.target.name || 'jump gate'}; restarting fly-to phase`);
                }
                this.subAutopilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
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

    /**
     * Stops the autopilot and any active sub-autopilot.
     */
    stop() {
        if (this.subAutopilot) this.subAutopilot.stop();
        super.stop();
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string indicating jump progress or sub-autopilot state.
     */
    getStatus() {
        if (this.ship.debug) {
            let status = `${this.target.name || 'jump gate'}`;
            if (this.subAutopilot && this.subAutopilot.active) {
                status += `, ${this.subAutopilot.constructor.name}: ${this.subAutopilot.getStatus()}`;
            }
            return status;
        } else {
            return `Traversing ${this.target.name || 'jump gate'}`;
        }
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
        /** @type {number} The radius within which to fully match the target's velocity. */
        this.followRadius = followRadius;
        /** @type {number} Speed to approach the target when outside the approach distance. */
        this.approachSpeed = approachSpeed;
        /** @type {number} Distance for far approach phase, computed dynamically in start(). */
        this.farApproachDistance = 0;
        /** @type {number} Distance for close approach phase, set to 2x followRadius. */
        this.closeApproachDistance = followRadius * 2;
        /** @type {Vector2D} Direction from ship to target, reused for calculations. */
        this._scratchDirectionToTarget = new Vector2D();
        /** @type {Vector2D} Predicted future position of the target. */
        this._scratchFuturePosition = new Vector2D();
        /** @type {Vector2D} Difference between desired and current velocity. */
        this._scratchVelocityError = new Vector2D();
        /** @type {Vector2D} Desired velocity vector for the ship. */
        this._scratchDesiredVelocity = new Vector2D();
        /** @type {Vector2D} Temporary vector for intermediate calculations. */
        this._scratchTemp = new Vector2D();
        /** @type {Vector2D} Target's velocity vector, reused for efficiency. */
        this._scratchTargetVelocity = new Vector2D();
    }

    /**
     * Starts the autopilot, ensuring the target is a valid game object in the same star system.
     */
    start() {
        super.start();
        if (!(this.target instanceof GameObject)) {
            this.error = "Target is not a Game Object";
            this.active = false;
            return;
        }
        if (this.target.starSystem !== this.ship.starSystem) {
            this.error = "Target not in same system";
            this.active = false;
            return;
        }

        // Calculate far approach distance based on ship's max velocity and thrust
        const timeToTurn = Math.PI / this.ship.rotationSpeed;
        const maxDecelerationDistance = (this.ship.maxVelocity * this.ship.maxVelocity - this.approachSpeed * this.approachSpeed) / (2 * this.ship.thrust);
        const maxDistanceWhileTurning = this.ship.maxVelocity * timeToTurn;
        this.farApproachDistance = maxDecelerationDistance + maxDistanceWhileTurning;
    }

    /**
     * Updates the ship's trajectory to follow the target, projecting its future position and matching velocity.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
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

        // Recalculate direction to the future position
        this._scratchDirectionToTarget.set(this._scratchFuturePosition)
            .subtractInPlace(this.ship.position);
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
            const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 4;
            } else {
                desiredAngle = this.getAlignedAngle();
            }
        } else if (distanceToTarget > this.followRadius) {
            // Approach distance: gradually match the target's velocity
            const distanceRange = this.closeApproachDistance - this.followRadius;
            const distanceProgress = (distanceToTarget - this.followRadius) / distanceRange;
            const speedFactor = remapClamp(distanceProgress, 0, 1, 0, 1);

            // Interpolate desired velocity between approach speed and target's velocity
            const approachVelocity = this._scratchTemp.set(this._scratchDirectionToTarget)
                .multiplyInPlace(this.approachSpeed);
            this._scratchTargetVelocity.set(this.target.velocity);
            this._scratchDesiredVelocity.set(this._scratchTargetVelocity)
                .multiplyInPlace(1 - speedFactor)
                .addInPlace(approachVelocity.multiplyInPlace(speedFactor));

            this._scratchVelocityError.set(this._scratchDesiredVelocity)
                .subtractInPlace(this.ship.velocity);
            const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 12;
            } else {
                desiredAngle = this.getAlignedAngle();
            }
        } else {
            if (this.ship.debug) {
                console.log("Inside follow radius");
            }
            // Inside follow radius: fully match the target's velocity
            this._scratchDesiredVelocity.set(this.target.velocity);
            this._scratchVelocityError.set(this._scratchDesiredVelocity)
                .subtractInPlace(this.ship.velocity);
            const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 12;
            } else {
                desiredAngle = this.getAlignedAngle();
            }
        }

        this.ship.setTargetAngle(desiredAngle);
        this.ship.applyThrust(shouldThrust);
    }

    /**
     * Determines the desired angle based on the target's type and state.
     * @returns {number} The desired angle in radians.
     */
    getAlignedAngle() {
        if (this.target instanceof Ship) {
            if (this.target.isThrusting) {
                return this.ship.angle; // Maintain current heading
            } else {
                return this.target.angle; // Align with target's heading
            }
        } else if (this.target instanceof Asteroid) {
            return this.target.orbitAngle + Math.PI * 0.5;
        } else {
            return this.ship.angle;
        }
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string indicating the follow target.
     */
    getStatus() {
        return `Following ${this.target.name || 'ship'}`;
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
     * @param {Ship} ship - The ship to control with this autopilot.
     * @param {Ship} escortedShip - The target ship to escort.
     * @param {number} [followDistance=250] - The desired distance to maintain while following the escorted ship.
     */
    constructor(ship, escortedShip, followDistance = 250) {
        super(ship, escortedShip);
        /** @type {number} The distance to maintain while following the escorted ship. */
        this.followDistance = followDistance;
        /** @type {string} The current state of the autopilot (e.g., 'Idle', 'Following'). */
        this.state = 'Idle';
        /** @type {number} Time (seconds) remaining to wait in the 'Waiting' state. */
        this.waitTime = 0;
        /** @type {Vector2D} Pre-allocated vector for direction calculations to avoid allocations. */
        this._scratchDirectionToTarget = new Vector2D(0, 0);
        /** @type {Vector2D} Pre-allocated vector for distance (unused but retained for consistency). */
        this._scratchDistanceToTarget = new Vector2D(0, 0);
        /** @type {number} Minimum wait time (seconds) after landing before taking off. */
        this.waitTimeMin = 2;
        /** @type {number} Maximum wait time (seconds) after landing before taking off. */
        this.waitTimeMax = 5;
        /** @type {Object.<string, Function>} Map of state names to their respective handler methods. */
        this.stateHandlers = {
            Idle: this.updateIdle.bind(this),
            Following: this.updateFollowing.bind(this),
            TakingOff: this.updateTakingOff.bind(this),
            Landing: this.updateLanding.bind(this),
            TraversingJumpGate: this.updateTraversingJumpGate.bind(this),
            Waiting: this.updateWaiting.bind(this)
        };
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
        if (this.target.starSystem !== this.ship.starSystem) {
            this.error = 'Target ship not in same system';
            this.active = false;
            return;
        }
    }

    /**
     * Updates the autopilot's behavior based on its current state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;

        // Check if the escorted ship still exists
        if (!this.target || this.target.isDespawned()) {
            this.stop();
            this.error = 'Escorted ship despawned';
            console.warn('Escorted ship despawned');
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
     * Handles the 'Idle' state: initiates following or takeoff based on the escorted ship's state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @private
     */
    updateIdle(deltaTime) {
        if (this.ship.state === 'Landed') {
            // Take off if the escorted ship is moving
            if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
                this.ship.initiateTakeoff();
                this.state = 'TakingOff';
            }
        } else if (this.ship.state === 'Flying') {
            // Begin following the escorted ship
            this.subAutopilot = new FollowShipAutoPilot(this.ship, this.target, this.followDistance, 100);
            this.subAutopilot.start();
            this.state = 'Following';
        } else if (this.ship.state === 'TakingOff' || this.ship.state === 'Landing') {
            // Wait for transitional states to complete
        } else {
            console.warn(`Invalid ship state '${this.ship.state}' in EscortAutoPilot updateIdle`);
        }
    }

    /**
     * Handles the 'Following' state: follows the escorted ship and reacts to its actions (landing, jumping).
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @private
     */
    updateFollowing(deltaTime) {
        if (!this.subAutopilot) {
            console.warn('Sub-autopilot not set during Following state');
            this.state = 'Idle';
            return;
        }

        // Handle the escorted ship jumping out
        if (this.target.state === 'JumpingOut') {
            this.subAutopilot.stop();
            const jumpGate = this.target.jumpGate;
            if (jumpGate && jumpGate instanceof JumpGate && !jumpGate.isDespawned()) {
                this.subAutopilot = new TraverseJumpGateAutoPilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = 'TraversingJumpGate';
            } else {
                console.warn('Jump gate invalid or not found; entering wait mode');
                this.subAutopilot = null;
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
            }
            return;
        }

        // Handle the escorted ship landing
        if (this.target.state === 'Landed' || this.target.state === 'Landing') {
            this.subAutopilot.stop();
            this.subAutopilot = new LandOnPlanetAutoPilot(this.ship, this.target.landedObject);
            this.subAutopilot.start();
            this.state = 'Landing';
            return;
        }

        // Handle the escorted ship moving to another star system
        if (this.target.starSystem !== this.ship.starSystem) {
            this.subAutopilot.stop();
            const targetSystem = this.target.starSystem;
            const jumpGate = this.ship.starSystem.getJumpGateToSystem(targetSystem);
            if (jumpGate) {
                this.subAutopilot = new TraverseJumpGateAutoPilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = 'TraversingJumpGate';
            } else {
                console.warn('No jump gate found to target system; entering wait mode');
                this.subAutopilot = null;
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
            }
            return;
        }

        // Continue following the escorted ship
        this.subAutopilot.update(deltaTime);
        if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot inactive during Following state; resetting');
            this.subAutopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the 'TakingOff' state: waits for the ship to complete takeoff.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @private
     */
    updateTakingOff(deltaTime) {
        if (this.ship.state === 'Flying') {
            this.state = 'Idle'; // Transition to determine the next action
        }
    }

    /**
     * Handles the 'Landing' state: lands on the same body as the escorted ship, aborting if it takes off.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @private
     */
    updateLanding(deltaTime) {
        if (!this.subAutopilot) {
            console.warn('Sub-autopilot not set during Landing state');
            this.state = 'Idle';
            return;
        }

        // Abort landing if the escorted ship takes off
        if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
            this.subAutopilot.stop();
            this.subAutopilot = null;
            this.state = 'Idle';
            return;
        }

        // Process landing
        this.subAutopilot.update(deltaTime);
        if (this.subAutopilot.isComplete()) {
            if (this.subAutopilot.error) {
                console.warn(`Landing failed: ${this.subAutopilot.error}`);
                this.subAutopilot = null;
                this.state = 'Idle';
            } else if (this.ship.state === 'Landed') {
                this.subAutopilot = null;
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
            } else {
                console.warn('Landing completed but ship not landed; resetting');
                this.subAutopilot = null;
                this.state = 'Idle';
            }
        } else if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot inactive but not complete during Landing state');
            this.subAutopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the 'TraversingJumpGate' state: jumps to the escorted ship's star system.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @private
     */
    updateTraversingJumpGate(deltaTime) {
        if (!this.subAutopilot) {
            console.warn('Sub-autopilot not set during TraversingJumpGate state');
            this.state = 'Idle';
            return;
        }

        // Process the jump
        this.subAutopilot.update(deltaTime);
        if (this.subAutopilot.isComplete()) {
            if (this.subAutopilot.error) {
                console.warn(`Jump failed: ${this.subAutopilot.error}`);
                this.subAutopilot = null;
                this.state = 'Idle';
            } else if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.starSystem) {
                this.subAutopilot = null;
                this.state = 'Idle'; // Transition to resume following
            } else {
                console.warn('Jump completed but not in target system; resetting');
                this.subAutopilot = null;
                this.state = 'Idle';
            }
        } else if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot inactive but not complete during TraversingJumpGate state');
            this.subAutopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the 'Waiting' state: pauses after landing before resuming escort duties.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @private
     */
    updateWaiting(deltaTime) {
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            this.state = 'Idle'; // Check the escorted ship's state next update
        }
    }

    /**
     * Returns the current status of the autopilot for display (e.g., on a HUD).
     * @returns {string} A descriptive status string based on the current state.
     */
    getStatus() {
        if (this.state === 'Following' && this.subAutopilot?.active) {
            return `Escorting ${this.target.name || 'ship'}`;
        }
        if (this.state === 'Landing' && this.subAutopilot?.active) {
            return `Landing on ${this.target.landedOn?.name || 'body'}`;
        }
        if (this.state === 'TraversingJumpGate' && this.subAutopilot?.active) {
            return `Jumping to ${this.target.starSystem?.name || 'system'}`;
        }
        if (this.state === 'Waiting') {
            return 'Waiting';
        }
        return `Escorting (${this.state})`;
    }
}

/**
 * Autopilot that flies to an asteroid and lands on it to mine.
 * Chains ApproachTargetAutoPilot to approach and handles mining initiation and completion.
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
        /** @type {Vector2D} Pre-allocated vector for distance calculations. */
        this._scratchDistanceToTarget = new Vector2D(0, 0);
        /** @type {Vector2D} Pre-allocated vector for temporary calculations. */
        this._scratchTemp = new Vector2D(0, 0);
        /** @type {Vector2D} Pre-allocated vector for velocity error calculations. */
        this._scratchVelocityError = new Vector2D(0, 0);
    }

    /**
     * Starts the autopilot, ensuring the target is an asteroid in the same system.
     * @override
     */
    start() {
        super.start();
        if (!(this.target instanceof Asteroid)) {
            this.error = 'Target is not an asteroid';
            this.active = false;
            return;
        }
        if (this.target.starSystem !== this.ship.starSystem) {
            this.error = 'Asteroid not in same system';
            this.active = false;
            return;
        }
        // Initialize sub-pilot for approach
        this.subAutopilot = new ApproachTargetAutoPilot(
            this.ship,
            this.target,
            this.target.radius,           // finalRadius
            Ship.LANDING_SPEED * 0.9,     // arrivalSpeedMin
            Ship.LANDING_SPEED * 4,       // arrivalSpeedMax
            2,                            // velocityTolerance
            Math.PI / 6,                  // thrustAngleLimit
            Ship.LANDING_SPEED,           // upperVelocityErrorThreshold
            2,                            // lowerVelocityErrorThreshold
            2                             // maxTimeToIntercept
        );
        this.subAutopilot.start();
    }

    /**
     * Updates the autopilot, managing the approach phase, mining initiation, and completion.
     * Restarts the sub-pilot if the ship overshoots and can't mine yet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @override
     */
    update(deltaTime) {
        if (!this.active) return;

        if (this.subAutopilot && this.subAutopilot.active) {
            // Delegate to sub-pilot for approaching the asteroid
            this.subAutopilot.update(deltaTime);
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
                } else {
                    // Slow down if not ready to mine (e.g., speed too high)
                    this._scratchVelocityError.set(this.target.velocity).subtractInPlace(this.ship.velocity);
                    const desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    const velocityErrorMagnitude = this._scratchVelocityError.magnitude();
                    if (velocityErrorMagnitude > 1) {
                        this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12);
                    }
                }
            } else {
                // Overshot the asteroid; restart sub-pilot to re-approach
                if (this.ship.debug) {
                    console.log(`Overshot ${this.target.name || 'asteroid'}; restarting approach phase`);
                }
                this.subAutopilot = new ApproachTargetAutoPilot(
                    this.ship,
                    this.target,
                    this.target.radius,           // finalRadius
                    Ship.LANDING_SPEED * 0.9,     // arrivalSpeedMin
                    Ship.LANDING_SPEED * 4,       // arrivalSpeedMax
                    2,                            // velocityTolerance
                    Math.PI / 6,                  // thrustAngleLimit
                    Ship.LANDING_SPEED,           // upperVelocityErrorThreshold
                    2,                            // lowerVelocityErrorThreshold
                    2                             // maxTimeToIntercept
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

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string indicating mining or sub-autopilot state.
     */
    getStatus() {
        if (this.subAutopilot && this.subAutopilot.active) {
            return this.subAutopilot.getStatus();
        }
        if (this.ship.state === 'Landing') {
            return `Landing on ${this.target.name || 'asteroid'} (Animating)`;
        }
        return `Mining ${this.target.name || 'asteroid'}`;
    }
}

/**
 * Autopilot that approaches a target (static or moving), matches its velocity as best as possible,
 * and settles within a specified final radius. Ensures the ship moves toward the target's origin.
 * @extends AutoPilot
 */
export class ApproachTargetAutoPilot extends AutoPilot {
    /**
     * Creates a new ApproachTargetAutoPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} target - The target to approach (static or moving).
     * @param {number} finalRadius - Radius within which to settle and match velocity (in units).
     * @param {number} arrivalSpeedMin - Minimum speed when near the target (in units/sec).
     * @param {number} arrivalSpeedMax - Maximum speed during mid-range approach (in units/sec).
     * @param {number} velocityTolerance - Tolerance for velocity matching completion (in units/sec).
     * @param {number} thrustAngleLimit - Maximum angle deviation to apply thrust (in radians).
     * @param {number} upperVelocityErrorThreshold - Upper threshold for thrust activation (in units/sec).
     * @param {number} lowerVelocityErrorThreshold - Lower threshold for thrust hysteresis (in units/sec).
     * @param {number} maxTimeToIntercept - Maximum time to predict target position (in seconds).
     */
    constructor(ship, target, finalRadius, arrivalSpeedMin, arrivalSpeedMax, velocityTolerance, thrustAngleLimit, upperVelocityErrorThreshold, lowerVelocityErrorThreshold, maxTimeToIntercept) {
        super(ship, target);
        /** @type {number} Radius within which to settle and match velocity. */
        this.finalRadius = finalRadius;
        /** @type {number} Minimum speed when near the target. */
        this.arrivalSpeedMin = arrivalSpeedMin;
        /** @type {number} Maximum speed during mid-range approach. */
        this.arrivalSpeedMax = arrivalSpeedMax;
        /** @type {number} Tolerance for velocity matching completion. */
        this.velocityTolerance = velocityTolerance;
        /** @type {number} Maximum angle deviation to apply thrust. */
        this.thrustAngleLimit = thrustAngleLimit;
        /** @type {number} Upper threshold for thrust activation. */
        this.upperVelocityErrorThreshold = upperVelocityErrorThreshold;
        /** @type {number} Lower threshold for thrust hysteresis. */
        this.lowerVelocityErrorThreshold = lowerVelocityErrorThreshold;
        /** @type {number} Maximum time to predict target position. */
        this.maxTimeToIntercept = maxTimeToIntercept;

        /** @type {boolean} Whether the autopilot is active. */
        this.active = false;
        /** @type {boolean} Whether the autopilot has completed its task. */
        this.completed = false;
        /** @type {string|null} Error message if the autopilot fails, null if no error. */
        this.error = null;
        /** @type {number} Distance for far approach phase, computed dynamically. */
        this.farApproachDistance = 0;
        /** @type {number} Distance for mid approach phase, computed dynamically. */
        this.midApproachDistance = 0;

        // Pre-allocated scratch vectors for allocation-free updates
        /** @type {Vector2D} Predicted future position of the target. */
        this._scratchFuturePosition = new Vector2D(0, 0);
        /** @type {Vector2D} Direction from ship to target. */
        this._scratchDirectionToTarget = new Vector2D(0, 0);
        /** @type {Vector2D} Desired velocity vector. */
        this._scratchDesiredVelocity = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for calculations. */
        this._scratchTemp = new Vector2D(0, 0);
        /** @type {Vector2D} Difference between ship and target velocity. */
        this._scratchVelocityDifference = new Vector2D(0, 0);
        /** @type {Vector2D} Error between desired and current velocity. */
        this._scratchVelocityError = new Vector2D(0, 0);
    }

    /**
     * Starts the autopilot, setting approach distances and validating the target.
     * @override
     */
    start() {
        if (!this.target || !this.target.position) {
            this.error = 'No valid target specified';
            this.completed = true;
            this.stop();
            return;
        }
        // Precompute distance thresholds based on ship physics
        const timeToTurn = Math.PI / this.ship.rotationSpeed;
        const decelerationDistance = (this.ship.maxVelocity * this.ship.maxVelocity - this.arrivalSpeedMax * this.arrivalSpeedMax) / (2 * this.ship.thrust);
        this.farApproachDistance = decelerationDistance + (this.ship.maxVelocity * timeToTurn);
        this.midApproachDistance = this.finalRadius + this.arrivalSpeedMax * 10;
        this.active = true;
        this.completed = false;
        this.error = null;
    }

    /**
     * Stops the autopilot, disabling thrust.
     * @override
     */
    stop() {
        this.active = false;
        this.ship.applyThrust(false);
    }

    /**
     * Updates the ship's trajectory to approach the target, blending velocity based on distance.
     * Applies thrust using hysteresis and checks for task completion.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @override
     */
    update(deltaTime) {
        if (!this.active || !this.target || !this.target.position) {
            this.error = 'Target lost or invalid';
            this.completed = true;
            this.stop();
            return;
        }

        // Calculate direction and distance to current target position
        this._scratchDirectionToTarget.set(this.target.position).subtractInPlace(this.ship.position);
        const distanceToTarget = this._scratchDirectionToTarget.magnitude();
        this._scratchDirectionToTarget.normalizeInPlace();

        // Handle target velocity (default to zero if absent)
        const targetVelocity = this.target.velocity || this._scratchTemp.set(0, 0);

        // Compute relative velocity toward target
        this._scratchVelocityDifference.set(this.ship.velocity).subtractInPlace(targetVelocity);
        const relativeSpeedTowardTarget = this._scratchVelocityDifference.dot(this._scratchDirectionToTarget);

        // Predict target position if far away
        let targetPosition = this.target.position;
        if (distanceToTarget > this.midApproachDistance) {
            const closingSpeed = Math.max(relativeSpeedTowardTarget, 0.1); // Avoid division by zero
            const timeToIntercept = Math.min(distanceToTarget / closingSpeed, this.maxTimeToIntercept);
            this._scratchFuturePosition.set(targetVelocity)
                .multiplyInPlace(timeToIntercept)
                .addInPlace(this.target.position);
            targetPosition = this._scratchFuturePosition;
        }

        // Update direction based on chosen target position
        this._scratchDirectionToTarget.set(targetPosition).subtractInPlace(this.ship.position).normalizeInPlace();

        // Set desired velocity based on distance zones
        if (distanceToTarget > this.farApproachDistance) {
            // Far phase: Full speed toward target
            this._scratchDesiredVelocity.set(this._scratchDirectionToTarget).multiplyInPlace(this.ship.maxVelocity);
        } else if (distanceToTarget > this.midApproachDistance) {
            // Mid-far transition: Blend speed from max to approach max
            const speed = remapClamp(distanceToTarget, this.midApproachDistance, this.farApproachDistance, this.arrivalSpeedMax * 10, this.ship.maxVelocity);
            this._scratchDesiredVelocity.set(this._scratchDirectionToTarget).multiplyInPlace(speed);
        } else if (distanceToTarget > this.finalRadius) {
            // Mid phase: Blend approach speed with target velocity
            const approachSpeed = remapClamp(distanceToTarget, this.finalRadius, this.midApproachDistance, this.arrivalSpeedMin, this.arrivalSpeedMax);
            this._scratchTemp.set(this._scratchDirectionToTarget).multiplyInPlace(approachSpeed);
            this._scratchDesiredVelocity.set(targetVelocity).addInPlace(this._scratchTemp);
        } else {
            // Close phase: Match target velocity with slight inward push
            this._scratchTemp.set(this._scratchDirectionToTarget).multiplyInPlace(this.arrivalSpeedMin);
            this._scratchDesiredVelocity.set(targetVelocity).addInPlace(this._scratchTemp);
        }

        // Calculate velocity error for thrust control
        this._scratchVelocityError.set(this._scratchDesiredVelocity).subtractInPlace(this.ship.velocity);
        const velocityErrorMagnitude = this._scratchVelocityError.magnitude();

        // Determine thrust and angle with hysteresis
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

        // Apply control inputs
        this.ship.setTargetAngle(this.ship.angle + angleToDesired);
        this.ship.applyThrust(shouldThrust);

        // Check if completed (within radius and velocity matched)
        if (distanceToTarget <= this.finalRadius) {
            const speedDifference = this._scratchVelocityDifference.magnitude();
            if (relativeSpeedTowardTarget > 0 && relativeSpeedTowardTarget < this.arrivalSpeedMin && speedDifference < this.arrivalSpeedMax) {
                this.completed = true;
                this.stop();
            } else {
                // Nudge toward center when close
                this.ship.velocity.addInPlace(this._scratchTemp.set(this._scratchVelocityDifference).multiplyInPlace(0.1 * deltaTime));
                this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDirectionToTarget).multiplyInPlace(0.1 * deltaTime));
            }
        }
    }

    /**
     * Checks if the autopilot has completed its task.
     * @returns {boolean} True if the ship is within the final radius and velocity is matched, false otherwise.
     * @override
     */
    isComplete() {
        return this.completed;
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string (e.g., "Approach Active" or "Approach Completed").
     * @override
     */
    getStatus() {
        return `Approach ${this.completed ? 'Completed' : 'Active'}`;
    }
}