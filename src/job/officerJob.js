// /src/job/pirateJob.js

import { Job } from '/src/job/job.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { isValidAttackTarget } from '/src/ship/ship.js';
import { AiPilot, OfficerAiPilot, PirateAiPilot } from '/src/pilot/aiPilot.js';
import { PlayerPilot } from '/src/pilot/pilot.js';
import { BoardShipAutopilot, LandOnPlanetAutopilot } from '/src/autopilot/autopilot.js';
import { Ship } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';
import { FactionRelationship } from '/src/core/faction.js';
import { Planet } from '/src/starSystem/celestialBody.js';

/**
 * Job for officer ships to attack hostile ships, board disabled ships, and land on planets.
 * @extends Job
 */
export class OfficerJob extends Job {
    /**
     * Creates a new OfficerJob instance.
     * @param {Ship} ship - The ship to control.
     * @param {AiPilot} [pilot=null] - The pilot controlling the ship (optional).
     * @param {boolean} [attackDisabledShips=true] - Whether to attack disabled ships.
     */
    constructor(ship, pilot = null, attackDisabledShips = true) {
        super(ship, pilot);
        /** @type {boolean} Whether to attack a ship that is disabled. */
        this.attackDisabledShips = attackDisabledShips;
        /** @type {string} The current job state. */
        this.state = 'Starting';
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Starting': this.updateStarting.bind(this),
            'Hunting': this.updateHunting.bind(this),
            'Boarding': this.updateBoarding.bind(this),
            'Boarded': this.updateBoarded.bind(this),
            'Landing': this.updateLanding.bind(this),
            'Landed': this.updateLanded.bind(this),
            'Waiting': this.updateWaiting.bind(this),
            'Failed': () => { }
        };
        /** @type {number} Interval (seconds) between target scans in Hunting state. */
        this.targetScanInterval = 1.0;
        /** @type {number} Ship age (seconds) when the next target scan is due. */
        this.nextTargetScan = 0.0;

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
     * Handles the 'Hunting' state, scanning for hostile or disabled targets.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateHunting(deltaTime, gameManager) {
        if (this.ship.state !== 'Flying') return;

        if (this.pilot.state === 'Attack') {
            // Already attacking, let pilot handle
            return;
        }
        if (this.pilot.autopilot instanceof BoardShipAutopilot) {
            // Boarding autopilot active, transition to Boarding state
            this.state = 'Boarding';
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: BoardShipAutopilot active, transitioning to Boarding`);
            }
            return;
        }

        if (this.ship.age >= this.nextTargetScan) {
            this.nextTargetScan = this.ship.age + this.targetScanInterval;

            // Prioritize hostiles
            let target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));

            // Fallback to random hostile ship
            if (!target) {
                target = this.ship.starSystem.getRandomShip(this.ship, null, OfficerJob.isValidHostileTarget);
            }

            if (target) {
                this.ship.target = target;
                this.pilot.changeState('Attack', new AttackAutopilot(this.ship, target, true));
                if (this.ship.debug) {
                    console.log(`${this.constructor.name}: Found hostile target ${target.name}, initiating Attack`);
                }
                return;
            }

            // No hostiles, look for disabled ships to board
            target = this.ship.starSystem.getRandomShip(this.ship, null, OfficerJob.isValidBoardingTarget);
            if (target) {
                this.ship.target = target;
                this.pilot.setAutopilot(new BoardShipAutopilot(this.ship, target));
                this.state = 'Boarding';
                if (this.ship.debug) {
                    console.log(`${this.constructor.name}: Found disabled target ${target.name}, initiating Boarding`);
                }
                return;
            }

            // No hostiles or disabled ships, land on closest planet
            const targetPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
            if (targetPlanet) {
                this.ship.target = targetPlanet;
                this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, targetPlanet));
                this.state = 'Landing';
                if (this.ship.debug) {
                    console.log(`${this.constructor.name}: No targets, transitioning to Landing`);
                }
            } else if (this.ship.debug) {
                console.log(`${this.constructor.name}: No hostile, disabled, or planet targets found`);
            }
        }
    }

    /**
     * Handles the 'Boarding' state, managing boarding of disabled ships.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateBoarding(deltaTime, gameManager) {
        if (this.ship.state === 'Landed' && this.ship.landedObject instanceof Ship) {
            // Boarding complete, transition to Boarded
            this.state = 'Boarded';
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Boarding complete, transitioning to Boarded`);
            }
            return;
        }
        if (!this.pilot.autopilot || !(this.pilot.autopilot instanceof BoardShipAutopilot)) {
            // Autopilot stopped or failed, try hunting again
            this.state = 'Hunting';
            this.nextTargetScan = this.ship.age;
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Boarding autopilot stopped, transitioning to Hunting`);
            }
        }
    }

    /**
     * Handles the 'Boarded' state, transitioning to landing on a planet.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateBoarded(deltaTime, gameManager) {
        this.state = 'Hunting';
    }

    /**
     * Handles the 'Landing' state, managing planet landing.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateLanding(deltaTime, gameManager) {
        if (this.ship.state === 'Landed' && this.ship.landedObject instanceof Planet) {
            // Landed on planet, transition to Landed
            this.state = 'Landed';
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Landed on planet, transitioning to Landed`);
            }
            return;
        }
        if (!this.pilot.autopilot || !(this.pilot.autopilot instanceof LandOnPlanetAutopilot)) {
            // Autopilot stopped or failed, try hunting again
            this.state = 'Hunting';
            this.nextTargetScan = this.ship.age;
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Landing autopilot stopped, transitioning to Hunting`);
            }
        }
    }

    /**
     * Handles the 'Landed' state, transitioning to Waiting.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateLanded(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            this.state = 'Waiting';
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Landed, transitioning to Waiting`);
            }
        } else {
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Not landed, transitioning to Starting`);
            }
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

        // Check for hostiles first
        let target = this.ship.starSystem.getRandomShip(this.ship, null, OfficerJob.isValidHostileTarget);
        if (target) {
            this.ship.target = target;
            this.pilot.changeState('Attack', new AttackAutopilot(this.ship, target, true));
            this.ship.initiateTakeoff();
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Found hostile target ${target.name}, initiating takeoff and Attack`);
            }
            return;
        }

        // Check for disabled ships to board
        target = this.ship.starSystem.getRandomShip(this.ship, null, OfficerJob.isValidBoardingTarget);
        if (target) {
            this.ship.target = target;
            this.pilot.setAutopilot(new BoardShipAutopilot(this.ship, target));
            this.ship.initiateTakeoff();
            this.state = 'Boarding';
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Found disabled target ${target.name}, initiating takeoff and Boarding`);
            }
        }
    }

    /**
     * Checks if a target is valid: Hostile relationship and passes isValidAttackTarget.
     * @static
     * @param {Ship} source - The source ship.
     * @param {Ship} target - The target ship.
     * @param {boolean} [includeDisabled=false] - Whether to include disabled ships as valid targets.
     * @returns {boolean} True if the target is valid, false otherwise.
     */
    static isValidHostileTarget(source, target, includeDisabled = false) {
        if (!isValidAttackTarget(source, target, includeDisabled)) return false;
        if (source.getRelationship(target) === FactionRelationship.Hostile) return true;
        if (target instanceof Ship && target.hostiles.some(s => source.getRelationship(s) === FactionRelationship.Allied)) return true;
        return false;
    }

    /**
     * Checks if a target is valid for boarding: Disabled and in the same system.
     * @static
     * @param {Ship} source - The source ship.
     * @param {Ship} target - The target ship.
     * @returns {boolean} True if the target is valid for boarding, false otherwise.
     */
    static isValidBoardingTarget(source, target) {
        if (!(target instanceof Ship)) return false;
        if (!isValidTarget(source, target)) return false;
        if (target.state !== 'Disabled') return false;
        return true;
    }
}