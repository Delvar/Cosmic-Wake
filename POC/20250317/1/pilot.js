// pilot.js

import { Vector2D } from './vector2d.js';
import { JumpGate } from './celestialBody.js';

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
     * Creates a new AIPilot instance.
     * @param {Ship} ship - The ship this pilot controls.
     * @param {Object} spawnPlanet - The celestial body where the ship spawned.
     */
    constructor(ship, spawnPlanet) {
        super(ship);
        this.spawnPlanet = spawnPlanet;
        this.targetPlanet = this.pickDestination(ship.starSystem, spawnPlanet);
        this.state = 'flying'; // Initial state: flying toward target
    }

    /**
     * Picks a random destination in the star system, favoring non-gate bodies 2/3 of the time.
     * @param {Object} starSystem - The current star system containing celestial bodies.
     * @param {Object} excludeBody - The body to exclude (typically the spawn planet).
     * @returns {Object} The selected destination celestial body.
     */
    pickDestination(starSystem, excludeBody) {
        const destinations = starSystem.celestialBodies.filter(body =>
            body !== excludeBody && body.type.type !== 'star'
        );
        if (Math.random() < 0.33) {
            // 1/3 chance to pick a jump gate if available
            const gates = destinations.filter(body => body instanceof JumpGate);
            return gates.length > 0 ? gates[Math.floor(Math.random() * gates.length)] :
                destinations[Math.floor(Math.random() * destinations.length)];
        }
        // Otherwise, prefer non-gate bodies
        const nonGates = destinations.filter(body => !(body instanceof JumpGate));
        return nonGates.length > 0 ? nonGates[Math.floor(Math.random() * nonGates.length)] :
            destinations[Math.floor(Math.random() * destinations.length)];
    }

    /**
     * Updates the AI ship's movement and state to reach its target destination.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} game - The game manager object providing game state.
     */
    /**
     * Updates the AI ship's movement and state to reach its target destination.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} game - The game manager object providing game state.
     */
    update(deltaTime, game) {
        const LANDING_SPEED = 10; // Adjustable landing speed threshold in units/second

        // Vector from ship to planet, aiming for the far side of the planet
        const directionToPlanet = this.targetPlanet.position.subtract(this.ship.position);
        const distanceToPlanetCenter = directionToPlanet.magnitude();
        const directionToPlanetNormalized = directionToPlanet.normalize();
        const farSideOffset = directionToPlanetNormalized.multiply(this.targetPlanet.radius * 0.5); // Aim slightly beyond the center
        const adjustedTargetPosition = this.targetPlanet.position.add(farSideOffset);
        const adjustedDirectionToPlanet = adjustedTargetPosition.subtract(this.ship.position);
        const distanceToAdjustedTarget = adjustedDirectionToPlanet.magnitude();

        // Current velocity and speed
        const currentSpeed = this.ship.velocity.magnitude();
        const currentVelocityDirection = currentSpeed > 0 ?
            this.ship.velocity.normalize() :
            directionToPlanetNormalized;

        // Set the ship's target for rendering or other purposes
        this.ship.setTarget(this.targetPlanet);

        // Check if the ship can land (within planet radius and slow enough)
        if (distanceToPlanetCenter <= this.targetPlanet.radius && currentSpeed <= LANDING_SPEED) {
            this.ship.velocity = new Vector2D(0, 0); // Stop the ship
            this.ship.applyThrust(false);
            this.ship.applyBrakes(false);
            this.lastThrustState = false;

            // Handle landing logic (same as your original code)
            this.spawnPlanet = this.targetPlanet;
            if (this.targetPlanet instanceof JumpGate) {
                // Attempt hyperjump through gate
                const currentTime = performance.now();
                const oldSystem = this.ship.starSystem;
                if (this.ship.initiateHyperjump(this.targetPlanet.lane.target, currentTime)) {
                    oldSystem.ships = oldSystem.ships.filter(ship => ship !== this.ship);
                    this.targetPlanet.lane.target.ships.push(this.ship);
                    this.targetPlanet = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
                    this.ship.setTarget(this.targetPlanet);
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
                        if (game.cameraTarget === this.ship) {
                            game.cameraTarget = game.playerShip;
                        }
                        return;
                    }
                }
                // Pick a new destination
                this.targetPlanet = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
                this.ship.setTarget(this.targetPlanet);
            }
            return;
        }

        // Calculate time to turn 180 degrees (worst-case turn)
        const timeToTurn = Math.PI / this.ship.rotationSpeed;

        // Calculate deceleration distance (distance needed to stop if thrusting opposite velocity)
        const decelerationDistance = (currentSpeed * currentSpeed) / (2 * this.ship.thrust);

        // Calculate total stopping distance (turning + decelerating), reduced to avoid falling short
        const stoppingDistance = (currentSpeed * timeToTurn * 0.9) + decelerationDistance + this.targetPlanet.radius;

        // Calculate desired velocity based on distance and stopping needs
        let desiredVelocity;
        const adjustedDirectionToPlanetNormalized = adjustedDirectionToPlanet.normalize();

        if (distanceToAdjustedTarget > stoppingDistance) {
            // Far away: aim for max speed toward the adjusted target
            desiredVelocity = adjustedDirectionToPlanetNormalized.multiply(this.ship.maxVelocity);
        } else {
            // Approaching or overshooting: need to slow down
            // Project current velocity onto direction to adjusted target
            const velocityTowardPlanet = this.ship.velocity.dot(adjustedDirectionToPlanetNormalized);
            const velocityParallel = adjustedDirectionToPlanetNormalized.multiply(velocityTowardPlanet);
            const velocityPerpendicular = this.ship.velocity.subtract(velocityParallel);

            // If close to planet but moving slowly, coast at low speed
            if (distanceToPlanetCenter < this.targetPlanet.radius * 2 && currentSpeed < LANDING_SPEED) {
                desiredVelocity = adjustedDirectionToPlanetNormalized.multiply(LANDING_SPEED); // Coast at landing speed
            } else if (velocityTowardPlanet > 0 && distanceToAdjustedTarget < stoppingDistance * 1.5) {
                // Moving toward planet and need to decelerate
                desiredVelocity = currentVelocityDirection.multiply(-currentSpeed * 0.3); // Reduced cancellation to avoid stopping short
            } else {
                // Approaching: slow down to reach landing speed at the planet's radius
                const targetSpeed = Math.sqrt(
                    LANDING_SPEED * LANDING_SPEED +  // Landing speed threshold
                    2 * this.ship.thrust * (distanceToPlanetCenter - this.targetPlanet.radius)
                );
                desiredVelocity = adjustedDirectionToPlanetNormalized.multiply(Math.max(0, targetSpeed - currentSpeed * 0.3));
            }

            // Correct lateral velocity (perpendicular component)
            const lateralSpeed = velocityPerpendicular.magnitude();
            if (lateralSpeed > LANDING_SPEED) { // Use landing speed as threshold for lateral correction
                const lateralCorrection = velocityPerpendicular.normalize().multiply(-lateralSpeed * 0.5);
                desiredVelocity = desiredVelocity.add(lateralCorrection);
            }
        }

        // Calculate the velocity error (difference between desired and current velocity)
        const velocityError = desiredVelocity.subtract(this.ship.velocity);
        const velocityErrorMagnitude = velocityError.magnitude();

        // If velocity error is negligible, no action needed
        const epsilon = this.ship.thrust * deltaTime * 0.1;
        if (velocityErrorMagnitude < epsilon) {
            this.ship.setTargetAngle(this.ship.angle); // Maintain current angle
            this.ship.applyThrust(false);
            this.ship.applyBrakes(false);
            this.lastThrustState = false;
            return;
        }

        // Calculate the desired facing direction to correct velocity error
        const desiredFacingDirection = velocityError.normalize();

        // Calculate the desired angle from the desired facing direction
        const desiredAngle = Math.atan2(desiredFacingDirection.y, desiredFacingDirection.x);

        // Set the target angle for the ship to rotate toward
        this.ship.setTargetAngle(desiredAngle);

        // Determine dynamic maxThrustAngleDifference based on distance
        const MAX_THRUST_ANGLE_FAR = Math.PI / 4; // ~30 degrees when far
        const MAX_THRUST_ANGLE_CLOSE = Math.PI / 18; // ~10 degrees when close
        const DISTANCE_THRESHOLD = stoppingDistance * 2; // Transition distance (adjustable)
        const distanceRatio = Math.min(1, Math.max(0, distanceToAdjustedTarget / DISTANCE_THRESHOLD));
        const maxThrustAngleDifference = MAX_THRUST_ANGLE_CLOSE + (MAX_THRUST_ANGLE_FAR - MAX_THRUST_ANGLE_CLOSE) * distanceRatio;

        // Determine if thrust should be applied
        const currentAngle = this.ship.angle;
        const angleDifference = (desiredAngle - currentAngle + Math.PI) % (2 * Math.PI) - Math.PI;

        // Apply hysteresis to prevent rapid thrust switching
        const shouldThrust = this.lastThrustState ?
            Math.abs(angleDifference) < maxThrustAngleDifference * 1.5 : // Wider tolerance to maintain thrust
            Math.abs(angleDifference) < maxThrustAngleDifference; // Stricter tolerance to start thrust

        // Apply thrust state and update last thrust state
        this.ship.applyThrust(shouldThrust);
        this.lastThrustState = shouldThrust;

        // No braking needed (since there's no drag, deceleration is handled by turning and thrusting)
        this.ship.applyBrakes(false);
    }

    /**
     * AI pilots do not perform hyperjumps in this implementation.
     * @param {Object} game - The game manager object (unused).
     * @returns {boolean} Always false.
     */
    tryHyperjump(game) {
        return false;
    }
}