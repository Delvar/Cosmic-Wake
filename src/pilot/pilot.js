// /src/pilot/pilot.js

import { Vector2D } from '/src/core/vector2d.js';
import { JumpGate, Planet } from '/src/starSystem/celestialBody.js';
import { isValidAttackTarget, Ship } from '/src/ship/ship.js';
import { Autopilot } from '/src/autopilot/autopilot.js';
import { LandOnAsteroidAutopilot } from '/src/autopilot/landOnAsteroidAutopilot.js';
import { LandOnPlanetAutopilot } from '/src/autopilot/landOnPlanetAutopilot.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { GameManager } from '/src/core/game.js';
import { FactionRelationship } from '/src/core/faction.js';
import { EscortAutopilot } from '/src/autopilot/escortAutopilot.js';
import { TraverseJumpGateAutopilot } from '/src/autopilot/traverseJumpGateAutopilot.js';
import { BoardShipAutopilot } from '/src/autopilot/boardShipAutopilot.js';
import { CargoCollectorAutopilot } from '/src/autopilot/cargoCollectorAutopilot.js';

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
        /** @type {Autopilot<any>|null} The active autopilot controlling ship navigation (e.g., FlyToTargetAutopilot). */
        this.autopilot = null;

        /**
         * Seals this instance if directly instantiated (`new Shield()`),
         * but skips for subclasses. Prevents adding/deleting properties.
         */
        if (new.target === Pilot) Object.seal(this);
    }

    /**
     * Logs a message to the console if debug mode is enabled.
     * If a callback is passed, it is executed only when debug is true, so the console frame
     * is attributed to the caller location.
     * @param {Function} callback - Callback function
     * @returns {void}
     */
    debugLog(callback) {
        if (this.ship) {
            this.ship.debugLog(callback);
        }
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
        return 'Unknown';
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
        this._scratchDirectionToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Temporary vector for distance to target. */
        this._scratchDistanceToTarget = new Vector2D(0.0, 0.0);

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
        return isValidAttackTarget(source, target, true) &&
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
        return (target.state === 'Flying' || target.state === 'Disabled') && isValidTarget(source, target) && source.getRelationship(target) === FactionRelationship.Neutral;
    }

    /**
     * Validates if a ship is an allied target.
     * @static
     * @param {Ship} source - The source ship.
     * @param {Ship} target - The target ship.
     * @returns {boolean} True if the target is allied and valid, false otherwise.
     */
    static isValidAlliedTarget(source, target) {
        return (target.state === 'Flying' || target.state === 'Disabled') && isValidTarget(source, target) && source.getRelationship(target) === FactionRelationship.Allied;
    }

    /**
     * Validates if a ship is Disabled.
     * @static
     * @param {Ship} source - The source ship.
     * @param {Ship} target - The target ship.
     * @returns {boolean} True if the target ship is Disabled and valid, false otherwise.
     */
    static isValidDisabledTarget(source, target) {
        return target.state === 'Disabled' && isValidTarget(source, target);
    }

    /**
    * Handles hostile ship selection for 'r'/'R' key press.
    * @param {number} deltaTime - Time elapsed since the last update in seconds.
    * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
    * @returns {void}
    */
    handleHostileShipSelection(deltaTime, gameManager) {
        // Check if current target is hostile
        if (this.ship.target instanceof Ship && PlayerPilot.isValidHostileTarget(this.ship, this.ship.target)) {
            const currentShip = this.ship.target;
            const nextShip = this.ship.starSystem.cycleClosestShip(this.ship, currentShip, null, PlayerPilot.isValidHostileTarget);
            if (nextShip) {
                this.ship.setTarget(nextShip);
                this.debugLog(() => console.log(`${this.constructor.name}: Cycled to hostile ship ${nextShip.name}`));
            } else {
                this.ship.setTarget(null);
                this.debugLog(() => console.log(`${this.constructor.name}: No valid next hostile ship`));
            }
            return;
        }

        // Select closest hostile ship
        const closestShip = this.ship.starSystem.getClosestShip(this.ship, null, PlayerPilot.isValidHostileTarget);
        if (closestShip) {
            this.ship.setTarget(closestShip);
            this.debugLog(() => console.log(`${this.constructor.name}: Selected closest hostile ship ${closestShip.name}`));
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: No valid hostile ships in system`));
        }
    }

    /**
     * Handles neutral ship selection for 't'/'T' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     * @returns {void}
     */
    handleNeutralShipSelection(deltaTime, gameManager) {
        // Check if current target is neutral
        if (this.ship.target instanceof Ship && PlayerPilot.isValidNeutralTarget(this.ship, this.ship.target)) {
            const currentShip = this.ship.target;
            const nextShip = this.ship.starSystem.cycleClosestShip(this.ship, currentShip, null, PlayerPilot.isValidNeutralTarget);
            if (nextShip) {
                this.ship.setTarget(nextShip);
                this.debugLog(() => console.log(`${this.constructor.name}: Cycled to neutral ship ${nextShip.name}`));
            } else {
                this.ship.setTarget(null);
                this.debugLog(() => console.log(`${this.constructor.name}: No valid next neutral ship`));
            }
            return;
        }

        // Select closest neutral ship
        const closestShip = this.ship.starSystem.getClosestShip(this.ship, null, PlayerPilot.isValidNeutralTarget);
        if (closestShip) {
            this.ship.setTarget(closestShip);
            this.debugLog(() => console.log(`${this.constructor.name}: Selected closest neutral ship ${closestShip.name}`));
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: No valid neutral ships in system`));
        }
    }

    /**
     * Handles allied ship selection for 'y'/'Y' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     * @returns {void}
     */
    handleAlliedShipSelection(deltaTime, gameManager) {
        // Check if current target is allied
        if (this.ship.target instanceof Ship && PlayerPilot.isValidAlliedTarget(this.ship, this.ship.target)) {
            const currentShip = this.ship.target;
            const nextShip = this.ship.starSystem.cycleClosestShip(this.ship, currentShip, null, PlayerPilot.isValidAlliedTarget);
            if (nextShip) {
                this.ship.setTarget(nextShip);
                this.debugLog(() => console.log(`${this.constructor.name}: Cycled to allied ship ${nextShip.name}`));
            } else {
                this.ship.setTarget(null);
                this.debugLog(() => console.log(`${this.constructor.name}: No valid next allied ship`));
            }
            return;
        }

        // Select closest allied ship
        const closestShip = this.ship.starSystem.getClosestShip(this.ship, null, PlayerPilot.isValidAlliedTarget);
        if (closestShip) {
            this.ship.setTarget(closestShip);
            this.debugLog(() => console.log(`${this.constructor.name}: Selected closest allied ship ${closestShip.name}`));
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: No valid allied ships in system`));
        }
    }

    /**
     * Handles planet landing for 'l'/'L' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     * @returns {void}
     */
    handlePlanetLanding(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            if (!this.ship.dockingContext) {
                throw new TypeError('dockingContext is missing on Landed ship');
            }
            if (this.ship.dockingContext.landedObject instanceof Planet) {
                this.ship.dockingContext.takeOff();
                return;
            }
        }

        // Check if over a landable planet
        const planets = this.ship.starSystem.planets;
        let overPlanet = null;
        for (const planet of planets) {
            const canLand = this.ship.canLand(planet);
            this.debugLog(() => console.log(`Checking planet ${planet.name}: canLand=${canLand}`));
            if (isValidTarget(this.ship, planet) && canLand) {
                overPlanet = planet;
                break;
            }
        }
        if (overPlanet) {
            this.ship.setTarget(overPlanet);
            this.ship.initiateLanding(overPlanet);
            this.debugLog(() => console.log(`${this.constructor.name}: Landing on planet ${overPlanet.name}`));
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
                this.debugLog(() => console.log(`${this.constructor.name}: Cycled to planet ${nextPlanet.name}`));
            } else {
                this.autopilot.stop();
                this.autopilot = null;
                this.debugLog(() => console.log(`${this.constructor.name}: No valid next planet`));
            }
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
            return;
        }

        // Check for targeted planet
        if (this.ship.target instanceof Planet && isValidTarget(this.ship, this.ship.target)) {
            this.autopilot = new LandOnPlanetAutopilot(this.ship, this.ship.target);
            this.autopilot.start();
            this.debugLog(() => console.log(`${this.constructor.name}: Autopiloting to targeted planet ${this.ship.target?.name}`));
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
            return;
        }

        // Select closest planet
        const closestPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
        if (closestPlanet) {
            this.ship.setTarget(closestPlanet);
            this.autopilot = new LandOnPlanetAutopilot(this.ship, closestPlanet);
            this.autopilot.start();
            this.debugLog(() => console.log(`${this.constructor.name}: Autopiloting to closest planet ${closestPlanet.name}`));
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: No valid planets in system`));
        }
    }

    /**
     * Handles jump gate navigation for 'j'/'J' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     * @returns {void}
     */
    handleJumpGateLanding(deltaTime, gameManager) {
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
                this.debugLog(() => console.log(`${this.constructor.name}: Cycled to jump gate ${nextGate.name}`));
            } else {
                this.autopilot.stop();
                this.autopilot = null;
                this.debugLog(() => console.log(`${this.constructor.name}: No valid next jump gate`));
            }
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
            return;
        }

        // Check for targeted jump gate
        if (this.ship.target instanceof JumpGate && isValidTarget(this.ship, this.ship.target)) {
            this.autopilot = new TraverseJumpGateAutopilot(this.ship, this.ship.target);
            this.autopilot.start();
            this.debugLog(() => console.log(`${this.constructor.name}: Autopiloting to targeted jump gate ${this.ship.target?.name}`));
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
            return;
        }

        // Select closest jump gate
        const closestGate = this.ship.starSystem.getClosestJumpGate(this.ship);
        if (closestGate) {
            this.ship.setTarget(closestGate);
            this.autopilot = new TraverseJumpGateAutopilot(this.ship, closestGate);
            this.autopilot.start();
            this.debugLog(() => console.log(`${this.constructor.name}: Autopiloting to closest jump gate ${closestGate.name}`));
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: No valid jump gates in system`));
        }
    }

    /**
     * Handles asteroid selection for 'm'/'M' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     * @returns {void}
     */
    handleAsteroidLanding(deltaTime, gameManager) {
        if (this.ship.state === 'Landed' && this.ship.dockingContext?.landedObject instanceof Asteroid) {
            this.ship.dockingContext.takeOff();
            return;
        }

        // Check if over an asteroid
        const asteroids = this.ship.starSystem.asteroids;
        let overAsteroid = null;
        for (const asteroid of asteroids) {
            const canLand = this.ship.canLand(asteroid);
            this.debugLog(() => console.log(`Checking asteroid ${asteroid.name}: canLand=${canLand}`));
            if (isValidTarget(this.ship, asteroid) && canLand) {
                overAsteroid = asteroid;
                break;
            }
        }
        if (overAsteroid) {
            this.ship.setTarget(overAsteroid);
            this.ship.initiateLanding(overAsteroid);
            this.debugLog(() => console.log(`${this.constructor.name}: Landing on asteroid ${overAsteroid.name}`));
            return;
        }

        // Check for active LandOnAsteroidAutopilot
        if (this.autopilot instanceof LandOnAsteroidAutopilot && this.autopilot.active) {
            const currentAsteroid = this.autopilot.target;
            const nextAsteroid = this.ship.starSystem.cycleClosestAsteroid(this.ship, currentAsteroid);
            if (nextAsteroid) {
                this.autopilot.stop();
                this.ship.setTarget(nextAsteroid);
                this.autopilot = new LandOnAsteroidAutopilot(this.ship, nextAsteroid);
                this.autopilot.start();
                this.debugLog(() => console.log(`${this.constructor.name}: Cycled to asteroid ${nextAsteroid.name}`));
            } else {
                this.autopilot.stop();
                this.autopilot = null;
                this.debugLog(() => console.log(`${this.constructor.name}: No valid next asteroid`));
            }
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
            return;
        }

        // Check for targeted asteroid
        if (this.ship.target instanceof Asteroid && isValidTarget(this.ship, this.ship.target)) {
            this.autopilot = new LandOnAsteroidAutopilot(this.ship, this.ship.target);
            this.autopilot.start();
            this.debugLog(() => console.log(`${this.constructor.name}: Autopiloting to targeted asteroid ${this.ship.target?.name}`));
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
            return;
        }

        // Select closest asteroid
        const closestAsteroid = this.ship.starSystem.getClosestAsteroid(this.ship);
        if (closestAsteroid) {
            this.ship.setTarget(closestAsteroid);
            this.autopilot = new LandOnAsteroidAutopilot(this.ship, closestAsteroid);
            this.autopilot.start();
            this.debugLog(() => console.log(`${this.constructor.name}: Autopiloting to closest asteroid ${closestAsteroid.name}`));
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: No valid asteroids in system`));
        }
    }

    /**
     * Handles cargo collection autopilot for 'c'/'C' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     * @returns {void}
     */
    handleCargoCollection(deltaTime, gameManager) {
        if (this.autopilot instanceof CargoCollectorAutopilot && this.autopilot.active) {
            this.autopilot.stop();
            this.autopilot = null;
            this.debugLog(() => console.log(`${this.constructor.name}: Stopped cargo collection`));
            return;
        }

        if (this.ship.isCargoFull()) {
            this.debugLog(() => console.log(`${this.constructor.name}: Cannot start cargo collection, cargo full`));
            return;
        }

        const manager = this.ship.starSystem.cargoContainerManager;
        if (!manager.getClosestContainer(this.ship)) {
            this.debugLog(() => console.log(`${this.constructor.name}: No cargo containers in system`));
            return;
        }

        this.autopilot = new CargoCollectorAutopilot(this.ship);
        this.autopilot.start();
        this.debugLog(() => console.log(`${this.constructor.name}: Started cargo collection`));
    }

    /**
     * Handles boarding ship selection for 'b'/'B' key press.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     * @returns {void}
     */
    handleBoardingShipSelection(deltaTime, gameManager) {
        if (this.ship.state === 'Landed' && this.ship.dockingContext?.landedObject instanceof Ship) {
            this.ship.dockingContext.takeOff();
            return;
        }

        // Check for active BoardShipAutopilot
        if (this.autopilot instanceof BoardShipAutopilot && this.autopilot.active) {
            const currentShip = this.autopilot.target;
            const nextShip = this.ship.starSystem.cycleClosestShip(this.ship, currentShip, null, PlayerPilot.isValidDisabledTarget);
            if (nextShip) {
                this.autopilot.stop();
                this.ship.setTarget(nextShip);
                this.autopilot = new BoardShipAutopilot(this.ship, nextShip);
                this.autopilot.start();
                this.debugLog(() => console.log(`${this.constructor.name}: Cycled to ship ${nextShip.name}`));
            } else {
                this.autopilot.stop();
                this.autopilot = null;
                this.debugLog(() => console.log(`${this.constructor.name}: No valid next ship`));
            }
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
            return;
        }

        // Check for targeted ship
        if (this.ship.target instanceof Ship && PlayerPilot.isValidDisabledTarget(this.ship, this.ship.target)) {
            this.autopilot = new BoardShipAutopilot(this.ship, this.ship.target);
            this.autopilot.start();
            this.debugLog(() => console.log(`${this.constructor.name}: Autopiloting to targeted ship ${this.ship.target?.name}`));
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
            return;
        }

        // Select closest disabled ship
        const closestShip = this.ship.starSystem.getClosestShip(this.ship, null, PlayerPilot.isValidDisabledTarget);
        if (closestShip) {
            this.ship.setTarget(closestShip);
            this.autopilot = new BoardShipAutopilot(this.ship, closestShip);
            this.autopilot.start();
            this.debugLog(() => console.log(`${this.constructor.name}: Autopiloting to closest disabled ship ${closestShip.name}`));
            if (this.autopilot && this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
            }
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: No valid disabled ships in system`));
        }
    }

    /**
     * Updates the player's ship based on keyboard input and autopilot state.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager with keys and lastKeys properties.
     * @returns {void}
     */
    update(deltaTime, gameManager) {
        // Helper functions for key states
        const pressed = (/** @type {string} */ key) => gameManager.keys[key] === true && !(gameManager.lastKeys[key] === true);
        const held = (/** @type {string} */ key) => gameManager.keys[key] === true;

        // Disable autopilot and handle takeoff if manual controls are used
        if (pressed('ArrowLeft') || pressed('ArrowRight') || pressed('ArrowUp') || pressed('ArrowDown')) {
            if (this.autopilot?.active) {
                this.autopilot.stop();
                this.autopilot = null;
            }
            if (this.ship.state === 'Landed') {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
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

        // Check for turret mode switch
        if (pressed('u') || pressed('U')) {
            this.ship.cycleTurretMode();
            this.debugLog(() => console.log(`${this.constructor.name}: Turret mode changed to: ${this.ship.turretMode}`));
        }

        // Cargo collection ('c' or 'C' key)
        if (pressed('c') || pressed('C')) {
            this.handleCargoCollection(deltaTime, gameManager);
        }

        // Boarding ship selection ('b' or 'B' key)
        if (pressed('b') || pressed('B')) {
            this.handleBoardingShipSelection(deltaTime, gameManager);
        }

        // Retrieving Cargo toggle ('p' or 'P' key)
        if (pressed('p') || pressed('P')) {
            if (this.ship.isRetrievingCargo) {
                this.ship.stopRetrievingCargo();
            } else {
                this.ship.startRetrievingCargo();
            }
        }

        // Jettison toggle ('d')
        if (pressed('d')) {
            if (this.ship.isJettisoningCargo) {
                this.ship.stopJettison();
            } else {
                this.ship.startJettison();
            }
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
        if (this.ship.state === 'Flying') {
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
            if (held(' ')) {
                this.ship.fire();
            }

            // // Escort a targeted ship ('f' key)
            if (pressed('f') && this.ship.target instanceof Ship) {
                this.autopilot = new EscortAutopilot(this.ship, this.ship.target, this.ship.target.radius * 1.5, 500.0);
                this.autopilot.start();
            }

            if (pressed('a') && this.ship.target instanceof Ship) {
                this.autopilot = new AttackAutopilot(this.ship, this.ship.target, this.ship.target.state !== 'Disabled');
                this.autopilot.start();
            }

        }
    }
}