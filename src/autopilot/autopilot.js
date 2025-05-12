// autopilot.js
import { JumpGate } from '/src/starSystem/celestialBody.js';
import { remapClamp, normalizeAngle, randomBetween } from '/src/core/utils.js';
import { Ship } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { GameObject } from '/src/core/gameObject.js';

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
        return false;//this.completed || !!this.error;
    }
}

/**
 * Autopilot to avoid a threat while staying near sector center.
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
        this.threat = threat;
        this.safeDistanceSq = 1000 * 1000; // 1000 units squared
        this.timeout = 10; // 10s timeout
        this.timeElapsed = 0;
        /** @type {Vector2D} Desired velocity vector. */
        this._scratchDesiredVelocity = new Vector2D();
        /** @type {Vector2D} Velocity error vector. */
        this._scratchVelocityError = new Vector2D();
        /** @type {Vector2D} Temporary vector for distance calculations. */
        this._scratchDistance = new Vector2D();
    }

    /**
     * Starts the autopilot.
     */
    start() {
        super.start();
        this.timeElapsed = 0;
    }

    /**
     * Updates the autopilot, moving away from threat and toward sector center.
     * @param {number} deltaTime - Time elapsed in seconds.
     */
    update(deltaTime) {
        if (!this.threat || this.ship.state !== 'Flying') {
            this._complete = true;
            return;
        }

        this.timeElapsed += deltaTime;
        if (this.timeElapsed >= this.timeout) {
            this._complete = true;
            return;
        }

        // Calculate desired velocity: 2 away from threat, 1 toward center
        this._scratchDesiredVelocity.set(0, 0);

        // Away from threat (weight: 2)
        const toThreat = this._scratchDistance.set(this.threat.position)
            .subtractInPlace(this.ship.position);
        const distanceSq = toThreat.squareMagnitude();
        if (distanceSq > this.safeDistanceSq) {
            this._complete = true;
            return;
        }
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
     * Checks if the autopilot is complete.
     * @returns {boolean} True if safe or timed out.
     */
    isComplete() {
        return this._complete;
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
        this.threat = threat;
        this.target = ship.starSystem.getClosestPlanetOrJumpGate(ship);
        this.subPilot = null;
        this._scratchVector = new Vector2D();
    }

    /**
     * Starts the autopilot.
     */
    start() {
        super.start();
        if (!this.target) {
            this._complete = true;
        }
    }

    /**
     * Updates the autopilot, fleeing to target and firing if threat is near.
     * @param {number} deltaTime - Time elapsed in seconds.
     */
    update(deltaTime) {
        if (!this.target || this.ship.state !== 'Flying') {
            this._complete = true;
            return;
        }

        // Fire at threat if within 500 units
        if (this.threat) {
            const distanceSq = this._scratchVector.set(this.threat.position)
                .subtractInPlace(this.ship.position).squareMagnitude();
            if (distanceSq < 500 * 500) {
                this.ship.setTarget(this.threat);
                this.ship.fire();
            }
        }

        // Manage sub-pilot
        if (this.subPilot) {
            this.subPilot.update(deltaTime);
            if (this.subPilot.isComplete()) {
                this.subPilot = null;
                if (this.ship.state === 'Landed') {
                    this._complete = true;
                }
            }
            return;
        }

        // Navigate to target
        const distance = this._scratchVector.set(this.target.position)
            .subtractInPlace(this.ship.position).magnitude();
        if (distance < this.target.radius) {
            if (this.target instanceof JumpGate) {
                this.subPilot = new TraverseJumpGateAutoPilot(this.ship, this.target);
            } else {
                this.subPilot = new LandOnPlanetAutoPilot(this.ship, this.target);
            }
            this.subPilot.start();
        } else {
            this.subPilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius);
            this.subPilot.start();
        }
    }

    /**
     * Checks if the autopilot is complete.
     * @returns {boolean} True if landed or jumped.
     */
    isComplete() {
        return this._complete;
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
        this.arrivalDistance = arrivalDistance;
        this.arrivalSpeed = arrivalSpeed;
        this.closeApproachSpeed = closeApproachSpeed;
        this.farApproachDistance = 0;
        this.closeApproachDistance = 0;

        // Pre-allocated scratch vectors for allocation-free updates
        this._scratchDirectionToTarget = new Vector2D(0, 0); // Direction from ship to target
        this._scratchTargetVelocity = new Vector2D(0, 0);    // Desired velocity toward target
        this._scratchVelocityError = new Vector2D(0, 0);     // Difference between desired and current velocity
        this._scratchLateralCorrection = new Vector2D(0, 0); // Correction for perpendicular velocity
        this._scratchVelocityPerpendicular = new Vector2D(0, 0); // Perpendicular component of current velocity
        this._scratchDesiredVelocity = new Vector2D(0, 0);   // Final desired velocity after corrections
        this._scratchTemp = new Vector2D(0, 0);              // Temporary vector for intermediate calculations
        this._scratchFuturePosition = new Vector2D(0, 0);    // Predicted future position of the target
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
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
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
        // Pre-allocated scratch vectors for allocation-free updates
        this._scratchDistanceToTarget = new Vector2D(0, 0);
        this._scratchVelocityError = new Vector2D();
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
        this.subPilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
        this.subPilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase, landing initiation, and completion.
     * Restarts the sub-pilot if the ship overshoots and can't land yet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;

        if (this.subPilot && this.subPilot.active) {
            // Delegate to sub-pilot for approaching the planet
            this.subPilot.update(deltaTime);
            if (this.subPilot.isComplete()) {
                if (this.subPilot.error) {
                    this.error = this.subPilot.error;
                    this.stop();
                    return;
                }
                this.subPilot = null; // Sub-pilot done, proceed to landing check
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
                this.subPilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
                this.subPilot.start();
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
        if (this.ship.state === 'Landing') {
            return `Landing on ${this.target.name || 'planet'} (Animating)`;
        }
        return `Landing on ${this.target.name || 'planet'}`;
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
        // Pre-allocated scratch vectors for allocation-free updates
        this._scratchDistanceToTarget = new Vector2D(0, 0);
        this._scratchTemp = new Vector2D(0, 0);
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
        this.subPilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
        this.subPilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase, hyperjump initiation, and jump completion.
     * Restarts the sub-pilot if the ship is not aligned with the gate.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;

        if (this.subPilot && this.subPilot.active) {
            // Delegate to sub-pilot to approach the jump gate
            this.subPilot.update(deltaTime);
            if (this.subPilot.isComplete()) {
                if (this.subPilot.error) {
                    this.error = this.subPilot.error;
                    this.stop();
                    return;
                }
                this.subPilot = null; // Sub-pilot done, proceed to jump phase
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
                this.subPilot = new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED * 0.9, Ship.LANDING_SPEED * 2);
                this.subPilot.start();
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
        if (this.subPilot) this.subPilot.stop();
        super.stop();
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string indicating jump progress.
     */
    getStatus() {
        if (this.ship.debug) {
            let status = `${this.target.name || 'jump gate'}`;
            if (this.subPilot && this.subPilot.active) {
                status += `, ${this.subPilot.constructor.name}: ${this.subPilot.getStatus()}`;
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
     * @param {Ship} ship - The ship to control.
     * @param {Ship} escortedShip - The ship to escort.
     * @param {number} [followDistance=250] - The distance to maintain while following.
     */
    constructor(ship, escortedShip, followDistance = 250) {
        super(ship, escortedShip);
        this.followDistance = followDistance;
        this.state = 'Idle';
        this.waitTime = 0;

        // Pre-allocated scratch vectors for allocation-free updates
        this._scratchDirectionToTarget = new Vector2D(0, 0);
        this._scratchDistanceToTarget = new Vector2D(0, 0); // Unused but kept for consistency

        // Constants for behavior tuning
        this.waitTimeMin = 2; // Minimum wait time after landing (seconds)
        this.waitTimeMax = 5; // Maximum wait time after landing (seconds)

        // State handlers for autopilot behavior
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
     * Starts the autopilot, ensuring the target is a ship in the same star system.
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
     * Updates the autopilot's behavior based on the current state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;

        // Check if escorted ship is still present
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
     * Handles the Idle state: initiates following or takeoff based on escorted ship's state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateIdle(deltaTime) {
        if (this.ship.state === 'Landed') {
            // Take off if escorted ship is moving
            if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
                this.ship.initiateTakeoff();
                this.state = 'TakingOff';
            }
        } else if (this.ship.state === 'Flying') {
            // Start following the escorted ship
            this.subAutopilot = new FollowShipAutoPilot(this.ship, this.target, this.followDistance, 100);
            this.subAutopilot.start();
            this.state = 'Following';
        } else if (this.ship.state === 'TakingOff' || this.ship.state === 'Landing') {
            // Wait for animation to compelte
        } else {
            console.warn(`Invalid ship state '${this.ship.state}' in EscortAutoPilot updateIdle`);
        }
    }

    /**
     * Handles the Following state: follows the escorted ship and reacts to its actions (landing, jumping).
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateFollowing(deltaTime) {
        if (!this.subAutopilot) {
            console.warn('Sub-autopilot not set during Following state');
            this.state = 'Idle';
            return;
        }

        // React to escorted ship jumping out
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

        // React to escorted ship landing
        if (this.target.state === 'Landed' || this.target.state === 'Landing') {
            this.subAutopilot.stop();
            this.subAutopilot = new LandOnPlanetAutoPilot(this.ship, this.target.landedObject);
            this.subAutopilot.start();
            this.state = 'Landing';
            return;
        }

        // React to escorted ship jumping to another system
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

        // Continue following
        this.subAutopilot.update(deltaTime);
        if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot inactive during Following state; resetting');
            this.subAutopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the TakingOff state: waits for takeoff to complete.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateTakingOff(deltaTime) {
        if (this.ship.state === 'Flying') {
            this.state = 'Idle'; // Transition to check next action
        }
    }

    /**
     * Handles the Landing state: lands on the same body as the escorted ship, aborts if it takes off.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateLanding(deltaTime) {
        if (!this.subAutopilot) {
            console.warn('Sub-autopilot not set during Landing state');
            this.state = 'Idle';
            return;
        }

        // Abort landing if escorted ship takes off
        if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
            this.subAutopilot.stop();
            this.subAutopilot = null;
            this.state = 'Idle';
            return;
        }

        // Continue landing process
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
     * Handles the TraversingJumpGate state: jumps to the escorted ship's system.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateTraversingJumpGate(deltaTime) {
        if (!this.subAutopilot) {
            console.warn('Sub-autopilot not set during TraversingJumpGate state');
            this.state = 'Idle';
            return;
        }

        // Continue jump process
        this.subAutopilot.update(deltaTime);
        if (this.subAutopilot.isComplete()) {
            if (this.subAutopilot.error) {
                console.warn(`Jump failed: ${this.subAutopilot.error}`);
                this.subAutopilot = null;
                this.state = 'Idle';
            } else if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.starSystem) {
                this.subAutopilot = null;
                this.state = 'Idle'; // Transition to Following next frame
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
     * Handles the Waiting state: waits after landing, then resumes based on escorted ship's state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateWaiting(deltaTime) {
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            this.state = 'Idle'; // Check escorted ship's state next frame
        }
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string.
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
        // Pre-allocated scratch vectors for allocation-free updates
        this._scratchDistanceToTarget = new Vector2D(0, 0);
        this._scratchTemp = new Vector2D(0, 0);
        this._scratchVelocityError = new Vector2D(0, 0);
    }

    /**
     * Starts the autopilot, ensuring the target is an asteroid in the same system.
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
        this.subPilot = new ApproachTargetAutoPilot(
            this.ship,
            this.target,
            this.target.radius,  // finalRadius
            Ship.LANDING_SPEED * 0.9,      // arrivalSpeedMin
            Ship.LANDING_SPEED * 4,  // arrivalSpeedMax
            2,                       // velocityTolerance
            Math.PI / 6,             // thrustAngleLimit
            Ship.LANDING_SPEED,      // upperVelocityErrorThreshold
            2,                       // lowerVelocityErrorThreshold
            2                        // maxTimeToIntercept
        );
        this.subPilot.start();
    }

    /**
     * Updates the autopilot, managing the approach phase, mining initiation, and completion.
     * Restarts the sub-pilot if the ship overshoots and can't mine yet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;

        if (this.subPilot && this.subPilot.active) {
            // Delegate to sub-pilot for approaching the asteroid
            this.subPilot.update(deltaTime);
            if (this.subPilot.isComplete()) {
                if (this.subPilot.error) {
                    this.error = this.subPilot.error;
                    this.stop();
                    return;
                }
                this.subPilot = null; // Sub-pilot done, proceed to mining check
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
                    //this.ship.velocity.addInPlace(this._scratchVelocityError.multiplyInPlace(deltaTime));
                }
            } else {
                // Overshot the asteroid; restart sub-pilot to re-approach
                if (this.ship.debug) {
                    console.log(`Overshot ${this.target.name || 'asteroid'}; restarting approach phase`);
                }
                this.subPilot = new ApproachTargetAutoPilot(
                    this.ship,
                    this.target,
                    this.target.radius,  // finalRadius
                    Ship.LANDING_SPEED * 0.9,      // arrivalSpeedMin
                    Ship.LANDING_SPEED * 4,  // arrivalSpeedMax
                    2,                       // velocityTolerance
                    Math.PI / 6,             // thrustAngleLimit
                    Ship.LANDING_SPEED,      // upperVelocityErrorThreshold
                    2,                       // lowerVelocityErrorThreshold
                    2                        // maxTimeToIntercept
                );
                this.subPilot.start();
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
     * @param {number} finalRadius - Radius within which to settle and match velocity.
     * @param {number} arrivalSpeedMin - Minimum speed when near the target.
     * @param {number} arrivalSpeedMax - Maximum speed during mid-range approach.
     * @param {number} velocityTolerance - Tolerance for velocity matching completion.
     * @param {number} thrustAngleLimit - Maximum angle deviation to apply thrust.
     * @param {number} upperVelocityErrorThreshold - Upper threshold for thrust activation.
     * @param {number} lowerVelocityErrorThreshold - Lower threshold for thrust hysteresis.
     * @param {number} maxTimeToIntercept - Maximum time to predict target position.
     */
    constructor(ship, target, finalRadius, arrivalSpeedMin, arrivalSpeedMax, velocityTolerance, thrustAngleLimit, upperVelocityErrorThreshold, lowerVelocityErrorThreshold, maxTimeToIntercept) {
        super(ship, target);
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

        // Pre-allocated scratch vectors for allocation-free updates
        this._scratchFuturePosition = new Vector2D(0, 0);
        this._scratchDirectionToTarget = new Vector2D(0, 0);
        this._scratchDesiredVelocity = new Vector2D(0, 0);
        this._scratchTemp = new Vector2D(0, 0);
        this._scratchVelocityDifference = new Vector2D(0, 0);
        this._scratchVelocityError = new Vector2D(0, 0);
    }

    /**
     * Starts the autopilot, setting approach distances and validating the target.
     */
    start() {
        if (!this.target || !this.target.position) {
            this.error = 'No valid target specified';
            this.completed = true;
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
     */
    stop() {
        this.active = false;
        this.ship.applyThrust(false);
    }

    /**
     * Updates the ship's trajectory to approach the target, blending velocity based on distance.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (!this.active || !this.target || !this.target.position) {
            this.stop();
            this.error = 'Target lost or invalid';
            this.completed = true;
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
     * @returns {boolean} True if completed, false otherwise.
     */
    isComplete() {
        return this.completed;
    }

    /**
     * Returns the current status of the autopilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getStatus() {
        return `Approach ${this.completed ? 'Completed' : 'Active'}`;
    }
}