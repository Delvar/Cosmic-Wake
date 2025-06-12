// /src/pilot.js

import { Vector2D } from '/src/core/vector2d.js';
import { CelestialBody, JumpGate, Star, Planet } from '/src/starSystem/celestialBody.js';
import { remapClamp, randomBetween, normalizeAngle } from '/src/core/utils.js';
import { isValidAttackTarget, Ship } from '/src/ship/ship.js';
import { TraverseJumpGateAutopilot, LandOnPlanetAutopilot, EscortAutopilot, LandOnAsteroidAutopilot, FlyToTargetAutopilot, Autopilot, FollowShipAutopilot } from '/src/autopilot/autopilot.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';
import { GameManager } from '/src/core/game.js';
import { FactionRelationship } from '/src/core/faction.js';

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
        /** @type {Ship} The ship controlled by this pilot. */
        this.ship = ship;
        /** @type {Autopilot|null} The active autopilot controlling ship navigation (e.g., FlyToTargetAutopilot). */
        this.autopilot = null;

        if (new.target === Pilot) Object.seal(this);
    }

    /**
     * Updates the pilot's behavior based on the current game state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager instance providing input and context.
     * @throws {Error} Must be implemented by subclasses.
     */
    update(deltaTime, gameManager) {
        throw new Error("update() must be implemented by subclass");
    }

    /**
     * Returns the current status of the player pilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getStatus() {
        if (this.autopilot?.active) {
            return this.autopilot.getStatus();
        }
        return null;
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
        /** @type {Vector2D} Temporary vector for direction to target. */
        this._scratchDirectionToTarget = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for distance to target. */
        this._scratchDistanceToTarget = new Vector2D(0, 0);

        if (new.target === PlayerPilot) Object.seal(this);
    }

    /**
     * Validates if a ship is a hostile target.
     * @static
     * @param {Ship} source - The source ship.
     * @param {Ship} target - The target ship.
     * @returns {boolean} True if the target is hostile and valid, false otherwise.
     */
    static isValidHostileTarget(source, target) {
        return target.state === 'Flying' && isValidAttackTarget(source, target) &&
            (source.getRelationship(target) === FactionRelationship.Hostile || source.hostiles.includes(target));
    }

    /**
     * Validates if a ship is a neutral target.
     * @static
     * @param {Ship} source - The source ship.
     * @param {Ship} target - The target ship.
     * @returns {boolean} True if the target is neutral and valid, false otherwise.
     */
    static isValidNeutralTarget(source, target) {
        return target.state === 'Flying' && isValidTarget(source, target) && source.getRelationship(target) === FactionRelationship.Neutral;
    }

    /**
     * Validates if a ship is an allied target.
     * @static
     * @param {Ship} source - The source ship.
     * @param {Ship} target - The target ship.
     * @returns {boolean} True if the target is allied and valid, false otherwise.
     */
    static isValidAlliedTarget(source, target) {
        return target.state === 'Flying' && isValidTarget(source, target) && source.getRelationship(target) === FactionRelationship.Allied;
    }

    /**
        * Handles hostile ship selection for 'r'/'R' key press.
        * @param {number} deltaTime - Time elapsed since the last update in seconds.
        * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
        */
    handleHostileShipSelection(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            this.ship.initiateTakeoff();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Initiating takeoff`);
            }
            return;
        }
        if (this.ship.state !== 'Flying') return;

        // Check if current target is hostile
        if (this.ship.target instanceof Ship && PlayerPilot.isValidHostileTarget(this.ship, this.ship.target)) {
            const currentShip = this.ship.target;
            const nextShip = this.ship.starSystem.cycleClosestShip(this.ship, currentShip, null, PlayerPilot.isValidHostileTarget);
            if (nextShip) {
                this.ship.setTarget(nextShip);
                if (this.ship.debug) {
                    console.log(`PlayerPilot: Cycled to hostile ship ${nextShip.name}`);
                }
            } else {
                this.ship.setTarget(null);
                if (this.ship.debug) {
                    console.log(`PlayerPilot: No valid next hostile ship`);
                }
            }
            return;
        }

        // Select closest hostile ship
        const closestShip = this.ship.starSystem.getClosestShip(this.ship, null, PlayerPilot.isValidHostileTarget);
        if (closestShip) {
            this.ship.setTarget(closestShip);
            if (this.ship.debug) {
                console.log(`PlayerPilot: Selected closest hostile ship ${closestShip.name}`);
            }
        } else if (this.ship.debug) {
            console.log(`PlayerPilot: No valid hostile ships in system`);
        }
    }

    /**
     * Handles neutral ship selection for 't'/'T' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     */
    handleNeutralShipSelection(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            this.ship.initiateTakeoff();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Initiating takeoff`);
            }
            return;
        }
        if (this.ship.state !== 'Flying') return;

        // Check if current target is neutral
        if (this.ship.target instanceof Ship && PlayerPilot.isValidNeutralTarget(this.ship, this.ship.target)) {
            const currentShip = this.ship.target;
            const nextShip = this.ship.starSystem.cycleClosestShip(this.ship, currentShip, null, PlayerPilot.isValidNeutralTarget);
            if (nextShip) {
                this.ship.setTarget(nextShip);
                if (this.ship.debug) {
                    console.log(`PlayerPilot: Cycled to neutral ship ${nextShip.name}`);
                }
            } else {
                this.ship.setTarget(null);
                if (this.ship.debug) {
                    console.log(`PlayerPilot: No valid next neutral ship`);
                }
            }
            return;
        }

        // Select closest neutral ship
        const closestShip = this.ship.starSystem.getClosestShip(this.ship, null, PlayerPilot.isValidNeutralTarget);
        if (closestShip) {
            this.ship.setTarget(closestShip);
            if (this.ship.debug) {
                console.log(`PlayerPilot: Selected closest neutral ship ${closestShip.name}`);
            }
        } else if (this.ship.debug) {
            console.log(`PlayerPilot: No valid neutral ships in system`);
        }
    }

    /**
     * Handles allied ship selection for 'y'/'Y' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     */
    handleAlliedShipSelection(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            this.ship.initiateTakeoff();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Initiating takeoff`);
            }
            return;
        }
        if (this.ship.state !== 'Flying') return;

        // Check if current target is allied
        if (this.ship.target instanceof Ship && PlayerPilot.isValidAlliedTarget(this.ship, this.ship.target)) {
            const currentShip = this.ship.target;
            const nextShip = this.ship.starSystem.cycleClosestShip(this.ship, currentShip, null, PlayerPilot.isValidAlliedTarget);
            if (nextShip) {
                this.ship.setTarget(nextShip);
                if (this.ship.debug) {
                    console.log(`PlayerPilot: Cycled to allied ship ${nextShip.name}`);
                }
            } else {
                this.ship.setTarget(null);
                if (this.ship.debug) {
                    console.log(`PlayerPilot: No valid next allied ship`);
                }
            }
            return;
        }

        // Select closest allied ship
        const closestShip = this.ship.starSystem.getClosestShip(this.ship, null, PlayerPilot.isValidAlliedTarget);
        if (closestShip) {
            this.ship.setTarget(closestShip);
            if (this.ship.debug) {
                console.log(`PlayerPilot: Selected closest allied ship ${closestShip.name}`);
            }
        } else if (this.ship.debug) {
            console.log(`PlayerPilot: No valid allied ships in system`);
        }
    }

    /**
     * Handles planet landing for 'l'/'L' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     */
    handlePlanetLanding(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            this.ship.initiateTakeoff();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Initiating takeoff`);
            }
            return;
        }
        if (this.ship.state !== 'Flying') return;

        // Check if over a landable planet
        const planets = this.ship.starSystem.planets;
        let overPlanet = null;
        for (const planet of planets) {
            const canLand = this.ship.canLand(planet);
            if (this.ship.debug) {
                console.log(`Checking planet ${planet.name}: canLand=${canLand}`);
            }
            if (isValidTarget(this.ship, planet) && canLand) {
                overPlanet = planet;
                break;
            }
        }
        if (overPlanet) {
            this.ship.setTarget(overPlanet);
            this.ship.initiateLanding(overPlanet);
            if (this.ship.debug) {
                console.log(`PlayerPilot: Landing on planet ${overPlanet.name}`);
            }
            return;
        }

        // Check for active LandOnPlanetAutopilot
        if (this.autopilot instanceof LandOnPlanetAutopilot && this.autopilot.active) {
            const currentPlanet = this.autopilot.target;
            const nextPlanet = this.ship.starSystem.cycleClosestPlanet(this.ship, currentPlanet);
            if (nextPlanet) {
                this.ship.setTarget(nextPlanet);
                this.autopilot = new LandOnPlanetAutopilot(this.ship, nextPlanet);
                this.autopilot.start();
                if (this.ship.debug) {
                    console.log(`PlayerPilot: Cycled to planet ${nextPlanet.name}`);
                }
            } else {
                this.autopilot.stop();
                this.autopilot = null;
                if (this.ship.debug) {
                    console.log(`PlayerPilot: No valid next planet`);
                }
            }
            return;
        }

        // Check for targeted planet
        if (this.ship.target instanceof Planet && isValidTarget(this.ship, this.ship.target)) {
            this.autopilot = new LandOnPlanetAutopilot(this.ship, this.ship.target);
            this.autopilot.start();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Autopiloting to targeted planet ${this.ship.target.name}`);
            }
            return;
        }

        // Select closest planet
        const closestPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
        if (closestPlanet) {
            this.ship.setTarget(closestPlanet);
            this.autopilot = new LandOnPlanetAutopilot(this.ship, closestPlanet);
            this.autopilot.start();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Autopiloting to closest planet ${closestPlanet.name}`);
            }
        } else if (this.ship.debug) {
            console.log(`PlayerPilot: No valid planets in system`);
        }
    }

    /**
     * Handles jump gate navigation for 'j'/'J' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     */
    handleJumpGateLanding(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            this.ship.initiateTakeoff();
            return;
        }
        if (this.ship.state !== 'Flying') return;

        // Check if over a jump gate
        const jumpGates = this.ship.starSystem.jumpGates;
        let overGate = null;
        for (const gate of jumpGates) {
            if (isValidTarget(this.ship, gate) && gate.overlapsPoint(this.ship.position)) {
                overGate = gate;
                break;
            }
        }
        if (overGate) {
            this.ship.setTarget(overGate);
            this.ship.initiateHyperjump(overGate);
            return;
        }

        // Check for active TraverseJumpGateAutopilot
        if (this.autopilot instanceof TraverseJumpGateAutopilot && this.autopilot.active) {
            const currentGate = this.autopilot.target;
            const nextGate = this.ship.starSystem.cycleClosestJumpGate(this.ship, currentGate);
            if (nextGate) {
                this.ship.setTarget(nextGate);
                this.autopilot = new TraverseJumpGateAutopilot(this.ship, nextGate);
                this.autopilot.start();
                if (this.ship.debug) {
                    console.log(`PlayerPilot: Cycled to jump gate ${nextGate.name}`);
                }
            } else {
                this.autopilot.stop();
                this.autopilot = null;
                if (this.ship.debug) {
                    console.log(`PlayerPilot: No valid next jump gate`);
                }
            }
            return;
        }

        // Check for targeted jump gate
        if (this.ship.target instanceof JumpGate && isValidTarget(this.ship, this.ship.target)) {
            this.autopilot = new TraverseJumpGateAutopilot(this.ship, this.ship.target);
            this.autopilot.start();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Autopiloting to targeted jump gate ${this.ship.target.name}`);
            }
            return;
        }

        // Select closest jump gate
        const closestGate = this.ship.starSystem.getClosestJumpGate(this.ship);
        if (closestGate) {
            this.ship.setTarget(closestGate);
            this.autopilot = new TraverseJumpGateAutopilot(this.ship, closestGate);
            this.autopilot.start();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Autopiloting to closest jump gate ${closestGate.name}`);
            }
        } else if (this.ship.debug) {
            console.log(`PlayerPilot: No valid jump gates in system`);
        }
    }

    /**
     * Handles asteroid selection for 'm'/'M' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     */
    handleAsteroidLanding(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            this.ship.initiateTakeoff();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Initiating takeoff`);
            }
            return;
        }
        if (this.ship.state !== 'Flying') return;

        // Check if over an asteroid
        const asteroids = this.ship.starSystem.asteroids;
        let overAsteroid = null;
        for (const asteroid of asteroids) {
            const canLand = this.ship.canLand(asteroid);
            if (this.ship.debug) {
                console.log(`Checking asteroid ${asteroid.name}: canLand=${canLand}`);
            }
            if (isValidTarget(this.ship, asteroid) && canLand) {
                overAsteroid = asteroid;
                break;
            }
        }
        if (overAsteroid) {
            this.ship.setTarget(overAsteroid);
            this.ship.initiateLanding(overAsteroid);
            if (this.ship.debug) {
                console.log(`PlayerPilot: Landing on asteroid ${overAsteroid.name}`);
            }
            return;
        }

        // Check for active LandOnAsteroidAutopilot
        if (this.autopilot instanceof LandOnAsteroidAutopilot && this.autopilot.active) {
            const currentAsteroid = this.autopilot.target;
            const nextAsteroid = this.ship.starSystem.cycleClosestAsteroid(this.ship, currentAsteroid);
            if (nextAsteroid) {
                this.ship.setTarget(nextAsteroid);
                this.autopilot = new LandOnAsteroidAutopilot(this.ship, nextAsteroid);
                this.autopilot.start();
                if (this.ship.debug) {
                    console.log(`PlayerPilot: Cycled to asteroid ${nextAsteroid.name}`);
                }
            } else {
                this.autopilot.stop();
                this.autopilot = null;
                if (this.ship.debug) {
                    console.log(`PlayerPilot: No valid next asteroid`);
                }
            }
            return;
        }

        // Check for targeted asteroid
        if (this.ship.target instanceof Asteroid && isValidTarget(this.ship, this.ship.target)) {
            this.autopilot = new LandOnAsteroidAutopilot(this.ship, this.ship.target);
            this.autopilot.start();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Autopiloting to targeted asteroid ${this.ship.target.name}`);
            }
            return;
        }

        // Select closest asteroid
        const closestAsteroid = this.ship.starSystem.getClosestAsteroid(this.ship);
        if (closestAsteroid) {
            this.ship.setTarget(closestAsteroid);
            this.autopilot = new LandOnAsteroidAutopilot(this.ship, closestAsteroid);
            this.autopilot.start();
            if (this.ship.debug) {
                console.log(`PlayerPilot: Autopiloting to closest asteroid ${closestAsteroid.name}`);
            }
        } else if (this.ship.debug) {
            console.log(`PlayerPilot: No valid asteroids in system`);
        }
    }

    /**
     * Updates the player's ship based on keyboard input and autopilot state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     */
    update(deltaTime, gameManager) {
        // Helper functions for key states
        const pressed = (key) => gameManager.keys[key] === true && !(gameManager.lastKeys[key] === true);
        const held = (key) => gameManager.keys[key] === true;

        // Disable autopilot and handle takeoff if manual controls are used
        if (pressed('ArrowLeft') || pressed('ArrowRight') || pressed('ArrowUp') || pressed('ArrowDown')) {
            if (this.autopilot?.active) {
                this.autopilot.stop();
                this.autopilot = null;
            }
            if (this.ship.state === 'Landed') {
                this.ship.initiateTakeoff();
            }
        }

        // Planet landing and other interactions ('l' or 'L' key)
        if (pressed('l') || pressed('L')) {
            this.handlePlanetLanding(deltaTime, gameManager);
        }

        // Jump gate navigation ('j' or 'J' key)
        if (pressed('j') || pressed('J')) {
            this.handleJumpGateLanding(deltaTime, gameManager);
        }

        // Asteroid selection ('m' or 'M' key)
        if (pressed('m') || pressed('M')) {
            this.handleAsteroidLanding(deltaTime, gameManager);
        }

        // Hostile ship selection ('r' or 'R' key)
        if (pressed('r') || pressed('R')) {
            this.handleHostileShipSelection(deltaTime, gameManager);
        }

        // Neutral ship selection ('t' or 'T' key)
        if (pressed('t') || pressed('T')) {
            this.handleNeutralShipSelection(deltaTime, gameManager);
        }

        // Allied ship selection ('y' or 'Y' key)
        if (pressed('y') || pressed('Y')) {
            this.handleAlliedShipSelection(deltaTime, gameManager);
        }

        // Update autopilot if active
        if (this.autopilot?.active) {
            this.autopilot.update(deltaTime, gameManager);
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

        // // Interact with target ('l' key)
        // if (pressed('l') && this.ship.state === 'Flying' && this.ship.target) {
        //     if (this.ship.target instanceof JumpGate) {
        //         if (this.ship.target.overlapsPoint(this.ship.position)) {
        //             this.ship.initiateHyperjump(this.ship.target);
        //         } else {
        //             this.autopilot = new TraverseJumpGateAutopilot(this.ship, this.ship.target);
        //             this.autopilot.start();
        //         }
        //     } else if (this.ship.target instanceof CelestialBody) {
        //         if (this.ship.canLand(this.ship.target)) {
        //             this.ship.initiateLanding(this.ship.target);
        //         } else {
        //             this.autopilot = new LandOnPlanetAutopilot(this.ship, this.ship.target);
        //             this.autopilot.start();
        //         }
        //     } else if (this.ship.target instanceof Asteroid) {
        //         if (this.ship.canLand(this.ship.target)) {
        //             this.ship.initiateLanding(this.ship.target);
        //         } else {
        //             this.autopilot = new LandOnAsteroidAutopilot(this.ship, this.ship.target);
        //             this.autopilot.start();
        //         }
        //     }
        // }

        // // Escort a targeted ship ('f' key)
        if (pressed('f') && this.ship.state === 'Flying' && this.ship.target instanceof Ship) {
            this.autopilot = new EscortAutopilot(this.ship, this.ship.target, this.ship.target.radius * 1.5, 500);
            this.autopilot.start();
        }

        if (pressed('a') && this.ship.state === 'Flying' && this.ship.target instanceof GameObject) {
            this.autopilot = new AttackAutopilot(this.ship, this.ship.target);
            this.autopilot.start();
        }

        if (pressed('k')) {
            this.ship.takeDamage(
                this.ship.shield.strength > 0 ? this.ship.shield.strength : this.ship.hullIntegrity,
                this.ship.position, this.ship);
        }
    }
}

// /**
//  * A basic AI pilot that travels between planets and jump gates within a star system.
//  * @extends Pilot
//  */
// export class AiPilot extends Pilot {
//     /**
//      * Creates a new AiPilot instance.
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
//      * @param {StarSystem} starSystem - The star system containing potential destinations.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//                 console.warn(`Invalid ship state '${this.ship.state}' in AiPilot updateIdle`);
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
//                 console.warn(`Invalid ship state '${this.ship.state}' in AiPilot updateIdle`);
//             }
//         }
//     }

//     /**
//      * Handles the FlyingToPlanet state: manages autopilot to reach a planet.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
//      */
//     updateTakingOff(deltaTime, gameManager) {
//         if (this.ship.state === 'Flying') {
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the TraversingJumpGate state: manages autopilot to use a jump gate.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {GameManager} gameManager - The game manager instance.
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
// export class InterdictionAiPilot extends Pilot {
//     /**
//      * Creates a new InterdictionAiPilot instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//                 this.autopilot = new FlyToTargetAutopilot(this.ship, this.target, arrivalDistance, 50);
//                 this.autopilot.start();
//                 this.transitionFromIdle('VisitingBody');
//             } else {
//                 this.updateIdle(deltaTime, gameManager); // Retry if no valid target
//             }
//         } else { // 30% chance to fly to a random point
//             this.target = this.pickRandomPoint();
//             this.autopilot = new FlyToTargetAutopilot(this.ship, { position: this.target }, 100, 50);
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
//             console.warn(`Invalid ship state '${this.ship.state}' in InterdictionAiPilot updateIdle`);
//         }
//     }

//     /**
//      * Handles the FollowingShip state: follows a target ship until time runs out or target is lost.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
// export class EscortAiPilot extends Pilot {
//     /**
//      * Creates a new EscortAiPilot instance.
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
// export class MiningAiPilot extends Pilot {
//     /**
//      * Creates a new MiningAiPilot instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//             console.warn(`Invalid ship state '${this.ship.state}' in MiningAiPilot updateIdle`, this.ship.landedObject);
//         }
//     }

//     /**
//      * Handles the FlyingToAsteroid state: flies to the target asteroid.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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
//      * @param {GameManager} gameManager - The game manager instance.
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