// pilot.js

import { Vector2D } from './vector2d.js';
import { JumpGate } from './celestialBody.js';
import { remapClamp } from './utils.js';
import { FlyToTargetAutoPilot, LandOnPlanetAutoPilot } from './autopilot.js';
import { Ship } from './ship.js';

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
 * @extends Pilot
 */
export class PlayerPilot extends Pilot {
    /**
     * Creates a new PlayerPilot instance.
     * @param {Ship} ship - The ship this pilot controls.
     */
    constructor(ship) {
        super(ship);
        this.autopilot = null;
    }

    /**
     * Lists targetable objects in the ship's star system.
     * @returns {Array} Array of targetable game objects (planets, gates, ships, asteroids).
     */
    listTargetableObjects() {
        const starSystem = this.ship.starSystem;
        const planets = starSystem.celestialBodies.filter(body => !(body instanceof JumpGate) && !body.isDespawned());
        const gates = starSystem.celestialBodies.filter(body => body instanceof JumpGate && !body.isDespawned());
        const ships = starSystem.ships.filter(ship => ship !== this.ship && !ship.isDespawned());
        const asteroids = starSystem.asteroidBelt ? starSystem.asteroidBelt.interactiveAsteroids.filter(a => !a.isDespawned()) : [];
        return [...planets, ...gates, ...ships, ...asteroids];
    }

    /**
     * Updates the player's ship based on input and autopilot state.
     * @param {number} deltaTime - Time elapsed since last update in seconds.
     * @param {GameManager} gameManager - The game manager instance for input and state.
     */
    update(deltaTime, gameManager) {
        const keys = gameManager.keys;
        const lastKeys = gameManager.lastKeys;

        // Interrupt autopilot if movement keys are pressed
        if (keys['ArrowLeft'] || keys['ArrowRight'] || keys['ArrowUp'] || keys['ArrowDown']) {
            if (this.autopilot?.active) {
                this.autopilot.stop();
                this.autopilot = null;
            }
        }

        // Manual controls
        if (keys['ArrowLeft']) {
            this.ship.setTargetAngle(this.ship.targetAngle - this.ship.rotationSpeed * deltaTime);
        }
        if (keys['ArrowRight']) {
            this.ship.setTargetAngle(this.ship.targetAngle + this.ship.rotationSpeed * deltaTime);
        }
        this.ship.applyThrust(keys['ArrowUp']);
        this.ship.applyBrakes(keys['ArrowDown']);

        // Landing automation with 'L'
        if (keys['l'] && !lastKeys['l']) {
            if (this.ship.state === 'Flying' && this.ship.target) {
                if (!(this.ship.target instanceof JumpGate)) {
                    if (this.ship.canLand(this.ship.target)) {
                        this.ship.initiateLanding(this.ship.target);
                    } else {
                        this.autopilot = new LandOnPlanetAutoPilot(this.ship, this.ship.target);
                        this.autopilot.start();
                    }
                }
            } else if (this.ship.state === 'Landed') {
                if (this.ship.target) {
                    const directionToTarget = this.ship.target.position.subtract(this.ship.position);
                    this.ship.setTargetAngle(Math.atan2(directionToTarget.y, directionToTarget.x));
                }
                this.ship.initiateTakeoff();
            }
        }

        // Update autopilot if active
        if (this.autopilot?.active) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                if (this.autopilot.error) {
                    console.warn(`Autopilot failed: ${this.autopilot.error}`);
                }
                this.autopilot = null;
            }
        }

        // Target selection with 'T' and 'Shift + T'
        if (keys['t'] && !lastKeys['t']) {
            const targets = this.listTargetableObjects(gameManager);
            if (targets.length > 0) {
                const currentIndex = targets.indexOf(this.ship.target);
                const nextIndex = (currentIndex + 1) % targets.length;
                this.ship.setTarget(targets[nextIndex]);
            }
        }
        if (keys['T'] && !lastKeys['T']) {
            const targets = this.listTargetableObjects(gameManager);
            if (targets.length > 0) {
                const currentIndex = targets.indexOf(this.ship.target);
                const prevIndex = (currentIndex - 1 + targets.length) % targets.length;
                this.ship.setTarget(targets[prevIndex]);
            }
        }

        // Hyperjump
        if (keys['j'] && !lastKeys['j']) {
            this.ship.initiateHyperjump();
        }
    }
}

/**
 * An AI-controlled pilot that navigates to planets or jump gates autonomously.
 * @extends Pilot
 */
export class AIPilot extends Pilot {
    /**
     * Creates a new AIPilot instance with customizable behavior parameters.
     * @param {Ship} ship - The ship this pilot controls.
     * @param {CelestialBody} spawnPlanet - The celestial body where the ship spawned.
     * @param {number} [turnTimeFactor=1] - Factor to adjust turn time sensitivity.
     * @param {number} [decelerationFactor=1] - Factor to adjust deceleration strength.
     * @param {number} [coastingDistanceMultiplier=4] - Multiplier for coasting distance.
     * @param {number} [maxThrustAngleFar=Math.PI / 6] - Max thrust angle when far (radians).
     * @param {number} [maxThrustAngleClose=Math.PI / 18] - Max thrust angle when close (radians).
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
        this.currentState = 'Idle';
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
     * Sets the AIPilot's current state and logs it if debug is enabled.
     * @param {string} currentState - The new state.
     */
    setCurrentState(currentState) {
        if (this.currentState !== currentState && this.ship.debug) {
            console.log(currentState);
        }
        this.currentState = currentState;
    }

    /**
     * Updates the AI ship's movement and state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager providing game state.
     */
    update(deltaTime, gameManager) {
        const CLOSE_APPROACH_SPEED = 30;
        let state = 'Unknown';

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
                this.ship.setTargetAngle(Math.atan2(directionToTarget.y, directionToTarget.x));
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
        directionToPlanet.normalizeInPlace();
        const currentSpeed = this.ship.velocity.magnitude();
        const velocityTowardPlanet = this.ship.velocity.dot(directionToPlanet);
        const velocityParallel = directionToPlanet.multiply(velocityTowardPlanet);
        const velocityPerpendicular = this.ship.velocity.subtract(velocityParallel);
        const lateralSpeed = velocityPerpendicular.magnitude();

        const decelerationDistance = (currentSpeed * currentSpeed - Ship.LANDING_SPEED * Ship.LANDING_SPEED) / (2 * this.ship.thrust);
        this.decelerationDistance = decelerationDistance;

        if (this.targetPlanet instanceof JumpGate && distanceToPlanetCenter <= this.targetPlanet.radius) {
            state = 'Jumping:';
            if (this.targetPlanet.overlapsShip(this.ship.position)) {
                if (this.ship.initiateHyperjump()) {
                    state += ' Initiating';
                    this.targetPlanet = this.pickDestination(this.targetPlanet.lane.target, this.targetPlanet.lane.targetGate);
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

        if (distanceToPlanetCenter <= this.targetPlanet.radius) {
            state = 'Landing:';
            if (this.ship.canLand(this.targetPlanet)) {
                this.ship.initiateLanding(this.targetPlanet);
                this.landWaitTime = Math.random() * 5 + 2;
                state += ' Initiating';
            } else {
                state += 'Slowing down';
                const velocityError = this.ship.velocity.multiply(-1);
                this.velocityError.set(velocityError);
                const desiredAngle = Math.atan2(velocityError.y, velocityError.x);
                const angleToDesired = normalizeAngleDiff(desiredAngle - this.ship.angle);
                const shouldThrust = Math.abs(angleToDesired) < Math.PI / 12;
                this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                this.ship.applyThrust(shouldThrust);
            }
            this.setCurrentState(state);
            return;
        }

        const timeToTurn = Math.PI / this.ship.rotationSpeed;
        const maxDecelerationDistance = (this.ship.maxVelocity * this.ship.maxVelocity - Ship.LANDING_SPEED * Ship.LANDING_SPEED) / (2 * this.ship.thrust);
        const maxDistanceWhileTurning = this.ship.maxVelocity * timeToTurn;
        this.farApproachDistance = maxDecelerationDistance + maxDistanceWhileTurning;
        this.closeApproachDistance = Ship.LANDING_SPEED * 5 + this.targetPlanet.radius + (Ship.LANDING_SPEED * timeToTurn);

        let desiredAngle = this.ship.angle;
        let shouldThrust = false;

        if (distanceToPlanetCenter > this.farApproachDistance) {
            state = 'Far Away: ';
            const desiredSpeed = this.ship.maxVelocity;
            const targetVelocity = directionToPlanet.multiply(desiredSpeed);
            let desiredVelocity = targetVelocity;
            if (lateralSpeed > 5) {
                state += 'lateralSpeed > 5 ';
                const lateralCorrectionFactor = Math.min(1, lateralSpeed / 10);
                const lateralCorrection = velocityPerpendicular.normalize().multiply(-lateralSpeed * lateralCorrectionFactor);
                desiredVelocity = targetVelocity.add(lateralCorrection);
                desiredVelocity.normalizeInPlace().multiplyInPlace(desiredSpeed);
            }

            const velocityError = desiredVelocity.subtract(this.ship.velocity);
            this.velocityError.set(velocityError);
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
            const stoppingDistance = decelerationDistance + ((currentSpeed - CLOSE_APPROACH_SPEED) * timeToTurn);
            let desiredVelocity;

            const angleToReverseVelocity = normalizeAngleDiff(Math.atan2(-this.ship.velocity.y, -this.ship.velocity.x) - this.ship.angle);
            const isFacingAway = Math.abs(angleToReverseVelocity) < Math.PI / 6;
            if (velocityTowardPlanet > 0 && isFacingAway && decelerationDistance < (distanceToPlanetCenter - this.targetPlanet.radius)) {
                desiredVelocity = this.ship.velocity;
                desiredAngle = Math.atan2(-this.ship.velocity.y, -this.ship.velocity.x);
                shouldThrust = false;
                state += 'Coasting On Track';
            } else if (stoppingDistance > distanceToClose && currentSpeed > CLOSE_APPROACH_SPEED * 1.2) {
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
                const desiredSpeed = Math.max(CLOSE_APPROACH_SPEED, CLOSE_APPROACH_SPEED + (distanceToClose / maxDecelerationDistance) * (this.ship.maxVelocity - CLOSE_APPROACH_SPEED));
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
            this.velocityError.set(velocityError);
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
            const finalSpeed = remapClamp(distanceToPlanetCenter, 0, this.closeApproachDistance, Ship.LANDING_SPEED, CLOSE_APPROACH_SPEED);
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
            this.velocityError.set(velocityError);
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