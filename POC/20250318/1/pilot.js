// pilot.js

import { Vector2D } from './vector2d.js';
import { JumpGate } from './celestialBody.js';
import { remapClamp } from './utils.js';

/**
 * Base class for pilots that control ships. Subclasses must implement core methods.
 */
export class Pilot {
    /**
     * Creates a new Pilot instance.
     * @param {Ship} ship - The ship this pilot controls.
     */
    constructor(ship) {
        this.ship = ship;
    }

    /**
     * Updates the ship's state based on pilot logic. Must be overridden by subclasses.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} game - The game manager object providing game state.
     */
    update(deltaTime, game) {
        throw new Error("update() must be implemented by subclass");
    }

    /**
     * Attempts to perform a hyperjump. Must be overridden by subclasses.
     * @param {Object} game - The game manager object providing game state.
     * @returns {boolean} True if hyperjump succeeds, false otherwise.
     */
    tryHyperjump(game) {
        throw new Error("tryHyperjump() must be implemented by subclass");
    }
}

/**
 * A pilot controlled by the player using keyboard inputs.
 */
export class PlayerPilot extends Pilot {
    /**
     * Creates a new PlayerPilot instance.
     * @param {Ship} ship - The ship this pilot controls.
     * @param {Object} keys - Object tracking the state of keyboard inputs (e.g., ArrowUp, ArrowLeft).
     */
    constructor(ship, keys) {
        super(ship);
        this.keys = keys;
    }

    /**
     * Updates the ship's rotation and thrust based on player keyboard inputs.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} game - The game manager object (unused in this implementation).
     */
    update(deltaTime, game) {
        let targetAngle = this.ship.angle;
        // Rotate ship left or right based on arrow key input
        if (this.keys.ArrowLeft) {
            targetAngle -= this.ship.rotationSpeed * deltaTime;
        } else if (this.keys.ArrowRight) {
            targetAngle += this.ship.rotationSpeed * deltaTime;
        }
        this.ship.setTargetAngle(targetAngle);

        // Apply thrust or brakes based on up/down arrow keys
        this.ship.applyThrust(this.keys.ArrowUp);
        this.ship.applyBrakes(this.keys.ArrowDown);
    }

    /**
     * Attempts a hyperjump if the ship is near a jump gate.
     * @param {Object} game - The game manager object providing game state.
     * @returns {boolean} True if hyperjump succeeds, false otherwise.
     */
    tryHyperjump(game) {
        const currentTime = performance.now();
        // Find a jump gate overlapping the ship's position
        const gate = this.ship.starSystem.celestialBodies.find(body =>
            body instanceof JumpGate && body.overlapsShip(this.ship.position)
        );
        if (gate && this.ship.initiateHyperjump(gate.lane.target, currentTime)) {
            // Remove ship from current system and add to target system
            const oldSystem = gate.lane.source;
            oldSystem.ships = oldSystem.ships.filter(ship => ship !== this.ship);
            gate.lane.target.ships.push(this.ship);
            return true;
        }
        return false;
    }
}

/**
 * An AI-controlled pilot that navigates to planets or jump gates autonomously.
 */
export class AIPilot extends Pilot {
    /**
     * Creates a new AIPilot instance with customizable behavior parameters.
     * @param {Ship} ship - The ship this pilot controls.
     * @param {Object} spawnPlanet - The celestial body where the ship spawned.
     */
    constructor(
        ship,
        spawnPlanet,
        turnTimeFactor = 1,
        decelerationFactor = 1,
        coastingDistanceMultiplier = 4,
        maxThrustAngleFar = Math.PI / 6,
        maxThrustAngleClose = Math.PI / 18
    ) {
        super(ship);
        this.spawnPlanet = spawnPlanet;
        this.targetPlanet = this.pickDestination(ship.starSystem, spawnPlanet);
        this.lastThrustState = false;
        this.turnTimeFactor = turnTimeFactor;
        this.decelerationFactor = decelerationFactor;
        this.coastingDistanceMultiplier = coastingDistanceMultiplier;
        this.maxThrustAngleFar = maxThrustAngleFar;
        this.maxThrustAngleClose = maxThrustAngleClose;
        this.currentState = 'Idle'; // Initial state
        this.velocityError = new Vector2D(0, 0);
        this.closeApproachDistance = 0;
        this.farApproachDistance = 0;
        this.decelerationDistance = 0;
    }

    /**
     * Picks a random destination in the star system.
     * @param {Object} starSystem - The current star system.
     * @param {Object} excludeBody - The body to exclude (spawn planet).
     * @returns {Object} The selected destination.
     */
    pickDestination(starSystem, excludeBody) {
        const destinations = starSystem.celestialBodies.filter(body =>
            body !== excludeBody && body.type.type !== 'star'
        );
        if (Math.random() < 0.33) {
            const gates = destinations.filter(body => body instanceof JumpGate);
            return gates.length > 0 ? gates[Math.floor(Math.random() * gates.length)] :
                destinations[Math.floor(Math.random() * destinations.length)];
        }
        const nonGates = destinations.filter(body => !(body instanceof JumpGate));
        return nonGates.length > 0 ? nonGates[Math.floor(Math.random() * nonGates.length)] :
            destinations[Math.floor(Math.random() * destinations.length)];
    }

    /**
     * Sets the AIPilot currentState
     * @param {String} currentState - the new currentState
     */
    setCurrentState(currentState) {
        if (this.currentState != currentState)
            if (this.ship.debug) {
                console.log(currentState);
            }
        this.currentState = currentState;
    }

    /**
     * Updates the AI ship's movement and state.
     * @param {number} deltaTime - Time elapsed since the last update in milliseconds.
     * @param {GameManager} manager - The game manager providing game state.
     */
    update(deltaTime, manager) {
        const LANDING_SPEED = 5; // Target speed for landing
        const CLOSE_APPROACH_SPEED = 30;
        let state = 'Unknown';

        // Set the ship's target
        this.ship.setTarget(this.targetPlanet);

        // Helper function to normalize angle difference to [-π, π]
        const normalizeAngleDiff = (angleDiff) => {
            return ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;
        };

        // Calculate direction and distance to the target
        const directionToPlanet = this.targetPlanet.position.subtract(this.ship.position);
        const distanceToPlanetCenter = directionToPlanet.magnitude();
        const directionToPlanetNormalized = directionToPlanet.normalize();

        // Velocity calculations
        const currentSpeed = this.ship.velocity.magnitude();
        const velocityTowardPlanet = this.ship.velocity.dot(directionToPlanetNormalized);
        const velocityParallel = directionToPlanetNormalized.multiply(velocityTowardPlanet);
        const velocityPerpendicular = this.ship.velocity.subtract(velocityParallel);
        const lateralSpeed = velocityPerpendicular.magnitude();

        const decelerationDistance = (currentSpeed * currentSpeed - LANDING_SPEED * LANDING_SPEED) / (2 * this.ship.thrust);
        this.decelerationDistance = decelerationDistance;

        // Check if over planet
        if (distanceToPlanetCenter <= this.targetPlanet.radius) {
            state = 'Landing:';
            if (currentSpeed <= LANDING_SPEED) {
                state += 'Landed';
                this.ship.velocity = new Vector2D(0, 0);
                this.ship.applyThrust(false);
                this.ship.applyBrakes(false);


                if (this.targetPlanet instanceof JumpGate) {
                    // Attempt hyperjump through gate
                    const currentTime = performance.now();
                    const oldSystem = this.ship.starSystem;
                    if (this.ship.initiateHyperjump(this.targetPlanet.lane.target, currentTime)) {
                        oldSystem.ships = oldSystem.ships.filter(ship => ship !== this.ship);
                        this.targetPlanet.lane.target.ships.push(this.ship);
                        this.targetPlanet = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
                        this.ship.setTarget(this.targetPlanet);
                        state += 'Jump';
                        this.setCurrentState(state);
                        return;
                    }
                } else {
                    // Handle overpopulation by despawning if necessary
                    const excess = this.ship.starSystem.ships.length - this.ship.starSystem.maxAIShips;
                    if (excess > 0) {
                        const despawnChance = Math.min(1, excess * 0.1);
                        if (Math.random() < despawnChance) {
                            this.ship.starSystem.ships = this.ship.starSystem.ships.filter(ship => ship !== this.ship);
                            this.ship.clearTarget();
                            state += 'Despawn';
                            this.setCurrentState(state);
                            return;
                        }
                    }
                    // Pick a new destination
                    state += 'new destination';
                    this.spawnPlanet = this.targetPlanet;
                    this.targetPlanet = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
                    this.ship.setTarget(this.targetPlanet);
                }
                this.setCurrentState(state);
                return;
            } else {
                state += 'Slowing down';
                const velocityError = this.ship.velocity.multiply(-1);
                this.velocityError = velocityError.clone();
                let desiredAngle = Math.atan2(velocityError.y, velocityError.x);
                const angleToDesired = normalizeAngleDiff(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                let shouldThrust = false;
                if (Math.abs(angleToDesired) < Math.PI / 12) {
                    shouldThrust = true;
                }
                // Apply controls
                this.ship.setTargetAngle(desiredAngle);
                this.ship.applyThrust(shouldThrust);
                this.setCurrentState(state);
                return;
            }
        }

        // Calculate fixed stopping parameters based on maxVelocity
        const timeToTurn = Math.PI / this.ship.rotationSpeed;

        const maxDecelerationDistance = (this.ship.maxVelocity * this.ship.maxVelocity - LANDING_SPEED * LANDING_SPEED) / (2 * this.ship.thrust);
        const maxDistanceWhileTurning = this.ship.maxVelocity * timeToTurn;
        const farApproachDistance = maxDecelerationDistance + maxDistanceWhileTurning;
        this.farApproachDistance = farApproachDistance; // For debug visualization

        // Define close approach distance with timeToTurn
        const closeApproachDistance = LANDING_SPEED * 5 + this.targetPlanet.radius + (LANDING_SPEED * timeToTurn);
        this.closeApproachDistance = closeApproachDistance;

        // Control logic
        let desiredAngle = this.ship.angle;
        let shouldThrust = false;

        if (distanceToPlanetCenter > farApproachDistance) {
            state = 'Far Away: ';
            // Far Away: Accelerate toward the target at max speed, correcting lateral motion if significant
            const desiredSpeed = this.ship.maxVelocity;
            const targetVelocity = directionToPlanetNormalized.multiply(desiredSpeed);
            let desiredVelocity;
            // Add lateral correction only if lateral speed > 5
            if (lateralSpeed > 5) {
                state += 'lateralSpeed > 5 ';
                const lateralCorrectionFactor = Math.min(1, lateralSpeed / 10);
                const lateralCorrection = velocityPerpendicular.normalize().multiply(-lateralSpeed * lateralCorrectionFactor);
                desiredVelocity = targetVelocity.add(lateralCorrection).normalize().multiply(desiredSpeed);
            } else {
                desiredVelocity = targetVelocity;
            }

            // Calculate velocity error
            const velocityError = desiredVelocity.subtract(this.ship.velocity);
            this.velocityError = velocityError.clone();
            const velocityErrorMagnitude = velocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                state += 'velocityErrorMagnitude > 5 ';
                // Determine desired angle based on velocity error
                desiredAngle = Math.atan2(velocityError.y, velocityError.x);
                const angleToDesired = normalizeAngleDiff(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;

                const thrustOnThreshold = Math.PI / 4;
                if (Math.abs(angleToDesired) < thrustOnThreshold) {
                    shouldThrust = true;
                    state += 'Thrusting';
                } else {
                    shouldThrust = false;
                    state += 'Turning';
                }
            } else {
                desiredAngle = Math.atan2(this.ship.velocity.y, this.ship.velocity.x);
                shouldThrust = false;
                state += 'Coasting';
            }
        } else if (distanceToPlanetCenter > closeApproachDistance) {
            state = 'Approach: ';
            // Approach: Align velocity and decelerate to reach closeApproachDistance at CLOSE_APPROACH_SPEED
            const distanceToClose = distanceToPlanetCenter - closeApproachDistance;
            const stoppingDistance = decelerationDistance + ((currentSpeed - CLOSE_APPROACH_SPEED) * timeToTurn);
            let desiredVelocity;

            // Check if on track to stop within planet radius and facing away
            const angleToReverseVelocity = normalizeAngleDiff(Math.atan2(-this.ship.velocity.y, -this.ship.velocity.x) - this.ship.angle);
            const isFacingAway = Math.abs(angleToReverseVelocity) < Math.PI / 6; // ±30 degrees
            if (velocityTowardPlanet > 0 && isFacingAway && decelerationDistance < (distanceToPlanetCenter - this.targetPlanet.radius)) {
                // Coast if stopping distance is short enough
                desiredVelocity = this.ship.velocity; // Maintain current velocity for coasting
                desiredAngle = Math.atan2(-this.ship.velocity.y, -this.ship.velocity.x);
                shouldThrust = false;
                state += 'Coasting On Track';
            } else if (stoppingDistance > distanceToClose && currentSpeed > CLOSE_APPROACH_SPEED * 1.2) {
                // Decelerate if stopping distance exceeds available distance
                const targetVelocity = this.ship.velocity.normalize().multiply(-currentSpeed);
                if (lateralSpeed > 5) {
                    state += 'lateralSpeed > 5 ';
                    const lateralCorrectionFactor = Math.min(1, lateralSpeed / 5);
                    const lateralCorrection = velocityPerpendicular.normalize().multiply(-lateralSpeed * lateralCorrectionFactor);
                    desiredVelocity = targetVelocity.add(lateralCorrection).normalize().multiply(currentSpeed);
                } else {
                    desiredVelocity = targetVelocity;
                }
                state += 'Overshoot ';
            } else {
                // Scale speed to reach closeApproachDistance at CLOSE_APPROACH_SPEED
                const desiredSpeed = Math.max(CLOSE_APPROACH_SPEED, CLOSE_APPROACH_SPEED + (distanceToClose / maxDecelerationDistance) * (this.ship.maxVelocity - CLOSE_APPROACH_SPEED));
                const targetVelocity = directionToPlanetNormalized.multiply(desiredSpeed);
                if (lateralSpeed > 5) {
                    state += 'lateralSpeed > 5 ';
                    const lateralCorrectionFactor = Math.min(1, lateralSpeed / 5);
                    const lateralCorrection = velocityPerpendicular.normalize().multiply(-lateralSpeed * lateralCorrectionFactor);
                    desiredVelocity = targetVelocity.add(lateralCorrection).normalize().multiply(desiredSpeed);
                } else {
                    desiredVelocity = targetVelocity;
                }
                state += 'Scale Speed ';
            }

            // Calculate velocity error
            const velocityError = desiredVelocity.subtract(this.ship.velocity);
            this.velocityError = velocityError.clone();
            const velocityErrorMagnitude = velocityError.magnitude();

            if (velocityErrorMagnitude > 5) {
                state += 'velocityErrorMagnitude > 5 ';
                // Determine desired angle based on velocity error
                desiredAngle = Math.atan2(velocityError.y, velocityError.x);
                const angleToDesired = normalizeAngleDiff(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;

                const thrustOnThreshold = Math.PI / 12; // ±15 degrees to start thrusting
                if (Math.abs(angleToDesired) < thrustOnThreshold || velocityTowardPlanet < -5) {
                    shouldThrust = true;
                    state += 'Thrusting';
                } else {
                    shouldThrust = false;
                    state += 'Turning';
                }
            } else if (!shouldThrust) {
                desiredAngle = Math.atan2(-this.ship.velocity.y, -this.ship.velocity.x);
                state += 'Coasting';
            }
        } else {
            state = 'Close: ';
            // Speed ramp
            const finalSpeed = remapClamp(distanceToPlanetCenter, 0, closeApproachDistance, LANDING_SPEED, CLOSE_APPROACH_SPEED);

            // Close Approach: Slow to LANDING_SPEED, ensure velocity toward planet
            let desiredSpeed = finalSpeed;
            if (currentSpeed < finalSpeed * 0.5) {
                desiredSpeed = finalSpeed * 1.2; // Gentle push if nearly stopped
            } else if (currentSpeed > finalSpeed * 1.2) {
                desiredSpeed = -currentSpeed; // Decelerate if too fast
            }
            const targetVelocity = directionToPlanetNormalized.multiply(desiredSpeed);
            let desiredVelocity;
            // Strong lateral correction to ensure precise alignment
            if (lateralSpeed > 1) {
                state += 'lateralSpeed > 1 ';
                const lateralCorrectionFactor = Math.min(1, lateralSpeed / 5);
                const lateralCorrection = velocityPerpendicular.normalize().multiply(-lateralSpeed * lateralCorrectionFactor);
                desiredVelocity = targetVelocity.add(lateralCorrection).normalize().multiply(desiredSpeed);
            } else {
                desiredVelocity = targetVelocity;
            }

            // Calculate velocity error
            const velocityError = desiredVelocity.subtract(this.ship.velocity);
            this.velocityError = velocityError.clone();
            const velocityErrorMagnitude = velocityError.magnitude();

            if (velocityErrorMagnitude > 1) {
                state += 'velocityErrorMagnitude > 1 ';
                // Determine desired angle based on velocity error
                desiredAngle = Math.atan2(velocityError.y, velocityError.x);
                const angleToDesired = normalizeAngleDiff(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;

                const thrustOnThreshold = Math.PI / 12;
                if (Math.abs(angleToDesired) < thrustOnThreshold) {
                    shouldThrust = true;
                    state += 'Thrusting';
                } else {
                    shouldThrust = false;
                    state += 'Turning';
                }
            } else {
                desiredAngle = Math.atan2(-this.ship.velocity.y, -this.ship.velocity.x);
                shouldThrust = false;
                state += 'Coasting';
            }
        }

        // Apply controls
        this.ship.setTargetAngle(desiredAngle);
        this.ship.applyThrust(shouldThrust);
        this.setCurrentState(state);
    }

    /**
     * AI pilots do not perform hyperjumps.
     * @returns {boolean} Always false.
     */
    tryHyperjump(game) {
        return false;
    }
}