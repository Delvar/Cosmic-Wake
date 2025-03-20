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
     * @param {GameManager} gameManager - The game manager object providing game state.
     */
    update(deltaTime, gameManager) {
        throw new Error("update() must be implemented by subclass");
    }

    /**
     * Attempts to perform a hyperjump. Must be overridden by subclasses.
     * @param {GameManager} gameManager - The game manager object providing game state.
     * @returns {boolean} True if hyperjump succeeds, false otherwise.
     */
    tryHyperjump(gameManager) {
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
     */
    constructor(ship) {
        super(ship);
    }

    // Add helper method for targeting
    listTargetableObjects() {
        const starSystem = this.ship.starSystem;
        const planets = starSystem.celestialBodies.filter(body => !(body instanceof JumpGate) && !body.isDespawned());
        const gates = starSystem.celestialBodies.filter(body => body instanceof JumpGate && !body.isDespawned());
        const ships = starSystem.ships.filter(ship => ship !== this.ship && !ship.isDespawned());
        const asteroids = starSystem.asteroidBelt ? starSystem.asteroidBelt.interactiveAsteroids.filter(a => !a.isDespawned()) : [];
        return [...planets, ...gates, ...ships, ...asteroids];
    }

    /**
     * Updates the ship's rotation and thrust based on player keyboard inputs.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager object (unused in this implementation).
     */
    update(deltaTime, gameManager) {
        let targetAngle = this.ship.angle;
        // Rotate ship left or right based on arrow key input
        if (gameManager.keys.ArrowLeft) {
            targetAngle -= this.ship.rotationSpeed * deltaTime;
        } else if (gameManager.keys.ArrowRight) {
            targetAngle += this.ship.rotationSpeed * deltaTime;
        }
        this.ship.setTargetAngle(targetAngle);

        // Apply thrust or brakes based on up/down arrow keys
        this.ship.applyThrust(gameManager.keys.ArrowUp);
        this.ship.applyBrakes(gameManager.keys.ArrowDown);

        // Landing and takeoff with 'L'
        if (gameManager.keys['l']) {
            if (this.ship.state === 'Flying') {
                const planet = this.ship.starSystem.celestialBodies.find(body =>
                    !(body instanceof JumpGate) && this.ship.canLand(body)
                );
                if (planet) {
                    this.ship.initiateLanding(planet);
                }
            } else if (this.ship.state === 'Landed') {
                if (this.ship.target) {
                    const directionToTarget = this.ship.target.position.subtract(this.ship.position);
                    this.ship.setTargetAngle(Math.atan2(directionToTarget.y, directionToTarget.x));
                } // Else, keep last angle
                this.ship.initiateTakeoff();
            }
        }

        // Hyperjump with 'J'
        if (gameManager.keys['j'] && !gameManager.lastKeys['j']) { // Single press
            this.ship.initiateHyperjump();
        }

        // Target selection with 'T' and 'Shift + T' on key press only
        if (gameManager.keys['t'] && !gameManager.lastKeys['t']) { // 't' pressed this frame
            const targets = this.listTargetableObjects(gameManager);
            if (targets.length > 0) {
                const currentIndex = targets.indexOf(this.ship.target);
                const nextIndex = (currentIndex + 1) % targets.length;
                this.ship.setTarget(targets[nextIndex]);
            }
        }
        if (gameManager.keys['T'] && !gameManager.lastKeys['T']) { // 'Shift + T' pressed this frame
            const targets = this.listTargetableObjects(gameManager);
            if (targets.length > 0) {
                const currentIndex = targets.indexOf(this.ship.target);
                const prevIndex = (currentIndex - 1 + targets.length) % targets.length;
                this.ship.setTarget(targets[prevIndex]);
            }
        }
    }
}

/**
 * An AI-controlled pilot that navigates to planets or jump gates autonomously.
 */
export class AIPilot extends Pilot {
    /**
     * Creates a new AIPilot instance with customizable behavior parameters.
     * @param {Ship} ship - The ship this pilot controls.
     * @param {CelestialBody} spawnPlanet - The celestial body where the ship spawned.
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
        this.landWaitTime = 0;
    }

    /**
     * Picks a random destination in the star system.
     * @param {StarSystem} starSystem - The current star system.
     * @param {CelestialBody} excludeBody - The body to exclude (spawn planet).
     * @returns {CelestialBody} The selected destination.
     */
    pickDestination(starSystem, excludeBody) {
        const destinations = starSystem.celestialBodies.filter(body =>
            body !== excludeBody && body.type.type !== 'star'
        );
        return destinations[Math.floor(Math.random() * destinations.length)];
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
     * @param {GameManager} gameManager - The game manager providing game state.
     */
    update(deltaTime, gameManager) {
        const LANDING_SPEED = 5;
        const CLOSE_APPROACH_SPEED = 30;
        let state = 'Unknown';

        //Set the ship target if it is in teh same system
        if (this.targetPlanet.starSystem === this.ship.starSystem) {
            this.ship.setTarget(this.targetPlanet);
        }

        const normalizeAngleDiff = (angleDiff) => {
            return ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;
        };

        if (this.ship.state === 'Landed') {
            state = 'Landed: Waiting';
            this.landWaitTime -= deltaTime;
            if (this.landWaitTime <= 0) {
                this.spawnPlanet = this.ship.landedPlanet;
                this.targetPlanet = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
                this.ship.setTarget(this.targetPlanet);
                const directionToTarget = this.targetPlanet.position.subtract(this.ship.position);
                const desiredAngle = Math.atan2(directionToTarget.y, directionToTarget.x);
                this.ship.setTargetAngle(desiredAngle);
                this.ship.initiateTakeoff();
                this.landWaitTime = 0;
            }
            this.setCurrentState(state);
            return;
        }

        if (this.ship.state !== 'Flying') {
            state = `${this.ship.state}: Waiting`;
            this.setCurrentState(state);
            return;
        }

        const directionToPlanet = this.targetPlanet.position.subtract(this.ship.position);
        const distanceToPlanetCenter = directionToPlanet.magnitude();
        const directionToPlanetNormalized = directionToPlanet.normalize();

        const currentSpeed = this.ship.velocity.magnitude();
        const velocityTowardPlanet = this.ship.velocity.dot(directionToPlanetNormalized);
        const velocityParallel = directionToPlanetNormalized.multiply(velocityTowardPlanet);
        const velocityPerpendicular = this.ship.velocity.subtract(velocityParallel);
        const lateralSpeed = velocityPerpendicular.magnitude();

        const decelerationDistance = (currentSpeed * currentSpeed - LANDING_SPEED * LANDING_SPEED) / (2 * this.ship.thrust);
        this.decelerationDistance = decelerationDistance;

        if (this.targetPlanet instanceof JumpGate && distanceToPlanetCenter <= this.targetPlanet.radius) {
            state = 'Jumping:';
            if (this.targetPlanet.overlapsShip(this.ship.position)) {
                if (this.ship.initiateHyperjump()) {
                    state += ' Initiating';
                    this.targetPlanet = this.pickDestination(this.targetPlanet.lane.target, this.targetPlanet.lane.targetGate); // Reset target in new system
                    this.ship.setTarget(this.targetPlanet);
                } else {
                    state += ' Waiting';
                }
            } else {
                state += ' Approaching';
            }
            this.setCurrentState(state);
            return;
        }

        // Check if over planet
        if (distanceToPlanetCenter <= this.targetPlanet.radius) {
            state = 'Landing:';
            if (this.ship.canLand(this.targetPlanet)) {
                this.ship.initiateLanding(this.targetPlanet);
                this.landWaitTime = Math.random() * 5 + 2; // Set wait time (2-7 seconds)
                state += ' Initiating';
            } else {
                state += 'Slowing down';
                const velocityError = this.ship.velocity.multiply(-1);
                this.velocityError = velocityError.clone();
                let desiredAngle = Math.atan2(velocityError.y, velocityError.x);
                const angleToDesired = normalizeAngleDiff(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                let shouldThrust = Math.abs(angleToDesired) < Math.PI / 12;
                this.ship.setTargetAngle(desiredAngle);
                this.ship.applyThrust(shouldThrust);
            }
            this.setCurrentState(state);
            return;
        }

        // Calculate fixed stopping parameters based on maxVelocity
        const timeToTurn = Math.PI / this.ship.rotationSpeed;

        const maxDecelerationDistance = (this.ship.maxVelocity * this.ship.maxVelocity - LANDING_SPEED * LANDING_SPEED) / (2 * this.ship.thrust);
        const maxDistanceWhileTurning = this.ship.maxVelocity * timeToTurn;
        const farApproachDistance = maxDecelerationDistance + maxDistanceWhileTurning;
        this.farApproachDistance = farApproachDistance;

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
    tryHyperjump(gameManager) {
        return false;
    }
}