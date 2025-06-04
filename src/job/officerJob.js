// /src/job/pirateJob.js

import { Job } from '/src/job/job.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { isValidAttackTarget } from '/src/ship/ship.js';
import { AiPilot, PirateAiPilot } from '/src/pilot/aiPilot.js';
import { PlayerPilot } from '/src/pilot/pilot.js';
import { LandOnPlanetAutopilot } from '/src/autopilot/autopilot.js';
import { Ship } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';
import { GameObject } from '/src/core/gameObject.js';

/**
 * Job for a ship to attack pirats in the system.
 * @extends Job
 */
export class OfficerJob extends Job {
    /**
     * Creates a new OfficerJob instance.
     * @param {Ship} ship - The ship to control.
     * @param {AiPilot} [pilot=null] - The pilot controlling the ship (optional).
     */
    constructor(ship, pilot = null) {
        super(ship, pilot);
        /** @type {string} The current job state ('Starting'). */
        this.state = 'Starting';
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Starting': this.updateStarting.bind(this),
            'Waiting': this.updateWaiting.bind(this),
            'Landing': this.updateLanding.bind(this)
        };
    }

    /**
     * Updates the job's behavior by delegating to the current state handler.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (this.ship.target && this.ship.target instanceof Ship) {
            if (!this.isValidOfficerTarget(this.ship, this.ship.target)) {
                this.ship.target = null;
            }
        }

        if (this.pilot.threat && this.pilot.threat instanceof Ship) {
            if (!this.isValidOfficerTarget(this.ship, this.pilot.threat)) {
                this.pilot.threat = null;
            }
        }

        if (this.pilot.threat && !this.ship.target) {
            this.ship.target = this.pilot.threat;
        }

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
            this.state = 'Waiting';
            return;
        }
        if (this.ship.state === 'Flying') {
            const target = this.ship.starSystem.getRandomShip(this.ship, null, this.isValidOfficerTarget);
            if (target) {
                this.pilot.threat = target;
                this.ship.target = target;
                this.pilot.changeState('Attack', new AttackAutopilot(this.ship, this.ship.target));
                return;
            } else {
                const targetPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
                if (targetPlanet) {
                    this.ship.target = targetPlanet;
                    this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, targetPlanet));
                    this.state = 'Landing';
                    return;
                }
            }
        }
    }

    /**
     * Handles the 'Landing' state, find the closest planet and land, then wait.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateLanding(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Waiting but not landed, transitioning to Waiting`);
            }
            this.state = 'Waiting';
            return;
        }
        if (!this.pilot.autopilot) {
            this.state = 'Starting';
            return;
        }
    }

    /**
     * Handles the 'Waiting' state, delaying before re-Starting.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateWaiting(deltaTime, gameManager) {
        if (this.ship.state !== 'Landed') {
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Waiting but not landed, transitioning to Starting`);
            }
            this.state = 'Starting';
            return;
        }
        const target = this.ship.starSystem.getRandomShip(this.ship, null, this.isValidOfficerTarget);
        if (target) {
            this.pilot.threat = target;
            this.ship.target = target;
            this.pilot.changeState('Attack', new AttackAutopilot(this.ship, this.ship.target));
            this.ship.initiateTakeoff();
            return;
        }
    }

    /**
     * Checks if a target is valid, normal checks and not Pirate.
     * @param {GameObject} source - The source game object to validate.
     * @param {GameObject} target - The target game object to validate.
     * @returns {boolean} True if the target is valid, false otherwise.
     */
    isValidOfficerTarget(source, target) {
        if (!isValidAttackTarget(source, target)) return false;
        if (target instanceof Ship && target.pilot instanceof PirateAiPilot) return true;
        return false;
    }

    /**
     * Returns the job's status for HUD display.
     * @returns {string} A descriptive status message.
     */
    getStatus() {
        return this.state;
    }
}