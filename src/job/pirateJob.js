// /src/job/pirateJob.js

import { PirateAIPilot } from '/src/pilot/aiPilot.js';
import { Job } from '/src/job/job.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { Ship } from '/src/ship/ship.js';

/**
 * Job for a ship to wander between planets, prioritizing different star systems.
 * @extends Job
 */
export class PirateJob extends Job {
    /**
     * Creates a new PirateJob instance.
     * @param {Ship} ship - The ship to control.
     * @param {AIPilot} [pilot=null] - The pilot controlling the ship (optional).
     */
    constructor(ship, pilot = null) {
        super(ship, pilot);
        /** @type {string} The current job state ('Starting'). */
        this.state = 'Starting';
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Starting': this.updateStarting.bind(this)
        };
    }

    /**
     * Updates the job's behavior by delegating to the current state handler.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        } else if (this.ship.debug) {
            console.log(`PirateJob: Invalid state ${this.state}`);
        }
    }

    /**
     * Handles the 'Starting' state, initiating takeoff if landed.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateStarting(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            if (this.ship.debug) {
                console.log('PirateJob: Initial start, initiating takeoff');
            }
            this.ship.initiateTakeoff();
        } else if (this.ship.state === 'Flying') {

            //const target = this.ship.starSystem.getClosestShip(this.ship, null);
            const target = this.ship.starSystem.getRandomShip(this.ship, null, this.isValidTarget);

            if (target) {
                this.pilot.threat = target;
                this.ship.target = target;
                this.pilot.setAutopilot(new AttackAutopilot(this.ship, target));
                this.pilot.changeState('Attack');
                if (this.ship.debug) {
                    console.log('PirateJob: Ship flying, found target, Attacking');
                }
            }
        }
    }

    /**
     * Checks if a target is still valid (not despawned and exists in the galaxy).
     * @param {GameObject} source - The source game object to validate.
     * @param {GameObject} target - The target game object to validate.
     * @returns {boolean} True if the target is valid, false otherwise.
     */
    isValidTarget(source, target) {
        if (!(target instanceof Ship)) return false;
        if (!isValidTarget(source, target)) return false;
        if (target.state !== 'Landed' && target.state !== 'Disabled') return false;
        if (target.pilot instanceof PirateAIPilot) return false;
        return true;
    }

    /**
     * Returns the job's status for HUD display.
     * @returns {string} A descriptive status message.
     */
    getStatus() {
        return 'Looking for target';
    }
}