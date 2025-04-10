// pilot.js

import { Vector2D } from './vector2d.js';
import { CelestialBody, JumpGate } from './celestialBody.js';
import { remapClamp, randomBetween, normalizeAngle } from './utils.js';
import { Ship } from './ship.js';
import { TraverseJumpGateAutoPilot, FlyToTargetAutoPilot, LandOnPlanetAutoPilot, FollowShipAutoPilot, EscortAutoPilot, LandOnAsteroidAutoPilot, ApproachTargetAutoPilot } from './autopilot.js';
import { Asteroid } from './asteroidBelt.js';
import { GameObject } from './gameObject.js';

export class Pilot {
    constructor(ship) {
        this.ship = ship;
    }

    update(deltaTime, gameManager) {
        throw new Error("update() must be implemented by subclass");
    }

    tryHyperjump(gameManager) {
        throw new Error("tryHyperjump() must be implemented by subclass");
    }

    getState() {
        throw new Error("getState() must be implemented by subclass");
    }
}

export class PlayerPilot extends Pilot {
    constructor(ship) {
        super(ship);
        this.autopilot = null;

        // Scratch vectors to eliminate allocations in update
        this._scratchDirectionToTarget = new Vector2D();
        this._scratchDistanceToTarget = new Vector2D();
    }

    listTargetableObjects() {
        //FIXME: remove filters and remove array fill allocations
        const starSystem = this.ship.starSystem;
        const planets = starSystem.celestialBodies.filter(body => !(body instanceof JumpGate) && !body.isDespawned());
        const gates = starSystem.celestialBodies.filter(body => body instanceof JumpGate && !body.isDespawned());
        const ships = starSystem.ships.filter(ship => ship !== this.ship && !ship.isDespawned());
        const asteroids = starSystem.asteroidBelt ? starSystem.asteroidBelt.interactiveAsteroids.filter(a => !a.isDespawned()) : [];
        return [...planets, ...gates, ...ships, ...asteroids];
    }

    update(deltaTime, gameManager) {
        // Was this key presed in this frame?
        const pressed = (key) => gameManager.keys[key] && !gameManager.lastKeys[key];
        // Is thgis key held down?
        const held = (key) => gameManager.keys[key];

        //If manual controls are used
        if (pressed('ArrowLeft') || pressed('ArrowRight') || pressed('ArrowUp') || pressed('ArrowDown') || pressed('l')
        ) {
            // Disable autopilot
            if (this.autopilot?.active) {
                this.autopilot.stop();
                this.autopilot = null;
            }
            // Handle takeoff when pressing a key
            if (this.ship.state === 'Landed') {
                this.ship.initiateTakeoff();
            }
        }

        // Manual rotation and movement
        if (held('ArrowLeft')) {
            this.ship.setTargetAngle(this.ship.angle - this.ship.rotationSpeed * deltaTime);
        }
        if (held('ArrowRight')) {
            this.ship.setTargetAngle(this.ship.angle + this.ship.rotationSpeed * deltaTime);
        }
        this.ship.applyThrust(held('ArrowUp'));
        this.ship.applyBrakes(held('ArrowDown'));

        // Landing on a targeted planet ('l' key)
        if (pressed('l')) {
            if (this.ship.state === 'Flying') {
                if (this.ship.target) {
                    if (this.ship.target instanceof JumpGate) {
                        if (this.ship.target.overlapsShip(this.ship.position)) {
                            this.ship.initiateHyperjump();
                        } else {
                            this.autopilot = new TraverseJumpGateAutoPilot(this.ship, this.ship.target);
                            this.autopilot.start();
                        }
                    } else if (this.ship.target instanceof CelestialBody) {
                        if (this.ship.canLand(this.ship.target)) {
                            this.ship.initiateLanding(this.ship.target);
                        } else {
                            this.autopilot = new LandOnPlanetAutoPilot(this.ship, this.ship.target);
                            this.autopilot.start();
                        }
                    } else if (this.ship.target instanceof Asteroid) {
                        if (this.ship.canLand(this.ship.target)) {
                            this.ship.initiateLanding(this.ship.target);
                        } else {
                            this.autopilot = new LandOnAsteroidAutoPilot(this.ship, this.ship.target);
                            this.autopilot.start();
                        }
                    }
                }
            }
        }

        // Mining a targeted asteroid ('m' key)
        // if (pressed('m')) {
        //     if (this.ship.state === 'Flying' && this.ship.target) {
        //         if (this.ship.target instanceof Asteroid) {
        //             if (this.ship.canMine(this.ship.target)) {
        //                 this.ship.initiateMining(this.ship.target);
        //             } else {
        //                 this.autopilot = new LandOnAsteroidAutoPilot(this.ship, this.ship.target);
        //                 this.autopilot.start();
        //             }
        //         }
        //     }
        // }

        // Hyperjump ('j' key)
        // if (pressed('j')) {
        //     if (this.ship.state === 'Flying' && this.ship.target) {
        //         if (this.ship.target instanceof JumpGate) {
        //             this._scratchDistanceToTarget.set(this.ship.position)
        //                 .subtractInPlace(this.ship.target.position);
        //             if (this.ship.target.overlapsShip(this.ship.position)) {
        //                 this.ship.initiateHyperjump();
        //             } else {
        //                 this.autopilot = new TraverseJumpGateAutoPilot(this.ship, this.ship.target);
        //                 this.autopilot.start();
        //             }
        //         }
        //     }
        // }

        // Escort a targeted ship ('f' key)
        if (pressed('f')) {
            if (this.ship.state === 'Flying' && this.ship.target && this.ship.target instanceof Ship) {
                this.autopilot = new EscortAutoPilot(this.ship, this.ship.target);
                this.autopilot.start();
            }
        }

        if (pressed('F')) {
            if (this.ship.state === 'Flying' && this.ship.target && this.ship.target instanceof GameObject) {
                const ship = this.ship;
                const target = this.ship.target;
                const finalRadius = target.radius;
                const arrivalSpeedMin = Ship.LANDING_SPEED * 0.5;
                const arrivalSpeedMax = Ship.LANDING_SPEED;
                const velocityTolerance = arrivalSpeedMin;
                const thrustAngleLimit = Math.PI / 12;
                const upperVelocityErrorThreshold = arrivalSpeedMin;
                const lowerVelocityErrorThreshold = 1;
                const maxTimeToIntercept = 2;
                this.autopilot = new ApproachTargetAutoPilot(
                    ship,
                    target,
                    finalRadius,
                    arrivalSpeedMin,
                    arrivalSpeedMax,
                    velocityTolerance,
                    thrustAngleLimit,
                    upperVelocityErrorThreshold,
                    lowerVelocityErrorThreshold,
                    maxTimeToIntercept);
                this.autopilot.start();
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

        // Target selection ('t' and 'T' keys)
        if (pressed('t')) {
            const targets = this.listTargetableObjects();
            if (targets.length > 0) {
                const currentIndex = targets.indexOf(this.ship.target);
                const nextIndex = (currentIndex + 1) % targets.length;
                this.ship.setTarget(targets[nextIndex]);
            }
        }
        if (pressed('T')) {
            const targets = this.listTargetableObjects();
            if (targets.length > 0) {
                const currentIndex = targets.indexOf(this.ship.target);
                const prevIndex = (currentIndex - 1 + targets.length) % targets.length;
                this.ship.setTarget(targets[prevIndex]);
            }
        }
    }

    getState() {
        if (this.autopilot?.active) {
            return this.autopilot.getStatus();
        }
        return 'Flying free!';
    }
}

export class AIPilot extends Pilot {
    constructor(ship, spawnPlanet) {
        super(ship);
        this.spawnPlanet = spawnPlanet;
        this.target = this.pickDestination(ship.starSystem, spawnPlanet);
        this.state = 'Idle';
        this.waitTime = 0;
        this.autopilot = null;

        this.stateHandlers = {
            'Idle': this.updateIdle.bind(this),
            'FlyingToPlanet': this.updateFlyingToPlanet.bind(this),
            'Landed': this.updateLanded.bind(this),
            'TakingOff': this.updateTakingOff.bind(this),
            'TraversingJumpGate': this.updateTraversingJumpGate.bind(this)
        };

        // Scratch vector to eliminate allocations in update
        this._scratchDirectionToTarget = new Vector2D(); // For direction calculations in updateLanded
    }

    pickDestination(starSystem, excludeBody) {
        const destinations = starSystem.celestialBodies;
        let index = Math.floor(Math.random() * destinations.length);
        let destination = destinations[index];
        let attempt = 0;
        while (destination == excludeBody || destination.type.type == 'star') {
            index = (++index) % destinations.length;
            destination = destinations[index];
            attempt++;
            if (attempt > destinations.length) {
                destination = null;
                break;
            }
        }
        if (!destination) {
            console.warn('No valid destinations found; defaulting to spawn planet');
            return excludeBody;
        }
        return destination;
    }

    update(deltaTime, gameManager) {
        if (this.ship && this.ship.starSystem && this.target && this.target.starSystem && this.ship.starSystem === this.target.starSystem) {
            this.ship.setTarget(this.target);
        }

        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        } else {
            console.warn(`No handler for state: ${this.state}`);
            this.state = 'Idle';
        }
    }

    updateIdle(deltaTime, gameManager) {
        if (!this.target) {
            this.target = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
        } else if (this.target instanceof JumpGate) {
            this.autopilot = new TraverseJumpGateAutoPilot(this.ship, this.target);
            this.autopilot.start();
            if (this.ship.state == 'Landed') {
                this.ship.initiateTakeoff();
                this.state = 'TakingOff';
            } else if (this.ship.state == 'Flying') {
                this.state = 'TraversingJumpGate';
            } else {
                console.warn(`invalid ship state! '${this.ship.state}' in AIPilot updateIdle`);
            }
        } else {
            this.autopilot = new LandOnPlanetAutoPilot(this.ship, this.target);
            this.autopilot.start();
            if (this.ship.state == 'Landed') {
                this.ship.initiateTakeoff();
                this.state = 'TakingOff';
            } else if (this.ship.state == 'Flying') {
                this.state = 'FlyingToPlanet';
            } else {
                console.warn(`invalid ship state! '${this.ship.state}' in AIPilot updateIdle`);
            }
        }
    }

    updateFlyingToPlanet(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during FlyingToPlanet state');
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                //console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.target = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
                this.autopilot = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Landed') {
                    this.state = 'Landed';
                    this.waitTime = Math.random() * 5 + 2;
                    this.autopilot = null;
                } else {
                    console.warn('Autopilot completed but ship is not landed; resetting');
                    this.autopilot = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during FlyingToPlanet state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    updateLanded(deltaTime, gameManager) {
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            this.spawnPlanet = this.target;
            this.target = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
            if (!this.target) {
                console.warn('No target found!');
                return;
            }
            this.ship.initiateTakeoff();
            this.state = 'TakingOff';
        }
    }

    updateTakingOff(deltaTime, gameManager) {
        if (this.ship.state === 'Flying') {
            this.state = 'Idle';
        }
    }

    updateTraversingJumpGate(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during TraversingJumpGate state');
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                //console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.target = this.pickDestination(this.ship.starSystem, null);
                this.autopilot = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.lane.target) {
                    this.target = this.pickDestination(this.ship.starSystem, this.target.lane.targetGate);
                    this.autopilot = null;
                    this.state = 'Idle';
                } else {
                    console.warn('Autopilot completed but jump not finished; resetting');
                    this.autopilot = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during TraversingJumpGate state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    tryHyperjump(gameManager) {
        return false;
    }

    getState() {
        if ((this.state === 'FlyingToPlanet' || this.state === 'TraversingJumpGate') && this.autopilot?.active) {
            return this.autopilot.getStatus();
        }
        return `AI: ${this.state} (Target: ${this.target?.name || 'None'})`;
    }
}

/**
 * An AI pilot that performs interdiction tasks within a star system.
 * Follows a target ship, visits planets and asteroids without landing,
 * flies to random points, and waits periodically, but never leaves the system.
 * @extends Pilot
 */
export class InterdictionAIPilot extends Pilot {
    /**
     * Creates a new InterdictionAIPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} spawnPlanet - The planet where the ship starts.
     */
    constructor(ship, spawnPlanet) {
        super(ship);
        this.spawnPlanet = spawnPlanet;
        this.target = null;
        this.state = 'Idle';
        this.waitTime = 0;
        this.followTime = 0;
        this.isFollowingInRange = false;
        this.autopilot = null;

        // State handlers for the AI's behavior
        this.stateHandlers = {
            'Idle': this.updateIdle.bind(this),
            'FollowingShip': this.updateFollowingShip.bind(this),
            'VisitingBody': this.updateVisitingBody.bind(this),
            'FlyingToRandomPoint': this.updateFlyingToRandomPoint.bind(this),
            'Waiting': this.updateWaiting.bind(this),
            'TakingOff': this.updateTakingOff.bind(this)
        };

        // Scratch vectors to eliminate allocations in update
        this._scratchDirectionToTarget = new Vector2D();
        this._scratchRandomPoint = new Vector2D();
        this._scratchDistanceToTarget = new Vector2D();
        this._scratchVelocityDifference = new Vector2D();
        this._scratchDesiredVelocity = new Vector2D(); // For slowing down in Waiting state

        // Constants for behavior tuning
        this.followDistance = 250; // Reduced from 500
        this.visitDistance = 200;
        this.waitTimeMin = 2;
        this.waitTimeMax = 5;
        this.followDuration = 10;
        this.velocityMatchThreshold = 50; // Increased from 10
        this.systemBounds = 10000;
    }

    /**
     * Picks a random ship in the system to follow, excluding itself.
     * @returns {Ship|null} The selected ship, or null if none available.
     */
    pickShipToFollow() {
        const ships = this.ship.starSystem.ships;
        let validShips = [];
        for (let i = 0; i < ships.length; i++) {
            const otherShip = ships[i];
            if (otherShip !== this.ship && !otherShip.isDespawned() && otherShip.state !== 'Landed') {
                validShips.push(otherShip);
            }
        }
        if (validShips.length === 0) return null;
        const index = Math.floor(Math.random() * validShips.length);
        return validShips[index];
    }

    /**
     * Picks a random celestial body (planet or asteroid) to visit, excluding jump gates and stars.
     * @returns {GameObject|null} The selected body, or null if none available.
     */
    pickBodyToVisit() {
        const bodies = this.ship.starSystem.celestialBodies;
        let validBodies = [];
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (!(body instanceof JumpGate) && body.type.type !== 'star' && !body.isDespawned()) {
                validBodies.push(body);
            }
        }
        const asteroids = this.ship.starSystem.asteroidBelt
            ? this.ship.starSystem.asteroidBelt.interactiveAsteroids.filter(a => !a.isDespawned())
            : [];
        validBodies = validBodies.concat(asteroids);
        if (validBodies.length === 0) return null;
        const index = Math.floor(Math.random() * validBodies.length);
        return validBodies[index];
    }

    /**
     * Generates a random point within the system bounds.
     * @returns {Vector2D} A Vector2D representing the random point.
     */
    pickRandomPoint() {
        const x = randomBetween(-this.systemBounds, this.systemBounds);
        const y = randomBetween(-this.systemBounds, this.systemBounds);
        return this._scratchRandomPoint.set(x, y);
    }

    /**
     * Updates the AI pilot's behavior based on the current state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    update(deltaTime, gameManager) {
        if (this.target) {
            this.ship.setTarget(this.target);
        } else {
            this.ship.clearTarget();
        }

        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        } else {
            console.warn(`No handler for state: ${this.state}`);
            this.state = 'Idle';
        }
    }

    /**
     * Handles the Idle state: decides the next task (follow, visit, or fly to random point).
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateIdle(deltaTime, gameManager) {
        const taskRoll = Math.random();
        if (taskRoll < 0.4) {
            this.target = this.pickShipToFollow();
            if (this.target) {
                this.autopilot = new FollowShipAutoPilot(this.ship, this.target, this.followDistance, 100);
                this.autopilot.start();
                this.followTime = this.followDuration;
                this.isFollowingInRange = false;
                if (this.ship.state === 'Landed') {
                    this.ship.initiateTakeoff();
                    this.state = 'TakingOff';
                } else if (this.ship.state === 'Flying') {
                    this.state = 'FollowingShip';
                } else if (this.ship.state === 'TakingOff') {
                    // Already in TakingOff state; wait for it to complete
                } else {
                    console.warn(`Invalid ship state '${this.ship.state}' in InterdictionAIPilot updateIdle`);
                }
            } else {
                this.updateIdle(deltaTime, gameManager);
            }
        } else if (taskRoll < 0.7) {
            this.target = this.pickBodyToVisit();
            if (this.target) {
                const arrivalDistance = this.target.radius ? this.target.radius + this.visitDistance : this.visitDistance;
                this.autopilot = new FlyToTargetAutoPilot(this.ship, this.target, arrivalDistance, 50, 100);
                this.autopilot.start();
                if (this.ship.state === 'Landed') {
                    this.ship.initiateTakeoff();
                    this.state = 'TakingOff';
                } else if (this.ship.state === 'Flying') {
                    this.state = 'VisitingBody';
                } else if (this.ship.state === 'TakingOff') {
                    // Already in TakingOff state; wait for it to complete
                } else {
                    console.warn(`Invalid ship state '${this.ship.state}' in InterdictionAIPilot updateIdle`);
                }
            } else {
                this.updateIdle(deltaTime, gameManager);
            }
        } else {
            this.target = this.pickRandomPoint();
            this.autopilot = new FlyToTargetAutoPilot(this.ship, { position: this.target }, 100, 50, 100);
            this.autopilot.start();
            if (this.ship.state === 'Landed') {
                this.ship.initiateTakeoff();
                this.state = 'TakingOff';
            } else if (this.ship.state === 'Flying') {
                this.state = 'FlyingToRandomPoint';
            } else if (this.ship.state === 'TakingOff') {
                // Already in TakingOff state; wait for it to complete
            } else {
                console.warn(`Invalid ship state '${this.ship.state}' in InterdictionAIPilot updateIdle`);
            }
        }
    }

    /**
     * Handles the FollowingShip state: follows the target ship using an autopilot.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateFollowingShip(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during FollowingShip state');
            this.state = 'Idle';
            return;
        }

        // Check if target is still valid
        if (!this.target || this.target.isDespawned() || this.target.state === 'Landed' || this.target.starSystem !== this.ship.starSystem) {
            this.autopilot.stop();
            this.autopilot = null;
            this.target = null;
            this.followTime = 0;
            this.isFollowingInRange = false;
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        // Check if we're within range and velocity-matched
        this._scratchDistanceToTarget.set(this.target.position)
            .subtractInPlace(this.ship.position);
        const distanceToTarget = this._scratchDistanceToTarget.magnitude();
        this._scratchVelocityDifference.set(this.ship.velocity)
            .subtractInPlace(this.target.velocity);
        const velocityDifference = this._scratchVelocityDifference.magnitude();

        const isInRange = distanceToTarget <= this.followDistance;
        const isVelocityMatched = velocityDifference <= this.velocityMatchThreshold;

        if (isInRange && isVelocityMatched) {
            this.isFollowingInRange = true;
            this.followTime -= deltaTime;
            if (this.followTime <= 0) {
                this.autopilot.stop();
                this.autopilot = null;
                this.target = null;
                this.followTime = 0;
                this.isFollowingInRange = false;
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
            }
        } else {
            this.isFollowingInRange = false;
        }
    }

    /**
     * Handles the VisitingBody state: flies near a celestial body using an autopilot.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateVisitingBody(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during VisitingBody state');
            this.state = 'Idle';
            return;
        }

        if (!this.target || this.target.isDespawned()) {
            this.autopilot.stop();
            this.autopilot = null;
            this.target = null;
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                //console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.autopilot = null;
                this.target = null;
                this.state = 'Idle';
            } else {
                this.autopilot = null;
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during VisitingBody state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the FlyingToRandomPoint state: flies to a random point using an autopilot.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateFlyingToRandomPoint(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during FlyingToRandomPoint state');
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                //console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.autopilot = null;
                this.target = null;
                this.state = 'Idle';
            } else {
                this.autopilot = null;
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during FlyingToRandomPoint state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the Waiting state: slows the ship to landing speed and pauses for a set duration before returning to Idle.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateWaiting(deltaTime, gameManager) {
        // Slow the ship to landing speed
        const currentSpeed = this.ship.velocity.magnitude();
        const landingSpeed = this.ship.landingSpeed || 10; // Fallback to 10 if landingSpeed is not defined
        if (currentSpeed > landingSpeed) {
            // Calculate desired velocity in the current direction, scaled to landing speed
            this._scratchDesiredVelocity.set(this.ship.velocity);
            if (currentSpeed > 0) {
                this._scratchDesiredVelocity.normalizeInPlace()
                    .multiplyInPlace(landingSpeed);
            } else {
                this._scratchDesiredVelocity.set(0, 0);
            }

            // Calculate velocity error
            this._scratchVelocityDifference.set(this._scratchDesiredVelocity)
                .subtractInPlace(this.ship.velocity);

            const velocityErrorMagnitude = this._scratchVelocityDifference.magnitude();

            let desiredAngle = this.ship.angle;
            let shouldThrust = false;

            if (velocityErrorMagnitude > 5) {
                desiredAngle = Math.atan2(this._scratchVelocityDifference.x, -this._scratchVelocityDifference.y);
                const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                desiredAngle = this.ship.angle + angleToDesired;
                shouldThrust = Math.abs(angleToDesired) < Math.PI / 12;
            } else {
                desiredAngle = Math.atan2(this.ship.velocity.x, -this.ship.velocity.y);
            }

            this.ship.setTargetAngle(desiredAngle);
            this.ship.applyThrust(shouldThrust);
        }

        // Update wait timer
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            this.target = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the TakingOff state: waits for the ship to finish taking off.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateTakingOff(deltaTime, gameManager) {
        if (this.ship.state === 'Flying') {
            this.state = 'Idle';
        }
    }

    /**
     * Placeholder for hyperjump attempts; interdiction ships do not jump.
     * @returns {boolean} Always false.
     */
    tryHyperjump(gameManager) {
        return false;
    }

    /**
     * Returns the current state of the AI pilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getState() {
        if (this.state === 'FollowingShip' && this.autopilot?.active) {
            return `Interdiction: Following ${this.target.name || 'ship'} (${this.isFollowingInRange ? 'In Range' : 'Approaching'})`;
        } else if (this.state === 'VisitingBody' && this.autopilot?.active) {
            return `Interdiction: Visiting ${this.target.name || 'body'}`;
        } else if (this.state === 'FlyingToRandomPoint' && this.autopilot?.active) {
            return `Interdiction: Flying to random point`;
        } else if (this.state === 'Waiting') {
            return `Interdiction: Waiting`;
        }
        return `Interdiction: ${this.state}`;
    }
}

/**
 * An AI pilot that escorts a designated ship using the EscortAutoPilot.
 * Despawns if the escorted ship despawns.
 * @extends Pilot
 */
export class EscortAIPilot extends Pilot {
    /**
     * Creates a new EscortAIPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} escortedShip - The ship to escort.
     */
    constructor(ship, escortedShip) {
        super(ship);
        this.state = 'Following';
        this.escortedShip = escortedShip;
        this.autopilot = null;

        // Constants for behavior tuning
        this.followDistance = 250; // Distance to maintain while following

        // State handlers for autopilot behavior
        this.stateHandlers = {
            Idle: this.updateIdle.bind(this),
            Following: this.updateFollowing.bind(this),
            Despawn: this.updateDespawn.bind(this)
        };
    }

    /**
     * Finds a planet in the current system to land on
     * @returns {CelestialBody|null} The jump gate leading to the target system, or null if none found.
     */
    findPlanet() {
        const celestialBodies = this.ship.starSystem.celestialBodies;
        let planet = null;
        while (!planet) {
            planet = celestialBodies[Math.floor(Math.random() * celestialBodies.length)];
            if (planet instanceof JumpGate) {
                planet = null;
            }
        }
        return planet;
    }

    /**
     * Updates the autopilot's behavior based on the current state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if ((!this.escortedShip || this.escortedShip.isDespawned()) && this.state !== 'Despawn') {
            if (this.ship.state === 'Landed') {
                this.ship.despawn();
                this.autopilot.stop();
                this.autopilot = null;
                return;
            }
            this.escortedShip = null;
            this.autopilot.stop();
            const planet = this.findPlanet();
            this.autopilot = new LandOnPlanetAutoPilot(this.ship, planet);
            this.autopilot.start();
            this.state = 'Despawn';
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
     * Handles the Idle state: warn as this shoudlnt happen in good operation.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateIdle(deltaTime) {
        console.warn('Escore ship gone Idle', this.ship, this);
    }

    /**
     * Updates the AI pilot's behavior.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateFollowing(deltaTime, gameManager) {
        // Set the escorted ship as the target for HUD purposes
        this.ship.setTarget(this.escortedShip);

        // Start the autopilot if not already active
        if (!this.autopilot || !this.autopilot.active) {
            this.autopilot = new EscortAutoPilot(this.ship, this.escortedShip, this.followDistance);
            this.autopilot.start();
        }

        // Update the autopilot
        if (this.autopilot?.active) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                if (this.autopilot.error) {
                    console.warn(`Autopilot failed: ${this.autopilot.error}`);
                }
                this.autopilot = null;
            }
        }
    }

    /**
     * Handles the Despawn state: flies to a planet, lands and despawns
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateDespawn(deltaTime) {
        if (!this.autopilot) {
            console.warn('Autopilot not set during Despawn state');
            this.state = 'Idle';
            return;
        }

        if (this.ship.state === 'Landed') {
            this.ship.despawn();
            this.autopilot.stop();
            this.autopilot = null;
            return;
        }

        // Continue landing process
        this.autopilot.update(deltaTime);
        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                console.warn(`Landing failed: ${this.autopilot.error}`);
                this.autopilot.stop();
                this.autopilot = null;
                this.state = 'Idle';
            } else if (this.ship.state === 'Landed') {
                this.ship.despawn();
                this.autopilot.stop();
                this.autopilot = null;
            } else {
                console.warn('Landing completed but ship not landed; resetting');
                this.autopilot.stop();
                this.autopilot = null;
                this.state = 'Idle';
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot inactive but not complete during Landing state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Attempts to hyperjump if the escorted ship has jumped.
     * @returns {boolean} True if a hyperjump is initiated, false otherwise.
     */
    tryHyperjump(gameManager) {
        if (this.autopilot?.active) {
            // Delegate to the autopilot's logic
            const targetSystem = this.escortedShip.starSystem;
            const gates = this.ship.starSystem.celestialBodies.filter(body => body instanceof JumpGate && !body.isDespawned());
            for (let i = 0; i < gates.length; i++) {
                const gate = gates[i];
                if (gate.lane && gate.lane.target === targetSystem && gate.overlapsShip(this.ship.position)) {
                    this.ship.initiateHyperjump();
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Returns the current state of the AI pilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getState() {
        if (this.autopilot?.active) {
            return this.autopilot.getStatus();
        }
        return `Escort: Idle`;
    }
}

/**
 * An AI pilot that mines asteroids, returns to a home planet, and repeats the process in a loop.
 * @extends Pilot
 */
export class MiningAIPilot extends Pilot {
    /**
     * Creates a new MiningAIPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} homePlanet - The home planet to return to after mining.
     */
    constructor(ship, homePlanet) {
        super(ship);
        this.homePlanet = homePlanet;
        this.targetAsteroid = null;
        this.state = 'Idle';
        this.waitTime = 0;
        this.autopilot = null;

        // State handlers for the AI's behavior
        this.stateHandlers = {
            'Idle': this.updateIdle.bind(this),
            'FlyingToAsteroid': this.updateFlyingToAsteroid.bind(this),
            'Mining': this.updateMining.bind(this),
            'TakingOffFromAsteroid': this.updateTakingOffFromAsteroid.bind(this),
            'FlyingToHomePlanet': this.updateFlyingToHomePlanet.bind(this),
            'LandingOnHomePlanet': this.updateLandingOnHomePlanet.bind(this),
            'WaitingOnHomePlanet': this.updateWaitingOnHomePlanet.bind(this),
            'TakingOffFromHomePlanet': this.updateTakingOffFromHomePlanet.bind(this)
        };

        // Scratch vectors to eliminate allocations in update
        this._scratchDirectionToTarget = new Vector2D();

        // Constants for behavior tuning
        this.miningTime = 5; // Time to spend mining on the asteroid (seconds)
        this.waitTimeMin = 5; // Minimum time to wait on the home planet (seconds)
        this.waitTimeMax = 10; // Maximum time to wait on the home planet (seconds)
    }

    /**
     * Finds the nearest asteroid in the current system that the ship can mine.
     * @returns {Asteroid|null} The nearest asteroid, or null if none found.
     */
    findNearestAsteroid() {
        let nearestAsteroid = null;
        let minDistSquared = Infinity;
        const asteroids = this.ship.starSystem.asteroidBelt ? this.ship.starSystem.asteroidBelt.interactiveAsteroids.filter(a => !a.isDespawned()) : [];
        asteroids.forEach(asteroid => {
            const distSquared = this.ship.position.distanceSquaredTo(asteroid.position);
            if (distSquared < minDistSquared) {
                minDistSquared = distSquared;
                nearestAsteroid = asteroid;
            }
        });
        return nearestAsteroid;
    }

    /**
     * Finds the nearest asteroid in the current system that the ship can mine.
     * @returns {Asteroid|null} The nearest asteroid, or null if none found.
     */
    findRandomAsteroid() {
        let selectedAsteroid = null;
        const asteroidBelt = this.ship.starSystem.asteroidBelt;
        if (!asteroidBelt) {
            return null;
        }
        while (!selectedAsteroid) {
            selectedAsteroid = asteroidBelt.interactiveAsteroids[Math.floor(Math.random() * asteroidBelt.interactiveAsteroids.length)];
            if (selectedAsteroid.isDespawned()) {
                selectedAsteroid = null;
            }
        }
        return selectedAsteroid;
    }

    /**
     * Updates the AI pilot's behavior based on the current state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    update(deltaTime, gameManager) {
        // Check if the home planet has despawned
        if (!this.homePlanet || this.homePlanet.isDespawned()) {
            this.ship.despawn();
            return;
        }

        // Set the target for HUD purposes
        if (this.targetAsteroid) {
            this.ship.setTarget(this.targetAsteroid);
        } else if (this.state === 'FlyingToHomePlanet' || this.state === 'LandingOnHomePlanet' || this.state === 'WaitingOnHomePlanet') {
            this.ship.setTarget(this.homePlanet);
        } else {
            this.ship.clearTarget();
        }

        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        } else {
            console.warn(`No handler for state: ${this.state}`);
            this.state = 'Idle';
        }
    }

    /**
     * Handles the Idle state: decides whether to start mining or return to the home planet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateIdle(deltaTime, gameManager) {
        if (this.ship.state === 'Landed' && this.ship.landedObject instanceof CelestialBody) {
            // If on the home planet, wait before taking off
            if (this.ship.landedObject === this.homePlanet) {
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'WaitingOnHomePlanet';
            } else {
                // If landed on another planet, take off
                this.ship.initiateTakeoff();
                this.state = 'TakingOffFromHomePlanet';
            }
        } else if (this.ship.state === 'Flying') {
            if (this.targetAsteroid) {
                this.autopilot = new LandOnAsteroidAutoPilot(this.ship, this.targetAsteroid);
                this.autopilot.start();
                this.state = 'FlyingToAsteroid';
            } else {
                // No asteroids found; fly to home planet
                this.autopilot = new LandOnPlanetAutoPilot(this.ship, this.homePlanet);
                this.autopilot.start();
                this.state = 'FlyingToHomePlanet';
            }
        } else if (this.ship.state === 'TakingOff') {
            // Already in TakingOff state; wait for it to complete
        } else {
            console.warn(`Invalid ship state '${this.ship.state}' in MiningAIPilot updateIdle`, this.ship.landedObject);
            throw new Error('dead');
        }
    }

    /**
     * Handles the FlyingToAsteroid state: flies to the target asteroid using an autopilot.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateFlyingToAsteroid(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during FlyingToAsteroid state');
            this.state = 'Idle';
            return;
        }

        // Check if the asteroid has despawned
        if (!this.targetAsteroid || this.targetAsteroid.isDespawned()) {
            this.autopilot.stop();
            this.autopilot = null;
            this.targetAsteroid = null;
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.autopilot = null;
                this.targetAsteroid = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Landed' && this.ship.landedObject instanceof Asteroid) {
                    this.autopilot = null;
                    this.waitTime = this.miningTime;
                    this.state = 'Mining';
                } else {
                    console.warn('Autopilot completed but ship is not mining; resetting');
                    this.autopilot = null;
                    this.targetAsteroid = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during FlyingToAsteroid state');
            this.autopilot = null;
            this.targetAsteroid = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the Mining state: waits on the asteroid for the mining duration.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateMining(deltaTime, gameManager) {
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            this.ship.initiateTakeoff();
            this.state = 'TakingOffFromAsteroid';
        }
    }

    /**
     * Handles the TakingOffFromAsteroid state: waits for the ship to finish taking off from the asteroid.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateTakingOffFromAsteroid(deltaTime, gameManager) {
        if (this.ship.state === 'Flying') {
            // Start flying back to the home planet
            this.autopilot = new LandOnPlanetAutoPilot(this.ship, this.homePlanet);
            this.autopilot.start();
            this.state = 'FlyingToHomePlanet';
            this.targetAsteroid = null;
        }
    }

    /**
     * Handles the FlyingToHomePlanet state: flies back to the home planet using an autopilot.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateFlyingToHomePlanet(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during FlyingToHomePlanet state');
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.autopilot = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Landed' && this.ship.landedObject instanceof CelestialBody) {
                    this.autopilot = null;
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = 'WaitingOnHomePlanet';
                } else {
                    console.warn('Autopilot completed but ship is not landed; resetting');
                    this.autopilot = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during FlyingToHomePlanet state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the LandingOnHomePlanet state: waits for the ship to finish landing on the home planet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateLandingOnHomePlanet(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during LandingOnHomePlanet state');
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.autopilot = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Landed') {
                    this.autopilot = null;
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = 'WaitingOnHomePlanet';
                } else {
                    console.warn('Autopilot completed but ship is not landed; resetting');
                    this.autopilot = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during LandingOnHomePlanet state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Handles the WaitingOnHomePlanet state: waits on the home planet before taking off.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateWaitingOnHomePlanet(deltaTime, gameManager) {
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            this.targetAsteroid = this.findRandomAsteroid();
            this.ship.target = this.targetAsteroid;
            this.ship.initiateTakeoff();
            this.state = 'TakingOffFromHomePlanet';
        }
    }

    /**
     * Handles the TakingOffFromHomePlanet state: waits for the ship to finish taking off from the home planet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    updateTakingOffFromHomePlanet(deltaTime, gameManager) {
        if (this.ship.state === 'Flying') {
            this.state = 'Idle'; // Will find a new asteroid in the next update
        }
    }

    /**
     * Placeholder for hyperjump attempts; mining ships do not jump.
     * @returns {boolean} Always false.
     */
    tryHyperjump(gameManager) {
        return false;
    }

    /**
     * Returns the current state of the AI pilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getState() {
        if (this.state === 'FlyingToAsteroid' && this.autopilot?.active) {
            return `Mining: Flying to asteroid ${this.targetAsteroid?.name || ''}`;
        } else if (this.state === 'Mining') {
            return `Mining: Mining asteroid`;
        } else if (this.state === 'FlyingToHomePlanet' && this.autopilot?.active) {
            return `Mining: Returning to ${this.homePlanet.name}`;
        } else if (this.state === 'LandingOnHomePlanet' && this.autopilot?.active) {
            return `Mining: Landing on ${this.homePlanet.name}`;
        } else if (this.state === 'WaitingOnHomePlanet') {
            return `Mining: Waiting on ${this.homePlanet.name}`;
        }
        return `Mining: ${this.state}`;
    }
}