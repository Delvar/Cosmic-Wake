// /src/job/pirateJob.js

import { Job } from '/src/job/job.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { isValidAttackTarget } from '/src/ship/ship.js';
import { AiPilot, OfficerAiPilot, PirateAiPilot } from '/src/pilot/aiPilot.js';
import { PlayerPilot } from '/src/pilot/pilot.js';
import { LandOnPlanetAutopilot } from '/src/autopilot/autopilot.js';
import { Ship } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';
import { GameObject } from '/src/core/gameObject.js';
import { FactionRelationship } from '/src/core/faction.js';

/**
 * Job for officer ships to attack hostile ships in the system.
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
        /** @type {string} The current job state ('Starting', 'Hunting', 'Waiting', 'Landing', 'Failed'). */
        this.state = 'Starting';
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Starting': this.updateStarting.bind(this),
            'Hunting': this.updateHunting.bind(this),
            'Waiting': this.updateWaiting.bind(this),
            'Landing': this.updateLanding.bind(this),
            'Failed': () => { }
        };
        /** @type {number} Interval (seconds) between target scans in Hunting state. */
        this.targetScanInterval = 1.0;
        /** @type {number} Ship age (seconds) when the next target scan is due. */
        this.nextTargetScan = 0;

        if (new.target === OfficerJob) Object.seal(this);
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
                console.log(`${this.constructor.name}: Landed, transitioning to Waiting`);
            }
            this.state = 'Waiting';
            return;
        }
        if (this.ship.state === 'Flying') {
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Flying, transitioning to Hunting`);
            }
            this.state = 'Hunting';
            this.nextTargetScan = this.ship.age;
        }
    }

    /**
     * Handles the 'Hunting' state, scanning for hostile targets to attack.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateHunting(deltaTime, gameManager) {
        if (this.ship.state !== 'Flying') return;

        if (this.pilot.state === 'Attack') {
            // Already attacking, let OfficerAiPilot handle
            return;
        }

        if (this.ship.age >= this.nextTargetScan) {
            this.nextTargetScan = this.ship.age + this.targetScanInterval;

            // Prioritize hostiles
            let target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s));

            // Fallback to random hostile ship
            if (!target) {
                target = this.ship.starSystem.getRandomShip(this.ship, null, OfficerJob.isValidHostileTarget);
            }

            if (target) {
                this.ship.target = target;
                this.pilot.changeState('Attack', new AttackAutopilot(this.ship, target));
                if (this.ship.debug) {
                    console.log(`${this.constructor.name}: Found target ${target.name}, initiating Attack`);
                }
            } else {
                const targetPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
                if (targetPlanet) {
                    this.ship.target = targetPlanet;
                    this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, targetPlanet));
                    this.state = 'Landing';
                    if (this.ship.debug) {
                        console.log(`${this.constructor.name}: No hostile target, transitioning to Landing`);
                    }
                } else if (this.ship.debug) {
                    console.log(`${this.constructor.name}: No hostile target or planet found`);
                }
            }
        }
    }

    /**
     * Handles the 'Landing' state, finding the closest planet and landing.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateLanding(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Landed, transitioning to Waiting`);
            }
            this.state = 'Waiting';
            return;
        }
        if (!this.pilot.autopilot) {
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: No autopilot, transitioning to Starting`);
            }
            this.state = 'Starting';
            return;
        }
    }

    /**
     * Handles the 'Waiting' state, scanning for targets while landed.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateWaiting(deltaTime, gameManager) {
        if (this.ship.state !== 'Landed') {
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Not landed, transitioning to Starting`);
            }
            this.state = 'Starting';
            return;
        }

        const target = this.ship.starSystem.getRandomShip(this.ship, null, OfficerJob.isValidHostileTarget);
        if (target) {
            this.ship.target = target;
            this.pilot.changeState('Attack', new AttackAutopilot(this.ship, target));
            this.ship.initiateTakeoff();
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Found target ${target.name}, initiating takeoff and Attack`);
            }
        }
    }

    /**
     * Checks if a target is valid: Hostile relationship and passes isValidAttackTarget.
     * @static
     * @param {Ship} source - The source ship.
     * @param {Ship} target - The target ship.
     * @returns {boolean} True if the target is valid, false otherwise.
     */
    static isValidHostileTarget(source, target) {
        if (!isValidAttackTarget(source, target)) return false;
        if (source.getRelationship(target) === FactionRelationship.Hostile) return true;
        // Check allied ships' hostiles (e.g., Player attacking Civilian)
        if (target instanceof Ship && target.hostiles.some(s => source.getRelationship(s) === FactionRelationship.Allied)) return true;
        return false;
    }
}