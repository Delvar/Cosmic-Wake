// /src/job/escortJob.js

import { AttackAutopilot } from "/src/autopilot/attackAutopilot.js";
import { EscortAutopilot } from '/src/autopilot/escortAutopilot.js';
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
     * @param {AiPilot} pilot - The pilot controlling the ship (optional).
     * @param {Ship} escortedShip - The ship to escort.
     */
    constructor(ship, pilot, escortedShip) {
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
     * @returns {void}
     */
    update(deltaTime, gameManager) {
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: Invalid state ${this.state}`));
            this.error = `Invalid state: ${this.state}`;
            this.state = 'Failed';
        }
        if (this.ship.state === 'Landed') {
            if (this.ship.colors.wings !== this.target.colors.wings) {
                this.ship.colors.wings = this.target.colors.wings;
            }
            if (this.ship.colors.hull !== this.target.colors.hull) {
                this.ship.colors.hull = this.target.colors.hull;
            }
            if (this.ship.trail.color !== this.target.trail.color) {
                this.ship.trail.color = this.target.trail.color;
            }
        }
    }

    /**
     * Handles the 'Starting' state, validating the escorted ship and initializing escorting.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    updateStarting(deltaTime, gameManager) {
        if (!this.target || this.target.isDespawned() || !(this.target instanceof Ship)) {
            this.debugLog(() => console.log(`${this.constructor.name}: Invalid or despawned escorted ship, failing job`));
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
     * @returns {void}
     */
    updateEscorting(deltaTime, gameManager) {
        if (!this.target || this.target.isDespawned()) {
            this.debugLog(() => console.log(`${this.constructor.name}: Escorted ship despawned, failing job`));
            this.error = 'Escorted ship despawned';
            this.state = 'Failed';
            return;
        }

        if (this.pilot.state !== 'Attack') {
            if (this.target.lastAttacker && isValidTarget(this.ship, this.target.lastAttacker)) {
                this.debugLog(() => console.log(`${this.constructor.name}: Escorted ship attacked by ${this.target?.lastAttacker?.name}, switching to Attack state`));
                this.pilot.changeState('Attack', new AttackAutopilot(this.ship, this.target.lastAttacker, true));
            } else if (!this.pilot.autopilot || !this.pilot.autopilot.active) {
                this.debugLog(() => console.log(`${this.constructor.name}: Reinstating EscortAutopilot for ${this.target.name}`));
                this.pilot.setAutopilot(new EscortAutopilot(this.ship, this.target));
                this.state = 'Escorting';
            }
        }
    }

    /**
     * Resumes the job, resetting to Starting state.
     * @returns {void}
     */
    resume() {
        super.resume();
        this.state = 'Starting';
        this.debugLog(() => console.log(`${this.constructor.name}: Resumed, transitioning to Starting`));
    }
}