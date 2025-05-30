// /src/job/job.js

/**
 * Base class for all job types, providing common job functionality.
 */
export class Job {
    /**
     * Creates a new Job instance.
     * @param {Ship} ship - The ship to control.
     * @param {AiPilot} [pilot=null] - The pilot controlling the ship (optional).
     */
    constructor(ship, pilot = null) {
        /** @type {Ship} The ship controlled by this job. */
        this.ship = ship;
        /** @type {AiPilot} The AiPilot using this job. */
        this.pilot = pilot;
        /** @type {string} The current job state (e.g., 'Starting', 'Paused'). */
        this.state = 'Starting';
        /** @type {string|null} The state before pausing, restored on resume. */
        this.pausedState = null;
    }

    /**
     * Updates the job's behavior. Must be overridden by subclasses.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @throws {Error} If not implemented by subclass.
     */
    update(deltaTime, gameManager) {
        throw new Error('update() must be implemented by subclass');
    }

    /**
     * Pauses the job, saving the current state.
     */
    pause() {
        if (this.state !== 'Paused') {
            this.pausedState = this.state;
            this.state = 'Paused';
        }
    }

    /**
     * Resumes the job, restoring the previously saved state.
     */
    resume() {
        if (this.state === 'Paused') {
            this.state = this.pausedState;
        }
    }

    /**
     * Returns the job's status for HUD display.
     * @returns {string} The current state or 'Paused' if paused.
     */
    getStatus() {
        return this.state === 'Paused' ? 'Paused' : this.state;
    }
}