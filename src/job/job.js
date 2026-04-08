// /src/job/job.js

import { GameManager } from "/src/core/game.js";
import { AiPilot } from "/src/pilot/aiPilot.js";
import { Ship } from "/src/ship/ship.js";

/**
 * Base class for all job types, providing common job functionality.
 */
export class Job {
    /**
     * Creates a new Job instance.
     * @param {Ship} ship - The ship to control.
     * @param {AiPilot} pilot - The pilot controlling the ship.
     */
    constructor(ship, pilot) {
        /** @type {Ship} The ship controlled by this job. */
        this.ship = ship;
        /** @type {AiPilot} The AiPilot using this job. */
        this.pilot = pilot;
        /** @type {string} The current job state (e.g., 'Starting', 'Paused'). */
        this.state = 'Starting';
        /** @type {string|null} Error message if the job fails, null if no error. */
        this.error = null;
        /** @type {string|null} The state before pausing, restored on resume. */
        this.pausedState = null;

        if (new.target === Job) Object.seal(this);
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
     * Updates the job's behavior. Must be overridden by subclasses.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     * @throws {Error} If not implemented by subclass.
     */

    update(deltaTime, gameManager) {
        throw new Error('update() must be implemented by subclass');
    }

    /**
     * Pauses the job, saving the current state.
     * @returns {void}
     */
    pause() {
        if (this.state !== 'Paused') {
            this.pausedState = this.state;
            this.state = 'Paused';
        }
    }

    /**
     * Resumes the job, restoring the previously saved state.
     * @returns {void}
     */
    resume() {
        if (this.state === 'Paused') {
            if (this.pausedState) {
                this.state = this.pausedState;
            } else {
                this.state = 'Starting';
            }
        }
    }

    /**
     * Returns the action name by processing the class name, removing 'Job' and adding spaces before capital letters.
     * @returns {string} The action name.
     */
    getActionName() {
        const className = this.constructor.name;
        if (className.endsWith('Job')) {
            const baseName = className.slice(0.0, -3.0); // Remove 'Job'
            // Insert space before each capital letter (except first) and trim
            return baseName.replace(/([A-Z])/g, ' $1').trim();
        }
        return className; // Fallback if no 'Job' suffix
    }

    /**
     * Returns the current status for HUD display.
     * @returns {string} The status string.
     */
    getStatus() {
        const baseStatus = this.state ? `${this.getActionName()} (${this.state})` : this.getActionName();
        return baseStatus;
    }

}