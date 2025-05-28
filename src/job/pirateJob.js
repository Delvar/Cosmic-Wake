// /src/job/pirateJob.js

import { Job } from '/src/job/job.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { isValidAttackTarget } from '/src/ship/ship.js';
import { PirateAiPilot } from '/src/pilot/aiPilot.js';

/**
 * Job for a ship to attack other ships in the system.
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
            console.log(`${this.constructor.name}: Invalid state ${this.state}`);
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
                console.log(`${this.constructor.name}: Initial start, initiating takeoff`);
            }
            this.ship.initiateTakeoff();
        } else if (this.ship.state === 'Flying') {

            //const target = this.ship.starSystem.getClosestShip(this.ship, null);
            const target = this.ship.starSystem.getRandomShip(this.ship, null, this.isValidPirateTarget);

            if (target) {
                this.pilot.threat = target;
                this.ship.target = target;
                this.pilot.changeState('Attack', new AttackAutopilot(this.ship, target));
                if (this.ship.debug) {
                    console.log(`${this.constructor.name}: Ship flying, found target, Attacking`);
                }
            }
        }
    }

    /**
     * Checks if a target is valid, normal checks and not Pirate.
     * @param {GameObject} source - The source game object to validate.
     * @param {GameObject} target - The target game object to validate.
     * @returns {boolean} True if the target is valid, false otherwise.
     */
    isValidPirateTarget(source, target) {
        if (!isValidAttackTarget(source, target)) return false;
        if (target.pilot instanceof PirateAiPilot) return false;
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