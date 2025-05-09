// ai/job.js

/**
 * Base class for all job types, providing common job functionality.
 */
export class Job {
    /**
     * Creates a new Job instance.
     * @param {Ship} ship - The ship to control.
     */
    constructor(ship) {
        this.ship = ship;
        this.state = 'Starting';
        this.pausedState = null;
    }

    /**
     * Updates the job's behavior. Must be overridden by subclasses.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {AIPilot} pilot - The controlling AI pilot.
     */
    update(deltaTime, pilot) {
        throw new Error('update() must be implemented by subclass');
    }

    /**
     * Pauses the job, saving state.
     */
    pause() {
        this.pausedState = this.state;
        this.state = 'Paused';
    }

    /**
     * Resumes the job, restoring state.
     */
    resume() {
        if (this.state === 'Paused') {
            this.state = this.pausedState;
        }
    }

    /**
     * Returns the job's status for HUD. Can be overridden.
     * @returns {string} Status message.
     */
    getStatus() {
        return this.state === 'Paused' ? 'Paused' : this.state;
    }
}