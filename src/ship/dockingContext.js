// /src/ship/dockingContext.js

import { Ship } from "/src/ship/ship.js";
import { Asteroid } from "/src/starSystem/asteroidBelt.js";
import { CelestialBody } from "/src/starSystem/celestialBody.js";

/**
 * Short-lived object created when a ship lands on a planet.
 * Acts as the single funnel for all docked interactions (player UI + AI).
 * Contains only Take Off for this initial implementation.
 */
export class DockingContext {
    /**
     * @param {CelestialBody|Asteroid|Ship|null} landedObject
     * @param {Ship} ship
     */
    constructor(landedObject, ship) {
        /** @type {CelestialBody|Asteroid|Ship|null} Object the ship is landed on/docked with. */
        this.landedObject = landedObject;
        /** @type {Ship|null} The ship that is landed/docked. */
        this.ship = ship;
        /** @type {boolean} Can we take off? */
        this.hasTakeOffCapability = true;
    }

    /**
     * Logs a message to the console if debug mode is enabled.
     * If a callback is passed, it is executed only when debug is true, so the console frame
     * is attributed to the caller location.
     * @param {Function} callback - Callback function
     */
    debugLog(callback) {
        if (this.ship) {
            this.ship.debugLog(callback);
        }
    }

    /**
     * Trigger take off.
     */
    takeOff() {
        if (!this.hasTakeOffCapability) {
            console.log(`${this.constructor.name}: takeOff Not Valid`);
            return false;
        }
        this.debugLog(() => console.log(`${this.constructor.name}: takeOff`));
        // TODO: Hide UI docking window
        this.ship.initiateTakeoff();
        return true;
    }

    /**
     * Dispose of this docking context, clearing references for GC.
     */
    dispose() {
        this.landedObject = null;
        this.ship = null;
        this.hasTakeOffCapability = false;
    }
}
