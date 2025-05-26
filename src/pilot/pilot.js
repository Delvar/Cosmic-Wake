// /src/pilot.js

import { Vector2D } from '/src/core/vector2d.js';
import { CelestialBody, JumpGate, Star, Planet } from '/src/starSystem/celestialBody.js';
import { remapClamp, randomBetween, normalizeAngle } from '/src/core/utils.js';
import { Ship } from '/src/ship/ship.js';
import { TraverseJumpGateAutopilot, LandOnPlanetAutopilot, EscortAutopilot, LandOnAsteroidAutopilot, ApproachTargetAutopilot } from '/src/autopilot/autopilot.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';

/**
 * Base class for AI and player pilots, providing a common interface for ship control.
 * @abstract
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
     * Updates the pilot's behavior based on the current game state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager instance providing input and context.
     * @throws {Error} Must be implemented by subclasses.
     */
    update(deltaTime, gameManager) {
        throw new Error("update() must be implemented by subclass");
    }

    /**
     * Returns a string describing the pilot's current status for HUD display.
     * @returns {string} The current status description.
     * @throws {Error} Must be implemented by subclasses.
     */
    getStatus() {
        throw new Error("getStatus() must be implemented by subclass");
    }
}

/**
 * A pilot controlled by a human player via browser input.
 * @extends Pilot
 */
export class PlayerPilot extends Pilot {
    /**
     * Creates a new PlayerPilot instance.
     * @param {Ship} ship - The ship controlled by the player.
     */
    constructor(ship) {
        super(ship);
        /** @type {Object|null} Active autopilot instance, if any. */
        this.autopilot = null;

        /** @type {Vector2D} Temporary vector for direction to target. */
        this._scratchDirectionToTarget = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for distance to target. */
        this._scratchDistanceToTarget = new Vector2D(0, 0);
    }

    /**
     * Selects the next or previous valid target in the star system without allocations.
     * Cycles through stars, planets, jump gates, ships, and asteroids in order.
     * @param {number} [direction=1] - 1 to move forward, -1 to move backward through the target list.
     * @returns {GameObject|null} The selected target, or null if no valid targets exist.
     */
    targetNext(direction = 1) {
        const starSystem = this.ship.starSystem;
        const arr1 = starSystem.stars;
        const length1 = arr1.length;
        const arr2 = starSystem.planets;
        const length2 = arr2.length;
        const arr3 = starSystem.jumpGates;
        const length3 = arr3.length;
        const arr4 = starSystem.ships;
        const length4 = arr4.length;
        const arr5 = starSystem.asteroids;
        const length5 = arr5.length;
        const totalLength = length1 + length2 + length3 + length4 + length5;

        if (totalLength === 0) return null;

        const target = this.ship.target;
        let currentIndex = -1;

        // Determine the current target's index across all arrays
        if (target) {
            if (target instanceof Star) {
                currentIndex = arr1.indexOf(target);
            } else if (target instanceof Planet) {
                currentIndex = length1 + arr2.indexOf(target);
            } else if (target instanceof JumpGate) {
                currentIndex = length1 + length2 + arr3.indexOf(target);
            } else if (target instanceof Ship) {
                currentIndex = length1 + length2 + length3 + arr4.indexOf(target);
            } else if (target instanceof Asteroid) {
                currentIndex = length1 + length2 + length3 + length4 + arr5.indexOf(target);
            }
        }

        // Move to the next/previous index and wrap around if needed
        currentIndex += direction;
        currentIndex = (totalLength + (currentIndex % totalLength)) % totalLength;

        let attempts = totalLength;
        let item = null;

        // Find the next valid target, skipping invalid ones
        while (attempts > 0) {
            if (currentIndex < length1) {
                item = arr1[currentIndex];
            } else if (currentIndex < length1 + length2) {
                item = arr2[currentIndex - length1];
            } else if (currentIndex < length1 + length2 + length3) {
                item = arr3[currentIndex - length1 - length2];
            } else if (currentIndex < length1 + length2 + length3 + length4) {
                item = arr4[currentIndex - length1 - length2 - length3];
            } else {
                item = arr5[currentIndex - length1 - length2 - length3 - length4];
            }

            if (isValidTarget(this.ship, item)) {
                return item;
            }

            attempts--;
            currentIndex += direction;
            currentIndex = (totalLength + (currentIndex % totalLength)) % totalLength;
        }

        return null;
    }

    /**
     * Updates the player's ship based on keyboard input and autopilot state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {Object} gameManager - The game manager with keys and lastKeys properties.
     */
    update(deltaTime, gameManager) {
        // Helper functions for key states
        const pressed = (key) => gameManager.keys[key] === true && !(gameManager.lastKeys[key] === true);
        const held = (key) => gameManager.keys[key] === true;

        // Disable autopilot and handle takeoff if manual controls are used
        if (pressed('ArrowLeft') || pressed('ArrowRight') || pressed('ArrowUp') || pressed('ArrowDown') || pressed('l')) {
            if (this.autopilot?.active) {
                this.autopilot.stop();
                this.autopilot = null;
            }
            if (this.ship.state === 'Landed') {
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
            return;
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

        // Fire weapon on Spacebar press
        if (held(' ') && this.ship.state === 'Flying') {
            this.ship.fire();
        }

        // Interact with target ('l' key)
        if (pressed('l') && this.ship.state === 'Flying' && this.ship.target) {
            if (this.ship.target instanceof JumpGate) {
                if (this.ship.target.overlapsPoint(this.ship.position)) {
                    this.ship.initiateHyperjump(this.ship.target);
                } else {
                    this.autopilot = new TraverseJumpGateAutopilot(this.ship, this.ship.target);
                    this.autopilot.start();
                }
            } else if (this.ship.target instanceof CelestialBody) {
                if (this.ship.canLand(this.ship.target)) {
                    this.ship.initiateLanding(this.ship.target);
                } else {
                    this.autopilot = new LandOnPlanetAutopilot(this.ship, this.ship.target);
                    this.autopilot.start();
                }
            } else if (this.ship.target instanceof Asteroid) {
                if (this.ship.canLand(this.ship.target)) {
                    this.ship.initiateLanding(this.ship.target);
                } else {
                    this.autopilot = new LandOnAsteroidAutopilot(this.ship, this.ship.target);
                    this.autopilot.start();
                }
            }
        }

        // Escort a targeted ship ('f' key)
        if (pressed('f') && this.ship.state === 'Flying' && this.ship.target instanceof Ship) {
            this.autopilot = new EscortAutopilot(this.ship, this.ship.target);
            this.autopilot.start();
        }

        // Approach a target with custom parameters ('F' key)
        if (pressed('F') && this.ship.state === 'Flying' && this.ship.target instanceof GameObject) {
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
            this.autopilot = new ApproachTargetAutopilot(
                ship,
                target,
                finalRadius,
                arrivalSpeedMin,
                arrivalSpeedMax,
                velocityTolerance,
                thrustAngleLimit,
                upperVelocityErrorThreshold,
                lowerVelocityErrorThreshold,
                maxTimeToIntercept
            );
            this.autopilot.start();
        }

        if (pressed('a') && this.ship.state === 'Flying' && this.ship.target instanceof GameObject) {
            this.autopilot = new AttackAutopilot(this.ship, this.ship.target);
            this.autopilot.start();
        }

        // Target selection ('t' for next, 'T' for previous)
        if (pressed('t')) {
            this.ship.setTarget(this.targetNext(1));
        }
        if (pressed('T')) {
            this.ship.setTarget(this.targetNext(-1));
        }
        if (pressed('k')) {
            this.ship.takeDamage(
                this.ship.shield.strength > 0 ? this.ship.shield.strength : this.ship.hullIntegrity,
                this.ship.position, this.ship);
        }
    }

    /**
     * Returns the current status of the player pilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getStatus() {
        if (this.autopilot?.active) {
            return this.autopilot.getStatus();
        }
        return 'Flying free!';
    }
}

// /**
//  * A basic AI pilot that travels between planets and jump gates within a star system.
//  * @extends Pilot
//  */
// export class AIPilot extends Pilot {
//     /**
//      * Creates a new AIPilot instance.
//      * @param {Ship} ship - The ship to control.
//      * @param {Planet} spawnPlanet - The planet where the ship starts.
//      */
//     constructor(ship, spawnPlanet) {
//         super(ship);
//         this.spawnPlanet = spawnPlanet;
//         this.target = this.pickDestination(ship.starSystem, spawnPlanet);
//         this.state = 'Idle';
//         this.waitTime = 0;
//         this.autopilot = null;

//         this.stateHandlers = {
//             'Idle': this.updateIdle.bind(this),
//             'FlyingToPlanet': this.updateFlyingToPlanet.bind(this),
//             'Landed': this.updateLanded.bind(this),
//             'TakingOff': this.updateTakingOff.bind(this),
//             'TraversingJumpGate': this.updateTraversingJumpGate.bind(this)
//         };

//         // Scratch vector for direction calculations
//         this._scratchDirectionToTarget = new Vector2D();
//     }

//     /**
//      * Picks a random destination (planet or jump gate) in the star system, excluding a specified body.
//      * @param {Object} starSystem - The star system containing potential destinations.
//      * @param {CelestialBody} excludeBody - The body to exclude from selection.
//      * @returns {CelestialBody|JumpGate} The chosen destination.
//      */
//     pickDestination(starSystem, excludeBody) {
//         const destination = starSystem.getRandomJumpGatePlanet(this.ship, excludeBody);
//         if (!destination) {
//             console.warn('No valid destinations found; defaulting to spawn planet');
//             return excludeBody;
//         }
//         return destination;
//     }

//     /**
//      * Updates the AI pilot's behavior based on the current state.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     update(deltaTime, gameManager) {
//         if (this.ship && this.target && this.ship.starSystem === this.target.starSystem) {
//             this.ship.setTarget(this.target);
//         }

//         const handler = this.stateHandlers[this.state];
//         if (handler) {
//             handler(deltaTime, gameManager);
//         } else {
//             console.warn(`No handler for state: ${this.state}`);
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the Idle state: initiates travel to a new target.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateIdle(deltaTime, gameManager) {
//         if (!this.target) {
//             this.target = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
//         }

//         if (this.target instanceof JumpGate) {
//             this.autopilot = new TraverseJumpGateAutopilot(this.ship, this.target);
//             this.autopilot.start();
//             if (this.ship.state === 'Landed') {
//                 this.ship.initiateTakeoff();
//                 this.state = 'TakingOff';
//             } else if (this.ship.state === 'Flying') {
//                 this.state = 'TraversingJumpGate';
//             } else {
//                 console.warn(`Invalid ship state '${this.ship.state}' in AIPilot updateIdle`);
//             }
//         } else {
//             this.autopilot = new LandOnPlanetAutopilot(this.ship, this.target);
//             this.autopilot.start();
//             if (this.ship.state === 'Landed') {
//                 this.ship.initiateTakeoff();
//                 this.state = 'TakingOff';
//             } else if (this.ship.state === 'Flying') {
//                 this.state = 'FlyingToPlanet';
//             } else {
//                 console.warn(`Invalid ship state '${this.ship.state}' in AIPilot updateIdle`);
//             }
//         }
//     }

//     /**
//      * Handles the FlyingToPlanet state: manages autopilot to reach a planet.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateFlyingToPlanet(deltaTime, gameManager) {
//         if (!this.autopilot) {
//             console.warn('Autopilot is not set during FlyingToPlanet state');
//             this.state = 'Idle';
//             return;
//         }

//         this.autopilot.update(deltaTime);

//         if (this.autopilot.isComplete()) {
//             if (this.autopilot.error) {
//                 this.target = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             } else if (this.ship.state === 'Landed') {
//                 this.state = 'Landed';
//                 this.waitTime = Math.random() * 5 + 2; // Wait 2-7 seconds
//                 this.autopilot = null;
//             } else {
//                 console.warn('Autopilot completed but ship is not landed; resetting');
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             }
//         } else if (!this.autopilot.active) {
//             console.warn('Autopilot is inactive but not complete during FlyingToPlanet state');
//             this.autopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the Landed state: waits on a planet before taking off.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateLanded(deltaTime, gameManager) {
//         this.waitTime -= deltaTime;
//         if (this.waitTime <= 0) {
//             this.spawnPlanet = this.target;
//             this.target = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
//             if (!this.target) {
//                 console.warn('No target found!');
//                 return;
//             }
//             this.ship.initiateTakeoff();
//             this.state = 'TakingOff';
//         }
//     }

//     /**
//      * Handles the TakingOff state: waits for takeoff to complete.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateTakingOff(deltaTime, gameManager) {
//         if (this.ship.state === 'Flying') {
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the TraversingJumpGate state: manages autopilot to use a jump gate.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateTraversingJumpGate(deltaTime, gameManager) {
//         if (!this.autopilot) {
//             console.warn('Autopilot is not set during TraversingJumpGate state');
//             this.state = 'Idle';
//             return;
//         }

//         this.autopilot.update(deltaTime);

//         if (this.autopilot.isComplete()) {
//             if (this.autopilot.error) {
//                 this.target = this.pickDestination(this.ship.starSystem, null);
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             } else if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.lane.target) {
//                 this.target = this.pickDestination(this.ship.starSystem, this.target.lane.targetGate);
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             } else {
//                 console.warn('Autopilot completed but jump not finished; resetting');
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             }
//         } else if (!this.autopilot.active) {
//             console.warn('Autopilot is inactive but not complete during TraversingJumpGate state');
//             this.autopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Returns the current state of the AI pilot for HUD display.
//      * @returns {string} A descriptive status string.
//      */
//     getState() {
//         if ((this.state === 'FlyingToPlanet' || this.state === 'TraversingJumpGate') && this.autopilot?.active) {
//             return this.autopilot.getStatus();
//         }
//         return `AI: ${this.state} (Target: ${this.target?.name || 'None'})`;
//     }
// }

// /**
//  * An AI pilot that performs interdiction tasks within a star system.
//  * Follows ships, visits celestial bodies without landing, flies to random points, and waits.
//  * Does not leave the system via jump gates.
//  * @extends Pilot
//  */
// export class InterdictionAIPilot extends Pilot {
//     /**
//      * Creates a new InterdictionAIPilot instance.
//      * @param {Ship} ship - The ship to control.
//      * @param {GameObject} spawnPlanet - The planet where the ship starts.
//      */
//     constructor(ship, spawnPlanet) {
//         super(ship);
//         this.spawnPlanet = spawnPlanet;
//         this.target = null;
//         this.state = 'Idle';
//         this.waitTime = 0;
//         this.followTime = 0;
//         this.isFollowingInRange = false;
//         this.autopilot = null;

//         this.stateHandlers = {
//             'Idle': this.updateIdle.bind(this),
//             'FollowingShip': this.updateFollowingShip.bind(this),
//             'VisitingBody': this.updateVisitingBody.bind(this),
//             'FlyingToRandomPoint': this.updateFlyingToRandomPoint.bind(this),
//             'Waiting': this.updateWaiting.bind(this),
//             'TakingOff': this.updateTakingOff.bind(this)
//         };

//         // Scratch vectors to avoid allocations
//         this._scratchDirectionToTarget = new Vector2D();
//         this._scratchRandomPoint = new Vector2D();
//         this._scratchDistanceToTarget = new Vector2D();
//         this._scratchVelocityDifference = new Vector2D();
//         this._scratchDesiredVelocity = new Vector2D();

//         // Behavior constants
//         this.followDistance = 250; // Distance to maintain while following
//         this.visitDistance = 200; // Distance to approach celestial bodies
//         this.waitTimeMin = 2; // Minimum wait time in seconds
//         this.waitTimeMax = 5; // Maximum wait time in seconds
//         this.followDuration = 10; // Time to follow a ship in seconds
//         this.velocityMatchThreshold = 50; // Max velocity difference to consider "matched"
//         this.systemBounds = 10000; // Bounds for random point generation
//     }

//     /**
//      * Checks if a target is still valid (not despawned and exists in the galaxy).
//      * @param {GameObject} source - The source game object to validate.
//      * @param {GameObject} target - The target game object to validate.
//      * @returns {boolean} True if the target is valid, false otherwise.
//      */
//     isValidTarget(source, target) {
//         if (!(target instanceof Ship)) return false;
//         if (!isValidTarget(source, target)) return false;
//         if (target.state === 'Landed') return false;
//         return true;
//     }

//     /**
//      * Picks a random ship to follow, excluding itself and landed ships.
//      * @returns {Ship|null} The selected ship, or null if none available.
//      */
//     pickShipToFollow() {
//         return this.ship.starSystem.getRandomShip(this.ship, null, isValidAttackTarget);
//     }

//     /**
//      * Picks a random celestial body (planet or asteroid) to visit, excluding jump gates and stars.
//      * @returns {Planet|Asteroid|null} The selected body, or null if none available.
//      */
//     pickBodyToVisit() {
//         return this.ship.starSystem.getRandomPlanetAsteroid(this.ship);
//     }

//     /**
//      * Generates a random point within the system bounds.
//      * @returns {Vector2D} The random point coordinates.
//      */
//     pickRandomPoint() {
//         const x = randomBetween(-this.systemBounds, this.systemBounds);
//         const y = randomBetween(-this.systemBounds, this.systemBounds);
//         return this._scratchRandomPoint.set(x, y);
//     }

//     /**
//      * Updates the AI pilot's behavior based on the current state.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     update(deltaTime, gameManager) {
//         if (this.target) {
//             this.ship.setTarget(this.target);
//         } else {
//             this.ship.clearTarget();
//         }

//         const handler = this.stateHandlers[this.state];
//         if (handler) {
//             handler(deltaTime, gameManager);
//         } else {
//             console.warn(`No handler for state: ${this.state}`);
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the Idle state: randomly chooses to follow a ship, visit a body, or fly to a point.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateIdle(deltaTime, gameManager) {
//         const taskRoll = Math.random();
//         if (taskRoll < 0.4) { // 40% chance to follow a ship
//             this.target = this.pickShipToFollow();
//             if (this.target) {
//                 this.autopilot = new FollowShipAutopilot(this.ship, this.target, this.followDistance, 100);
//                 this.autopilot.start();
//                 this.followTime = this.followDuration;
//                 this.isFollowingInRange = false;
//                 this.transitionFromIdle('FollowingShip');
//             } else {
//                 this.updateIdle(deltaTime, gameManager); // Retry if no valid target
//             }
//         } else if (taskRoll < 0.7) { // 30% chance to visit a body
//             this.target = this.pickBodyToVisit();
//             if (this.target) {
//                 const arrivalDistance = this.target.radius ? this.target.radius + this.visitDistance : this.visitDistance;
//                 this.autopilot = new FlyToTargetAutopilot(this.ship, this.target, arrivalDistance, 50, 100);
//                 this.autopilot.start();
//                 this.transitionFromIdle('VisitingBody');
//             } else {
//                 this.updateIdle(deltaTime, gameManager); // Retry if no valid target
//             }
//         } else { // 30% chance to fly to a random point
//             this.target = this.pickRandomPoint();
//             this.autopilot = new FlyToTargetAutopilot(this.ship, { position: this.target }, 100, 50, 100);
//             this.autopilot.start();
//             this.transitionFromIdle('FlyingToRandomPoint');
//         }
//     }

//     /**
//      * Transitions from Idle state based on the ship's current state.
//      * @param {string} nextState - The state to transition to.
//      */
//     transitionFromIdle(nextState) {
//         if (this.ship.state === 'Landed') {
//             this.ship.initiateTakeoff();
//             this.state = 'TakingOff';
//         } else if (this.ship.state === 'Flying') {
//             this.state = nextState;
//         } else if (this.ship.state !== 'TakingOff') {
//             console.warn(`Invalid ship state '${this.ship.state}' in InterdictionAIPilot updateIdle`);
//         }
//     }

//     /**
//      * Handles the FollowingShip state: follows a target ship until time runs out or target is lost.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateFollowingShip(deltaTime, gameManager) {
//         if (!this.autopilot) {
//             console.warn('Autopilot is not set during FollowingShip state');
//             this.state = 'Idle';
//             return;
//         }

//         if (!this.target || this.target.isDespawned() || this.target.state === 'Landed' || this.target.starSystem !== this.ship.starSystem) {
//             this.autopilot.stop();
//             this.autopilot = null;
//             this.target = null;
//             this.followTime = 0;
//             this.isFollowingInRange = false;
//             this.state = 'Idle';
//             return;
//         }

//         this.autopilot.update(deltaTime);

//         // Check distance and velocity match
//         this._scratchDistanceToTarget.set(this.target.position).subtractInPlace(this.ship.position);
//         const distanceToTarget = this._scratchDistanceToTarget.magnitude();
//         this._scratchVelocityDifference.set(this.ship.velocity).subtractInPlace(this.target.velocity);
//         const velocityDifference = this._scratchVelocityDifference.magnitude();

//         const isInRange = distanceToTarget <= this.followDistance;
//         const isVelocityMatched = velocityDifference <= this.velocityMatchThreshold;

//         if (isInRange && isVelocityMatched) {
//             this.isFollowingInRange = true;
//             this.followTime -= deltaTime;
//             if (this.followTime <= 0) {
//                 this.autopilot.stop();
//                 this.autopilot = null;
//                 this.target = null;
//                 this.followTime = 0;
//                 this.isFollowingInRange = false;
//                 this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//                 this.state = 'Waiting';
//             }
//         } else {
//             this.isFollowingInRange = false;
//         }
//     }

//     /**
//      * Handles the VisitingBody state: flies near a celestial body.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateVisitingBody(deltaTime, gameManager) {
//         if (!this.autopilot) {
//             console.warn('Autopilot is not set during VisitingBody state');
//             this.state = 'Idle';
//             return;
//         }

//         if (!this.target || this.target.isDespawned()) {
//             this.autopilot.stop();
//             this.autopilot = null;
//             this.target = null;
//             this.state = 'Idle';
//             return;
//         }

//         this.autopilot.update(deltaTime);

//         if (this.autopilot.isComplete()) {
//             this.autopilot = null;
//             this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//             this.state = 'Waiting';
//         } else if (!this.autopilot.active) {
//             console.warn('Autopilot is inactive but not complete during VisitingBody state');
//             this.autopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the FlyingToRandomPoint state: flies to a random point in the system.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateFlyingToRandomPoint(deltaTime, gameManager) {
//         if (!this.autopilot) {
//             console.warn('Autopilot is not set during FlyingToRandomPoint state');
//             this.state = 'Idle';
//             return;
//         }

//         this.autopilot.update(deltaTime);

//         if (this.autopilot.isComplete()) {
//             this.autopilot = null;
//             this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//             this.state = 'Waiting';
//         } else if (!this.autopilot.active) {
//             console.warn('Autopilot is inactive but not complete during FlyingToRandomPoint state');
//             this.autopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the Waiting state: slows the ship to landing speed and waits.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateWaiting(deltaTime, gameManager) {
//         const currentSpeed = this.ship.velocity.magnitude();
//         const landingSpeed = Ship.LANDING_SPEED || 10;

//         if (currentSpeed > landingSpeed) {
//             this._scratchDesiredVelocity.set(this.ship.velocity);
//             if (currentSpeed > 0) {
//                 this._scratchDesiredVelocity.normalizeInPlace().multiplyInPlace(landingSpeed);
//             } else {
//                 this._scratchDesiredVelocity.set(0, 0);
//             }

//             this._scratchVelocityDifference.set(this._scratchDesiredVelocity).subtractInPlace(this.ship.velocity);
//             const velocityErrorMagnitude = this._scratchVelocityDifference.magnitude();

//             let desiredAngle = this.ship.angle;
//             let shouldThrust = false;

//             if (velocityErrorMagnitude > 5) {
//                 desiredAngle = Math.atan2(this._scratchVelocityDifference.x, -this._scratchVelocityDifference.y);
//                 const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
//                 desiredAngle = this.ship.angle + angleToDesired;
//                 shouldThrust = Math.abs(angleToDesired) < Math.PI / 12;
//             } else {
//                 desiredAngle = Math.atan2(this.ship.velocity.x, -this.ship.velocity.y);
//             }

//             this.ship.setTargetAngle(desiredAngle);
//             this.ship.applyThrust(shouldThrust);
//         }

//         this.waitTime -= deltaTime;
//         if (this.waitTime <= 0) {
//             this.target = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the TakingOff state: waits for takeoff to complete.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateTakingOff(deltaTime, gameManager) {
//         if (this.ship.state === 'Flying') {
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Returns the current state of the AI pilot for HUD display.
//      * @returns {string} A descriptive status string.
//      */
//     getState() {
//         if (this.state === 'FollowingShip' && this.autopilot?.active) {
//             return `Interdiction: Following ${this.target.name || 'ship'} (${this.isFollowingInRange ? 'In Range' : 'Approaching'})`;
//         } else if (this.state === 'VisitingBody' && this.autopilot?.active) {
//             return `Interdiction: Visiting ${this.target.name || 'body'}`;
//         } else if (this.state === 'FlyingToRandomPoint' && this.autopilot?.active) {
//             return `Interdiction: Flying to random point`;
//         } else if (this.state === 'Waiting') {
//             return `Interdiction: Waiting`;
//         }
//         return `Interdiction: ${this.state}`;
//     }
// }

// /**
//  * An AI pilot that escorts a designated ship and despawns if the escorted ship is lost.
//  * @extends Pilot
//  */
// export class EscortAIPilot extends Pilot {
//     /**
//      * Creates a new EscortAIPilot instance.
//      * @param {Ship} ship - The ship to control.
//      * @param {Ship} escortedShip - The ship to escort.
//      */
//     constructor(ship, escortedShip) {
//         super(ship);
//         this.state = 'Following';
//         this.escortedShip = escortedShip;
//         this.autopilot = null;

//         this.followDistance = 250; // Distance to maintain while escorting

//         this.stateHandlers = {
//             'Idle': this.updateIdle.bind(this),
//             'Following': this.updateFollowing.bind(this),
//             'Despawn': this.updateDespawn.bind(this)
//         };
//     }

//     /**
//      * Finds a random planet in the current system to land on for despawning.
//      * @returns {Planet|null} A random planet, or null if none found.
//      */
//     findPlanet() {
//         return this.ship.starSystem.getRandomPlanet(this.ship);
//     }

//     /**
//      * Updates the AI pilot's behavior based on the current state.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      */
//     update(deltaTime) {
//         if ((!this.escortedShip || this.escortedShip.isDespawned()) && this.state !== 'Despawn') {
//             if (this.ship.state === 'Landed') {
//                 this.ship.despawn();
//                 this.autopilot?.stop();
//                 this.autopilot = null;
//                 return;
//             }
//             this.escortedShip = null;
//             this.autopilot?.stop();
//             const planet = this.findPlanet();
//             this.autopilot = new LandOnPlanetAutopilot(this.ship, planet);
//             this.autopilot.start();
//             this.state = 'Despawn';
//         }

//         const handler = this.stateHandlers[this.state];
//         if (handler) {
//             handler(deltaTime);
//         } else {
//             console.warn(`No handler for state: ${this.state}`);
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the Idle state: indicates an unexpected state.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      */
//     updateIdle(deltaTime) {
//         console.warn('Escort ship gone Idle', this.ship, this);
//     }

//     /**
//      * Handles the Following state: escorts the designated ship.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      */
//     updateFollowing(deltaTime) {
//         this.ship.setTarget(this.escortedShip);

//         if (!this.autopilot || !this.autopilot.active) {
//             this.autopilot = new EscortAutopilot(this.ship, this.escortedShip, this.followDistance);
//             this.autopilot.start();
//         }

//         if (this.autopilot?.active) {
//             this.autopilot.update(deltaTime);
//             if (this.autopilot.isComplete()) {
//                 if (this.autopilot.error) {
//                     console.warn(`Autopilot failed: ${this.autopilot.error}`);
//                 }
//                 this.autopilot = null;
//             }
//         }
//     }

//     /**
//      * Handles the Despawn state: lands on a planet and despawns the ship.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      */
//     updateDespawn(deltaTime) {
//         if (!this.autopilot) {
//             console.warn('Autopilot not set during Despawn state');
//             this.state = 'Idle';
//             return;
//         }

//         if (this.ship.state === 'Landed') {
//             this.ship.despawn();
//             this.autopilot.stop();
//             this.autopilot = null;
//             return;
//         }

//         this.autopilot.update(deltaTime);
//         if (this.autopilot.isComplete()) {
//             if (this.autopilot.error) {
//                 console.warn(`Landing failed: ${this.autopilot.error}`);
//                 this.autopilot.stop();
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             } else if (this.ship.state === 'Landed') {
//                 this.ship.despawn();
//                 this.autopilot.stop();
//                 this.autopilot = null;
//             } else {
//                 console.warn('Landing completed but ship not landed; resetting');
//                 this.autopilot.stop();
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             }
//         } else if (!this.autopilot.active) {
//             console.warn('Autopilot inactive but not complete during Despawn state');
//             this.autopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Returns the current state of the AI pilot for HUD display.
//      * @returns {string} A descriptive status string.
//      */
//     getState() {
//         if (this.autopilot?.active) {
//             return this.autopilot.getStatus();
//         }
//         return `Escort: Idle`;
//     }
// }

// /**
//  * An AI pilot that mines asteroids and returns to a home planet in a loop.
//  * @extends Pilot
//  */
// export class MiningAIPilot extends Pilot {
//     /**
//      * Creates a new MiningAIPilot instance.
//      * @param {Ship} ship - The ship to control.
//      * @param {Planet} homePlanet - The home planet to return to after mining.
//      */
//     constructor(ship, homePlanet) {
//         super(ship);
//         this.homePlanet = homePlanet;
//         this.targetAsteroid = null;
//         this.state = 'Idle';
//         this.waitTime = 0;
//         this.autopilot = null;

//         this.stateHandlers = {
//             'Idle': this.updateIdle.bind(this),
//             'FlyingToAsteroid': this.updateFlyingToAsteroid.bind(this),
//             'Mining': this.updateMining.bind(this),
//             'TakingOffFromAsteroid': this.updateTakingOffFromAsteroid.bind(this),
//             'FlyingToHomePlanet': this.updateFlyingToHomePlanet.bind(this),
//             'LandingOnHomePlanet': this.updateLandingOnHomePlanet.bind(this),
//             'WaitingOnHomePlanet': this.updateWaitingOnHomePlanet.bind(this),
//             'TakingOffFromHomePlanet': this.updateTakingOffFromHomePlanet.bind(this)
//         };

//         // Scratch vector for direction calculations
//         this._scratchDirectionToTarget = new Vector2D();

//         // Behavior constants
//         this.miningTime = 5; // Time to spend mining in seconds
//         this.waitTimeMin = 5; // Minimum wait time on home planet in seconds
//         this.waitTimeMax = 10; // Maximum wait time on home planet in seconds
//     }

//     /**
//      * Finds a random asteroid in the current system to mine.
//      * @returns {Asteroid|null} A random asteroid, or null if none found.
//      */
//     findRandomAsteroid() {
//         return this.ship.starSystem.getRandomAsteroid(this.ship);
//     }

//     /**
//      * Updates the AI pilot's behavior based on the current state.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     update(deltaTime, gameManager) {
//         if (!this.homePlanet || this.homePlanet.isDespawned()) {
//             this.ship.despawn();
//             return;
//         }

//         if (this.targetAsteroid) {
//             this.ship.setTarget(this.targetAsteroid);
//         } else if (['FlyingToHomePlanet', 'LandingOnHomePlanet', 'WaitingOnHomePlanet'].includes(this.state)) {
//             this.ship.setTarget(this.homePlanet);
//         } else {
//             this.ship.clearTarget();
//         }

//         const handler = this.stateHandlers[this.state];
//         if (handler) {
//             handler(deltaTime, gameManager);
//         } else {
//             console.warn(`No handler for state: ${this.state}`);
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the Idle state: decides to mine an asteroid or return home.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateIdle(deltaTime, gameManager) {
//         if (this.ship.state === 'Landed') {
//             if (this.ship.landedObject === this.homePlanet) {
//                 this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//                 this.state = 'WaitingOnHomePlanet';
//             } else {
//                 this.ship.initiateTakeoff();
//                 this.state = 'TakingOffFromHomePlanet';
//             }
//         } else if (this.ship.state === 'Flying') {
//             if (this.targetAsteroid) {
//                 this.autopilot = new LandOnAsteroidAutopilot(this.ship, this.targetAsteroid);
//                 this.autopilot.start();
//                 this.state = 'FlyingToAsteroid';
//             } else {
//                 this.autopilot = new LandOnPlanetAutopilot(this.ship, this.homePlanet);
//                 this.autopilot.start();
//                 this.state = 'FlyingToHomePlanet';
//             }
//         } else if (this.ship.state === 'TakingOff' || this.ship.state === 'Landing') {
//             //wait for the animation to compelte
//         } else {
//             console.warn(`Invalid ship state '${this.ship.state}' in MiningAIPilot updateIdle`, this.ship.landedObject);
//         }
//     }

//     /**
//      * Handles the FlyingToAsteroid state: flies to the target asteroid.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateFlyingToAsteroid(deltaTime, gameManager) {
//         if (!this.autopilot) {
//             console.warn('Autopilot is not set during FlyingToAsteroid state');
//             this.state = 'Idle';
//             return;
//         }

//         if (!this.targetAsteroid || this.targetAsteroid.isDespawned()) {
//             this.autopilot.stop();
//             this.autopilot = null;
//             this.targetAsteroid = null;
//             this.state = 'Idle';
//             return;
//         }

//         this.autopilot.update(deltaTime);

//         if (this.autopilot.isComplete()) {
//             if (this.autopilot.error) {
//                 console.warn(`Autopilot failed: ${this.autopilot.error}`);
//                 this.autopilot = null;
//                 this.targetAsteroid = null;
//                 this.state = 'Idle';
//             } else if (this.ship.state === 'Landed' && this.ship.landedObject instanceof Asteroid) {
//                 this.autopilot = null;
//                 this.waitTime = this.miningTime;
//                 this.state = 'Mining';
//             } else {
//                 console.warn('Autopilot completed but ship is not mining; resetting');
//                 this.autopilot = null;
//                 this.targetAsteroid = null;
//                 this.state = 'Idle';
//             }
//         } else if (!this.autopilot.active) {
//             console.warn('Autopilot is inactive but not complete during FlyingToAsteroid state');
//             this.autopilot = null;
//             this.targetAsteroid = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the Mining state: waits on the asteroid while "mining".
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateMining(deltaTime, gameManager) {
//         this.waitTime -= deltaTime;
//         if (this.waitTime <= 0) {
//             this.ship.initiateTakeoff();
//             this.state = 'TakingOffFromAsteroid';
//         }
//     }

//     /**
//      * Handles the TakingOffFromAsteroid state: waits for takeoff from the asteroid.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateTakingOffFromAsteroid(deltaTime, gameManager) {
//         if (this.ship.state === 'Flying') {
//             this.autopilot = new LandOnPlanetAutopilot(this.ship, this.homePlanet);
//             this.autopilot.start();
//             this.state = 'FlyingToHomePlanet';
//             this.targetAsteroid = null;
//         }
//     }

//     /**
//      * Handles the FlyingToHomePlanet state: flies back to the home planet.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateFlyingToHomePlanet(deltaTime, gameManager) {
//         if (!this.autopilot) {
//             console.warn('Autopilot is not set during FlyingToHomePlanet state');
//             this.state = 'Idle';
//             return;
//         }

//         this.autopilot.update(deltaTime);

//         if (this.autopilot.isComplete()) {
//             if (this.autopilot.error) {
//                 console.warn(`Autopilot failed: ${this.autopilot.error}`);
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             } else if (this.ship.state === 'Landed' && this.ship.landedObject === this.homePlanet) {
//                 this.autopilot = null;
//                 this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//                 this.state = 'WaitingOnHomePlanet';
//             } else {
//                 console.warn('Autopilot completed but ship is not landed; resetting');
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             }
//         } else if (!this.autopilot.active) {
//             console.warn('Autopilot is inactive but not complete during FlyingToHomePlanet state');
//             this.autopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the LandingOnHomePlanet state: waits for landing on the home planet.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateLandingOnHomePlanet(deltaTime, gameManager) {
//         if (!this.autopilot) {
//             console.warn('Autopilot is not set during LandingOnHomePlanet state');
//             this.state = 'Idle';
//             return;
//         }

//         this.autopilot.update(deltaTime);

//         if (this.autopilot.isComplete()) {
//             if (this.autopilot.error) {
//                 console.warn(`Autopilot failed: ${this.autopilot.error}`);
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             } else if (this.ship.state === 'Landed') {
//                 this.autopilot = null;
//                 this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//                 this.state = 'WaitingOnHomePlanet';
//             } else {
//                 console.warn('Autopilot completed but ship is not landed; resetting');
//                 this.autopilot = null;
//                 this.state = 'Idle';
//             }
//         } else if (!this.autopilot.active) {
//             console.warn('Autopilot is inactive but not complete during LandingOnHomePlanet state');
//             this.autopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the WaitingOnHomePlanet state: waits before taking off to mine again.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateWaitingOnHomePlanet(deltaTime, gameManager) {
//         this.waitTime -= deltaTime;
//         if (this.waitTime <= 0) {
//             this.targetAsteroid = this.findRandomAsteroid();
//             this.ship.target = this.targetAsteroid;
//             this.ship.initiateTakeoff();
//             this.state = 'TakingOffFromHomePlanet';
//         }
//     }

//     /**
//      * Handles the TakingOffFromHomePlanet state: waits for takeoff from the home planet.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {Object} gameManager - The game manager instance.
//      */
//     updateTakingOffFromHomePlanet(deltaTime, gameManager) {
//         if (this.ship.state === 'Flying') {
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Returns the current state of the AI pilot for HUD display.
//      * @returns {string} A descriptive status string.
//      */
//     getState() {
//         if (this.state === 'FlyingToAsteroid' && this.autopilot?.active) {
//             return `Mining: Flying to asteroid ${this.targetAsteroid?.name || ''}`;
//         } else if (this.state === 'Mining') {
//             return `Mining: Mining asteroid`;
//         } else if (this.state === 'FlyingToHomePlanet' && this.autopilot?.active) {
//             return `Mining: Returning to ${this.homePlanet.name}`;
//         } else if (this.state === 'LandingOnHomePlanet' && this.autopilot?.active) {
//             return `Mining: Landing on ${this.homePlanet.name}`;
//         } else if (this.state === 'WaitingOnHomePlanet') {
//             return `Mining: Waiting on ${this.homePlanet.name}`;
//         }
//         return `Mining: ${this.state}`;
//     }
// }