// /src/job/escortJob.js

import { AttackAutopilot } from "/src/autopilot/attackAutopilot.js";
import { EscortAutopilot } from "/src/autopilot/autopilot.js";
import { GameManager } from "/src/core/game.js";
import { isValidTarget } from "/src/core/gameObject.js";
import { Job } from "/src/job/job.js";
import { AiPilot } from "/src/pilot/aiPilot.js";
import { Ship } from "/src/ship/ship.js";

/**
 * A job that makes a ship escort another, attacking threats if the escorted ship is attacked.
 * @extends Job
 */
export class EscortJob extends Job {
    /**
     * Creates a new EscortJob instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} escortedShip - The ship to escort.
     * @param {AiPilot} [pilot=null] - The pilot controlling the ship (optional).
     */
    constructor(ship, escortedShip, pilot) {
        super(ship, pilot);
        /** @type {string} The current job state ('Starting', 'Escorting', 'Failed'). */
        this.state = 'Starting';
        /** @type {Ship} The ship to escort. */
        this.target = escortedShip;
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Starting': this.updateStarting.bind(this),
            'Escorting': this.updateEscorting.bind(this),
            'Failed': () => { }
        };

        if (new.target === EscortJob) Object.seal(this);
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
            console.warn(`EscortJob: Invalid state ${this.state}`);
            this.error = `Invalid state: ${this.state}`;
            this.state = 'Failed';
        }
    }

    /**
     * Handles the 'Starting' state, validating the escorted ship and initializing escorting.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateStarting(deltaTime, gameManager) {
        if (!this.target || this.target.isDespawned() || !(this.target instanceof Ship)) {
            if (this.ship.debug) {
                console.warn('EscortJob: Invalid or despawned escorted ship, failing job');
            }
            this.error = 'Invalid or despawned escorted ship';
            this.state = 'Failed';
            return;
        }
        this.state = 'Escorting';
    }

    /**
     * Handles the 'Escorting' state, monitoring for attacks and managing EscortAutopilot.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateEscorting(deltaTime, gameManager) {
        if (!this.target || this.target.isDespawned()) {
            if (this.ship.debug) {
                console.warn('EscortJob: Escorted ship despawned, failing job');
            }
            this.error = 'Escorted ship despawned';
            this.state = 'Failed';
            return;
        }

        if (this.pilot.state !== 'Attack') {
            if (this.target.lastAttacker && isValidTarget(this.ship, this.target.lastAttacker)) {
                if (this.ship.debug) {
                    console.log(`EscortJob: Escorted ship attacked by ${this.target.lastAttacker.name}, switching to Attack state`);
                }
                this.pilot.changeState('Attack', new AttackAutopilot(this.ship, this.target.lastAttacker));
            } else if (!this.pilot.autopilot || !this.pilot.autopilot.active) {
                if (this.ship.debug) {
                    console.log(`EscortJob: Reinstating EscortAutopilot for ${this.target.name}`);
                }
                this.pilot.setAutopilot(new EscortAutopilot(this.ship, this.target));
                this.state = 'Escorting';
            }
        }
    }

    /**
     * Resumes the job, resetting to Starting state.
     */
    resume() {
        super.resume();
        this.state = 'Starting';
        if (this.ship.debug) {
            console.log(`EscortJob: Resumed, transitioning to Starting`);
        }
    }
}