// /src/job/pirateJob.js

import { Job } from '/src/job/job.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { FleeAutopilot } from '/src/autopilot/fleeAutopilot.js';
import { CargoCollectorAutopilot } from '/src/autopilot/cargoCollectorAutopilot.js';
import { isValidAttackTarget, Ship } from '/src/ship/ship.js';
import { AiPilot } from '/src/pilot/aiPilot.js';
import { PirateAiPilot } from '/src/pilot/pirateAiPilot.js';
import { GameManager } from '/src/core/game.js';
import { FactionRelationship } from '/src/core/faction.js';
import { LandOnPlanetDespawnAutopilot } from '/src/autopilot/landOnPlanetDespawnAutopilot.js';

/**
 * Job for pirate ships to take off and attack non-pirate targets.
 * @extends Job
 */
export class PirateJob extends Job {
    /**
     * Creates a new PirateJob instance.
     * @param {Ship} ship - The ship to control.
     * @param {AiPilot} [pilot=null] - The pilot controlling the ship (optional).
     * @param {boolean} [attackDisabledShips=false] - Whether to attack ships that are disabled.
     */
    constructor(ship, pilot = null, attackDisabledShips = false) {
        super(ship, pilot);
        /** @type {boolean} Whether to attack a ship that is disabled. */
        this.attackDisabledShips = attackDisabledShips;
        /** @type {string} The current job state ('Starting', 'Hunting', 'Collecting', 'Failed'). */
        this.state = 'Starting';
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Starting': this.updateStarting.bind(this),
            'Hunting': this.updateHunting.bind(this),
            'Collecting': this.updateCollecting.bind(this),
            'Failed': () => { }
        };
        /** @type {number} Interval (seconds) between target scans in Hunting state. */
        this.targetScanInterval = 1.0;
        /** @type {number} Ship age (seconds) when the next target scan is due. */
        this.nextTargetScan = 0.0;

        if (new.target === PirateJob) Object.seal(this);
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
            console.warn(`${this.constructor.name}: Invalid state ${this.state}`);
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
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Ship flying, transitioning to Collecting`);
            }
            this.state = 'Collecting';
        }
    }

    /**
     * Handles the 'Hunting' state, scanning for targets to attack.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateHunting(deltaTime, gameManager) {
        if (this.ship.state !== 'Flying') {
            this.sate = 'Starting';
            return;
        }

        //If we are attacking and we spot some cargo, break off and go collect it.
        if (this.ship.starSystem.cargoContainerManager.hasCargoContainer()) {
            if (this.ship.debug) {
                console.log('AiPilot: Spotted cargo, transitioning to Collecting');
            }
            this.state = 'Collecting';
            return;
        }

        if (this.pilot.state === 'Attack') {
            // Already attacking, let PirateAiPilot handle
            return;
        }

        if (this.ship.age >= this.nextTargetScan) {
            this.nextTargetScan = this.ship.age + this.targetScanInterval;

            // Prioritize hostiles
            let target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));

            // Fallback to ship with most cargo
            if (!target) {
                let maxCargo = 0;
                for (const s of this.ship.starSystem.ships) {
                    if (PirateJob.isValidPirateTarget(this.ship, s) && s.cargoUsed > maxCargo) {
                        target = s;
                        maxCargo = s.cargoUsed;
                    }
                }
            }

            if (target) {
                this.ship.target = target;
                this.pilot.changeState('Attack', new AttackAutopilot(this.ship, target, !this.attackDisabledShips));
                if (this.ship.debug) {
                    console.log(`${this.constructor.name}: Found target ${target.name}, initiating Attack`);
                }
            } else if (this.ship.debug) {
                console.log(`${this.constructor.name}: No valid target found`);
            }
        }
    }

    /**
     * Handles the 'Collecting' state, collecting cargo or fleeing if full.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateCollecting(deltaTime, gameManager) {
        // use CargoCollectorAutopilot
        if (!this.pilot.autopilot || !(this.pilot.autopilot instanceof CargoCollectorAutopilot)) {
            this.pilot.setAutopilot(new CargoCollectorAutopilot(this.ship));
        }

        //Did the auto pilot complete? we either have no cargo room left or there are no cargo containers available.
        if (this.pilot.autopilot.isComplete()) {
            if (this.ship.isCargoFull()) {
                //FIXME: need to add a state where the pirate heads home to sell or repair.
                if (this.ship.debug) {
                    console.log('AiPilot: Job ended, Pirate Cargo Full, transitioning to Despawning');
                }
                this.pilot.changeState('Despawning', new LandOnPlanetDespawnAutopilot(this.ship));
            } else {
                if (this.ship.debug) {
                    console.log(`${this.constructor.name}: Ship flying, transitioning to Hunting`);
                }
                this.state = 'Hunting';
                this.nextTargetScan = this.ship.age;
            }
        }
    }

    /**
     * Checks if a target is valid: not Pirate, not Allied, and passes isValidAttackTarget.
     * @static
     * @param {Ship} source - The source ship.
     * @param {Ship} target - The target ship.
     * @returns {boolean} True if the target is valid, false otherwise.
     */
    static isValidPirateTarget(source, target) {
        if (!isValidAttackTarget(source, target, true)) return false;
        if (target instanceof Ship && target.pilot instanceof PirateAiPilot) return false;
        if (target instanceof Ship && source.getRelationship(target) === FactionRelationship.Allied) return false;
        return true;
    }
}