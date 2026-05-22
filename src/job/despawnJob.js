// /src/job/despawnJob.js

import { Job } from '/src/job/job.js';
import { LandOnPlanetDespawnAutopilot } from '/src/autopilot/landOnPlanetDespawnAutopilot.js';
import { GameManager } from '/src/core/game.js';
import { AiPilot } from '/src/pilot/aiPilot.js';
import { Ship } from '/src/ship/ship.js';

/**
 * Job that keeps a ship on the despawn path by sending it back to the Despawning state.
 * @augments Job
 */
export class DespawnJob extends Job {
    /**
     * Creates a new DespawnJob instance.
     * @param {Ship} ship - The ship to despawn.
     * @param {AiPilot} pilot - The pilot controlling the ship.
     */
    constructor(ship, pilot) {
        super(ship, pilot);
        /** @type {string} The current job state. */
        this.state = 'Starting';

        if (new.target === DespawnJob) Object.seal(this);
    }

    /**
     * Updates the job by ensuring the pilot remains on the despawn autopilot.
     * @param {number} _deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} _gameManager - The game manager instance.
     * @returns {void}
     */
    update(_deltaTime, _gameManager) {
        if (!this.pilot) {
            return;
        }

        if (this.pilot.state !== 'Despawning' || !(this.pilot.autopilot instanceof LandOnPlanetDespawnAutopilot)) {
            this.debugLog(() => console.log(`${this.constructor.name}: Forcing pilot back to Despawning`));
            this.pilot.changeState('Despawning', new LandOnPlanetDespawnAutopilot(this.ship));
        }
    }
}
