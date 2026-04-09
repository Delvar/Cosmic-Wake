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

        return destinations[Math.floor(Math.random() * destinations.length)];
        // if (Math.random() < 0.33) {
        //     // 1/3 chance to pick a jump gate if available
        //     const gates = destinations.filter(body => body instanceof JumpGate);
        //     return gates.length > 0 ? gates[Math.floor(Math.random() * gates.length)] :
        //         destinations[Math.floor(Math.random() * destinations.length)];
        // }
        // Otherwise, prefer non-gate bodies
        // const nonGates = destinations.filter(body => !(body instanceof JumpGate));
        // return nonGates.length > 0 ? nonGates[Math.floor(Math.random() * nonGates.length)] :
        //     destinations[Math.floor(Math.random() * destinations.length)];
    }

    /**
     * Updates the AI ship's movement and state to reach its target destination.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} game - The game manager object providing game state.
     */
    originalUpdate(deltaTime, game) {
        const relativePosition = this.targetPlanet.position.subtract(this.ship.position);
        const distance = relativePosition.magnitude();
        const speed = this.ship.velocity.magnitude();

        this.ship.setTarget(this.targetPlanet);

        // Check if ship has reached the target
        if (distance < this.targetPlanet.radius && speed < 0.5) {
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

        // Calculate stopping distance and direction
        const timeToTurn = Math.PI / this.ship.rotationSpeed;
        const stopDistance = (timeToTurn * speed) + (speed * speed) / (2 * this.ship.thrust);

        let relativeDirection = distance > 0 ? relativePosition.divide(distance) : new Vector2D(1, 0);
        let velocityDirection = speed > 0 ? this.ship.velocity.divide(speed) : relativeDirection;

        const dot = relativeDirection.dot(velocityDirection);

        // Switch between flying and landing states
        if (stopDistance * 1.5 > distance && dot > 0.5) {
            if (this.state !== 'landing') this.state = 'landing';
        } else {
            if (this.state !== 'flying') this.state = 'flying';
        }

        // Calculate thrust direction
        const velToward = dot * speed;
        const velTowardVec = relativeDirection.multiply(velToward);
        const velPerp = this.ship.velocity.subtract(velTowardVec);
        let thrustVec = this.state === 'flying' ? relativePosition.subtract(velPerp) : velocityDirection.multiply(-1);
        const thrustAngle = Math.atan2(thrustVec.y, thrustVec.x);

        this.ship.setTargetAngle(thrustAngle);

        // Determine if thrust should be applied
        const angleDiff = (thrustAngle - this.ship.angle + Math.PI) % (2 * Math.PI) - Math.PI;
        let thrusting = false;
        if (this.state === 'landing') {
            if (stopDistance > distance + this.targetPlanet.radius && Math.abs(angleDiff) < Math.PI * 0.25) {
                thrusting = true;
            }
        } else if (this.state === 'flying') {
            if (Math.abs(angleDiff) < Math.PI * 0.75) {
                thrusting = true;
            }
        }

        this.ship.applyThrust(thrusting);
        this.ship.applyBrakes(false);
    }
    GROK001update(deltaTime, game) {
        // Vector from ship to planet
        const relativePosition = this.targetPlanet.position.subtract(this.ship.position);
        const distance = relativePosition.magnitude();
        const targetDirection = relativePosition.normalize();

        // Current velocity and speed
        const velocity = this.ship.velocity;
        const speed = velocity.magnitude();
        const velocityDirection = speed > 0 ? velocity.normalize() : targetDirection;

        // Check if landed
        if (distance < this.targetPlanet.radius && speed < 0.5) {
            this.ship.velocity.set(0, 0); // Stop the ship
            // Handle landing logic...
            return;
        }

        // Desired speed decreases as we get closer (arrive behavior)
        const maxSpeed = this.ship.maxSpeed; // e.g., 100 units/sec
        const slowingDistance = 500; // Distance at which to start slowing (tune this)
        const desiredSpeed = Math.min(maxSpeed, (distance / slowingDistance) * maxSpeed);

        // Decompose velocity into parallel and perpendicular components
        const dot = velocityDirection.dot(targetDirection);
        const parallelSpeed = speed * dot; // Speed toward/away from target
        const lateralSpeed = speed * Math.sqrt(1 - dot * dot); // Speed sideways (approximation)

        // Always steer toward the target
        const desiredAngle = Math.atan2(targetDirection.y, targetDirection.x);
        this.ship.setTargetAngle(desiredAngle);

        // Decide whether to thrust
        const currentAngle = this.ship.angle;
        const angleDiff = (desiredAngle - currentAngle + Math.PI) % (2 * Math.PI) - Math.PI;
        const alignmentThreshold = Math.PI * 0.5; // 90 degrees, wide tolerance
        let thrusting = false;

        // Thrust if aligned and need to adjust speed or correct lateral motion
        if (Math.abs(angleDiff) < alignmentThreshold) {
            if (parallelSpeed < desiredSpeed || lateralSpeed > 10) { // Tune lateralSpeed threshold
                thrusting = true;
            }
        }

        // Apply controls
        this.ship.applyThrust(thrusting);
        this.ship.applyBrakes(false); // Brakes could be used if overshooting persists
    }
    GROK002update(deltaTime, game) {
        const maxAngleMaxDistance = 500;

        const relativePosition = this.targetPlanet.position.subtract(this.ship.position);
        const distance = relativePosition.magnitude();
        const speed = this.ship.velocity.magnitude();

        // Landing check
        if (distance < this.targetPlanet.radius && speed < 50) {
            // Handle landing (e.g., stop ship)
            this.ship.velocity = new Vector2D(0, 0);
            this.ship.applyThrust(false);
            this.spawnPlanet = this.targetPlanet;
            this.targetPlanet = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
            this.ship.setTarget(this.targetPlanet);
            return;
        }

        const targetDir = relativePosition.normalize();
        const velocityDir = speed > 0 ? this.ship.velocity.normalize() : targetDir;
        //const stopDistance = speed * (Math.PI / this.ship.rotationSpeed) + (speed * speed) / (2 * this.ship.thrust) * (1 - this.ship.drag) * 0.5;
        const stopDistance = (speed * speed) / (2 * this.ship.thrust) * (1 - this.ship.drag);

        let desiredAngle;

        if (distance > stopDistance) {
            // Phase 1 & 2: Approach and align
            const correctionThreshold = 1000; // Distance where corrections start (tune this)
            const correctionFactor = Math.max(0, 1 - distance / correctionThreshold);
            //const targetDir = targetPos.subtract(shipPos).normalize();
            const lateralVel = this.ship.velocity.subtract(targetDir.multiply(this.ship.velocity.dot(targetDir)));
            const desiredDir = targetDir.subtract(lateralVel.normalize().multiply(0.5 * correctionFactor)).normalize();
            desiredAngle = Math.atan2(desiredDir.y, desiredDir.x);

            // Thrust if within tolerance (lenient when far)
            const angleDiff = (desiredAngle - this.ship.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            const maxAngle = Math.PI / 4 * Math.min(1, distance / maxAngleMaxDistance); // Threshold = 100 units
            this.ship.applyThrust(Math.abs(angleDiff) < maxAngle);
        } else {
            // Phase 3: Decelerate
            desiredAngle = Math.atan2(-velocityDir.y, -velocityDir.x);

            // Check if stopping point is within radius
            const stopPoint = this.ship.position.add(this.ship.velocity.multiply(Math.PI / this.ship.rotationSpeed));
            const distToStop = stopPoint.subtract(this.targetPlanet.position).magnitude();
            if (distToStop > this.targetPlanet.radius) {
                // Adjust laterally
                const correctionDir = targetDir;
                desiredAngle = Math.atan2(
                    -velocityDir.y * 0.7 + correctionDir.y * 0.3,
                    -velocityDir.x * 0.7 + correctionDir.x * 0.3
                );
            }

            const angleDiff = (desiredAngle - this.ship.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.ship.applyThrust(Math.abs(angleDiff) < Math.PI / 4);
        }

        // Phase 4: Restart if stopped short
        if (speed < 5 && distance > this.targetPlanet.radius) {
            desiredAngle = Math.atan2(targetDir.y, targetDir.x);
            const angleDiff = (desiredAngle - this.ship.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.ship.applyThrust(Math.abs(angleDiff) < Math.PI / 4);
        }

        this.ship.setTargetAngle(desiredAngle);
        this.ship.applyBrakes(false); // No drag, so brakes off
    }

    GROK003update(deltaTime, game) {
        // Vector from ship to planet
        const directionToPlanet = this.targetPlanet.position.subtract(this.ship.position);
        const distanceToPlanet = directionToPlanet.magnitude();

        // Current velocity and speed
        const currentSpeed = this.ship.velocity.magnitude();

        // Set the ship's target for rendering or other purposes
        this.ship.setTarget(this.targetPlanet);

        // Check if the ship can land (within planet radius and slow enough)
        if (distanceToPlanet <= this.targetPlanet.radius && currentSpeed <= 0.5) {
            this.ship.velocity = new Vector2D(0, 0); // Stop the ship
            this.ship.applyThrust(false);
            this.ship.applyBrakes(false);

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

        // Calculate the desired velocity based on distance to the planet
        const slowingDistance = (
            (this.ship.maxVelocity * this.ship.maxVelocity - 0.5 * 0.5) /
            (2 * this.ship.thrust)
        ) + this.targetPlanet.radius;
        let desiredVelocity;

        if (distanceToPlanet > slowingDistance) {
            // Far away: aim for max speed toward the planet
            desiredVelocity = directionToPlanet.normalize().multiply(this.ship.maxVelocity);
        } else if (distanceToPlanet > this.targetPlanet.radius) {
            // Approaching: slow down to reach landing speed at the planet's radius
            const targetSpeed = Math.sqrt(
                0.5 * 0.5 +  // Landing speed threshold (0.5 units/second)
                2 * this.ship.thrust * (distanceToPlanet - this.targetPlanet.radius)
            );
            desiredVelocity = directionToPlanet.normalize().multiply(targetSpeed);
        } else {
            // Inside radius: aim to stop
            desiredVelocity = new Vector2D(0, 0);
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
            return;
        }

        // Calculate the desired facing direction to correct velocity error
        const desiredFacingDirection = velocityError.normalize();

        // Calculate the desired angle from the desired facing direction
        const desiredAngle = Math.atan2(desiredFacingDirection.y, desiredFacingDirection.x);

        // Set the target angle for the ship to rotate toward
        this.ship.setTargetAngle(desiredAngle);

        // Determine if thrust should be applied
        const currentAngle = this.ship.angle;
        const angleDifference = (desiredAngle - currentAngle + Math.PI) % (2 * Math.PI) - Math.PI;
        const maxThrustAngleDifference = Math.PI / 18; // ~10 degrees, adjust for responsiveness
        const shouldThrust = Math.abs(angleDifference) < maxThrustAngleDifference;

        // Apply thrust state
        this.ship.applyThrust(shouldThrust);

        // No braking needed (since there's no drag, deceleration is handled by turning and thrusting)
        this.ship.applyBrakes(false);
    }

    GROK004update(deltaTime, game) {
        // Vector from ship to planet
        const directionToPlanet = this.targetPlanet.position.subtract(this.ship.position);
        const distanceToPlanet = directionToPlanet.magnitude();

        // Current velocity and speed
        const currentSpeed = this.ship.velocity.magnitude();
        const currentVelocityDirection = currentSpeed > 0 ?
            this.ship.velocity.normalize() :
            directionToPlanet.normalize();

        // Set the ship's target for rendering or other purposes
        this.ship.setTarget(this.targetPlanet);

        // Check if the ship can land (within planet radius and slow enough)
        if (distanceToPlanet <= this.targetPlanet.radius && currentSpeed <= 0.5) {
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

        // Calculate total stopping distance (turning + decelerating)
        const stoppingDistance = (currentSpeed * timeToTurn) + decelerationDistance + this.targetPlanet.radius;

        // Calculate desired velocity based on distance and stopping needs
        let desiredVelocity;
        const directionToPlanetNormalized = directionToPlanet.normalize();

        if (distanceToPlanet > stoppingDistance) {
            // Far away: aim for max speed toward the planet
            desiredVelocity = directionToPlanetNormalized.multiply(this.ship.maxVelocity);
        } else {
            // Approaching or overshooting: need to slow down
            // Project current velocity onto direction to planet
            const velocityTowardPlanet = this.ship.velocity.dot(directionToPlanetNormalized);
            const velocityParallel = directionToPlanetNormalized.multiply(velocityTowardPlanet);
            const velocityPerpendicular = this.ship.velocity.subtract(velocityParallel);

            // If moving away from planet or overshooting, prioritize deceleration
            if (velocityTowardPlanet > 0 && distanceToPlanet < stoppingDistance * 1.5) {
                // Aim to cancel velocity by thrusting opposite current velocity direction
                desiredVelocity = currentVelocityDirection.multiply(-currentSpeed * 0.5); // Partial cancellation to avoid oscillation
            } else {
                // Approaching: slow down to reach landing speed at the planet's radius
                const targetSpeed = Math.sqrt(
                    0.5 * 0.5 +  // Landing speed threshold (0.5 units/second)
                    2 * this.ship.thrust * (distanceToPlanet - this.targetPlanet.radius)
                );
                desiredVelocity = directionToPlanetNormalized.multiply(Math.max(0, targetSpeed - currentSpeed * 0.5));
            }

            // Correct lateral velocity (perpendicular component)
            const lateralSpeed = velocityPerpendicular.magnitude();
            if (lateralSpeed > 5) { // Threshold for lateral correction, adjustable
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

        // Determine if thrust should be applied
        const currentAngle = this.ship.angle;
        const angleDifference = (desiredAngle - currentAngle + Math.PI) % (2 * Math.PI) - Math.PI;
        const maxThrustAngleDifference = Math.PI / 12; // ~15 degrees, increased for responsiveness

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
 * Updates the AI ship's movement and state to reach its target destination.
 * @param {number} deltaTime - Time elapsed since the last update in seconds.
 * @param {Object} game - The game manager object providing game state.
 */
    GROK005update(deltaTime, game) {
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
        if (distanceToPlanetCenter <= this.targetPlanet.radius && currentSpeed <= 0.5) {
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
        const stoppingDistance = (currentSpeed * timeToTurn * 0.75) + decelerationDistance + this.targetPlanet.radius;

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
            if (distanceToPlanetCenter < this.targetPlanet.radius * 2 && currentSpeed < 5) {
                desiredVelocity = adjustedDirectionToPlanetNormalized.multiply(5); // Coast at 5 units/second
            } else if (velocityTowardPlanet > 0 && distanceToAdjustedTarget < stoppingDistance * 1.5) {
                // Moving toward planet and need to decelerate
                desiredVelocity = currentVelocityDirection.multiply(-currentSpeed * 0.3); // Reduced cancellation to avoid stopping short
            } else {
                // Approaching: slow down to reach landing speed at the planet's radius
                const targetSpeed = Math.sqrt(
                    0.5 * 0.5 +  // Landing speed threshold (0.5 units/second)
                    2 * this.ship.thrust * (distanceToPlanetCenter - this.targetPlanet.radius)
                );
                desiredVelocity = adjustedDirectionToPlanetNormalized.multiply(Math.max(0, targetSpeed - currentSpeed * 0.3));
            }

            // Correct lateral velocity (perpendicular component)
            const lateralSpeed = velocityPerpendicular.magnitude();
            if (lateralSpeed > 5) { // Threshold for lateral correction, adjustable
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

        // Determine if thrust should be applied
        const currentAngle = this.ship.angle;
        const angleDifference = (desiredAngle - currentAngle + Math.PI) % (2 * Math.PI) - Math.PI;
        const maxThrustAngleDifference = Math.PI / 12; // ~15 degrees, adjustable for responsiveness

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
 * Updates the AI ship's movement and state to reach its target destination.
 * @param {number} deltaTime - Time elapsed since the last update in seconds.
 * @param {Object} game - The game manager object providing game state.
 */
    update(deltaTime, game) {
        const LANDING_SPEED = 5; // Adjustable landing speed threshold in units/second

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

        // Determine if thrust should be applied
        const currentAngle = this.ship.angle;
        const angleDifference = (desiredAngle - currentAngle + Math.PI) % (2 * Math.PI) - Math.PI;
        const maxThrustAngleDifference = Math.PI / 12; // ~15 degrees, adjustable for responsiveness

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