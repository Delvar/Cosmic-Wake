// /src/ship/dockingContext.js

import { Ship } from "/src/ship/ship.js";
import { Asteroid } from "/src/starSystem/asteroidBelt.js";
import { CelestialBody } from "/src/starSystem/celestialBody.js";

/**
 * DockingContext represents the in-game context for a landed or docked ship.
 * It is created when a ship touches down on a celestial body, asteroid, or docks with another ship.
 * This class centralises the available actions and permission checks for the docking UI and AI.
 *
 * Available actions: take off, repair hull (on planet), start mining/stop mining (on asteroids).
 */
export class DockingContext {
    /**
     * Creates a new docking context.
     *
     * @param {CelestialBody|Asteroid|Ship} landedObject - The object that the ship is landed on or docked with.
     * @param {Ship} ship - The ship that is currently in docking state.
     */
    constructor(landedObject, ship) {
        /** @type {CelestialBody|Asteroid|Ship} */
        this.landedObject = landedObject;

        /** @type {Ship} */
        this.ship = ship;

        /** @type {boolean} Whether the ship is allowed to take off. */
        this.hasTakeOffCapability = true;

        /** @type {boolean} Whether hull repair is available, only on celestial bodies. */
        this.hasRepairCapability = this.landedObject instanceof CelestialBody;

        /** @type {boolean} Whether the ship can start mining (only on asteroids). */
        this.hasMiningCapability = this.landedObject instanceof Asteroid;
    }

    /**
     * Debug log helper that delegates to the ship's debug logger.
     * The callback is only evaluated when ship debug logging is enabled.
     *
     * @param {() => void} callback - A function to execute only when debug logging is active.
     * @return {void}
     */
    debugLog(callback) {
        if (this.ship) {
            this.ship.debugLog(callback);
        }
    }

    /**
     * Initiates take off from the current platform and transitions the ship out of docked state.
     * Validates current state and capability, logs errors for invalid calls.
     *
     * @return {boolean} True when take off was successfully requested, false otherwise.
     */
    takeOff() {
        if (!this.ship || !this.landedObject) {
            return false;
        }
        if (!this.hasTakeOffCapability) {
            console.error(`${this.constructor.name}: takeOff Not Valid`);
            return false;
        }
        this.debugLog(() => console.log(`${this.constructor.name}: takeOff`));
        // TODO: Hide UI docking window
        this.ship.initiateTakeoff();
        return true;
    }

    /**
     * Repairs the ship's hull to maximum when landed on a repair-capable celestial body.
     * Updates context capability to prevent repeated repair in the same docking session.
     *
     * @return {boolean} True if repair was performed, false if invalid.
     */
    repairHull() {
        if (!this.ship || !this.landedObject) {
            return false;
        }
        if (!this.hasRepairCapability) {
            console.error(`${this.constructor.name}: repairHull Not Valid`);
            return false;
        }
        this.debugLog(() => console.log(`${this.constructor.name}: repairHull`));
        this.ship.hullIntegrity = this.ship.maxHull;
        //this.hasRepairCapability = false;
        return true;
    }

    /**
     * Starts mining operations when docked on an asteroid.
     * Ensures the ship is not already mining before toggling.
     *
     * @return {boolean} True if mining start was successful, false otherwise.
     */
    startMining() {
        if (!this.ship || !this.landedObject) {
            return false;
        }
        if (!this.hasMiningCapability) {
            console.error(`${this.constructor.name}: startMining Not Valid`);
            return false;
        }
        this.debugLog(() => console.log(`${this.constructor.name}: startMining`));
        if (!this.ship.miningEnabled) {
            this.ship.startMining();
        }
        return true;
    }

    /**
     * Stops mining operations when docked on an asteroid.
     * Safely handles already-stopped mining state.
     *
     * @return {boolean} True if mining stop was successful, false otherwise.
     */
    stopMining() {
        if (!this.ship || !this.landedObject) {
            return false;
        }
        if (!this.hasMiningCapability) {
            console.error(`${this.constructor.name}: stopMining Not Valid`);
            return false;
        }
        this.debugLog(() => console.log(`${this.constructor.name}: stopMining`));
        if (this.ship.miningEnabled) {
            this.ship.stopMining();
        }
        return true;
    }

    /**
     * Dispose of this context when docking interactions are complete.
     * Clears references to help garbage collection and avoid accidental reuse.
     *
     * @return {void}
     */
    dispose() {
        this.hasTakeOffCapability = false;
        this.hasRepairCapability = false;
        this.hasMiningCapability = false;
    }
}
