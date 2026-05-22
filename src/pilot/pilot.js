// /src/pilot/pilot.js

import { Ship } from '/src/ship/ship.js';
import { Autopilot } from '/src/autopilot/autopilot.js';
import { GameManager } from '/src/core/game.js';

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
     * @param {number} _deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} _gameManager - The game manager instance providing input and context.
     * @throws {Error} Must be implemented by subclasses.
     */
    update(_deltaTime, _gameManager) {
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